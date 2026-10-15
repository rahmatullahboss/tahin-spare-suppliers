import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../lib/server/db";
import { sendEmail } from "../../../../lib/server/email-service";
import { plainTextEmailToHtml } from "../../../../lib/server/email-content";
import { normalizeEmailSubject } from "../../../../lib/server/email-thread";
import { appendEmailSignature, getEmailSignatureSettings, renderEmailSignatureHtml } from "../../../../lib/server/email-signature";
import {
  defaultFollowupBody, defaultFollowupSubject, getEligibleFollowupCandidate,
  listFollowupCandidates, resolveSourceMessageId, safeMessageId
} from "../../../../lib/server/email-followups";

export const prerender = false;

type RequestBody = {
  action?: unknown;
  ids?: unknown;
  id?: unknown;
  subject?: unknown;
  body?: unknown;
};

type Draft = {
  id: string;
  source_sent_id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  resend_id: string;
};

const maxDraftBatch = 50;
const maxSendBatch = 15;
function checkedIds(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null;
  if (value.some((item) => typeof item !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(item))) return null;
  const ids = [...new Set(value as string[])];
  return ids.length > 0 ? ids : null;
}

export const GET: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });
  try {
    await ensureSchema(env);
    const sql = getDb(env);
    // A crashed request must not leave a draft in "sending" indefinitely.
    // It is NOT safe to retry automatically: the provider may have accepted it.
    await sql.query(
      `UPDATE email_followup_drafts
       SET status = 'uncertain', updated_at = NOW(),
           send_error = CASE WHEN resend_id <> '' THEN
             'Provider accepted; verify sent-email history before reconciling.'
           ELSE 'Send interrupted; verify Resend before doing anything else.' END
       WHERE status = 'sending'
         AND updated_at < NOW() - INTERVAL '15 minutes'`
    );
    const [candidates, drafts] = await Promise.all([
      listFollowupCandidates(sql),
      sql.query(`SELECT f.id, f.source_sent_id, f.recipient, f.subject, f.body, f.status,
                        f.send_error, f.created_at, f.updated_at, f.approved_at, f.sent_at,
                        s.subject AS original_subject, s.created_at AS original_sent_at
                 FROM email_followup_drafts f JOIN sent_emails s ON s.id = f.source_sent_id
                 WHERE f.status IN ('draft','approved','sending','uncertain')
                 ORDER BY f.created_at DESC LIMIT 200`)
    ]);
    return Response.json({ candidates, drafts });
  } catch (error) {
    console.error("Follow-up list error:", error);
    return Response.json({ error: "Could not load follow-ups." }, { status: 500 });
  }
};

export const PATCH: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });
  try {
    await ensureSchema(env);
    const body = await context.request.json() as RequestBody;
    const id = typeof body.id === "string" ? body.id : "";
    const action = body.action;
    if (!/^[a-zA-Z0-9-]{1,128}$/.test(id) || !["save", "approve", "cancel"].includes(String(action))) {
      return Response.json({ error: "Invalid draft action." }, { status: 400 });
    }
    const sql = getDb(env);
    const rows = await sql.query(
      "SELECT id, source_sent_id, status FROM email_followup_drafts WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return Response.json({ error: "Draft not found." }, { status: 404 });
    if (!["draft", "approved"].includes(String(rows[0].status))) {
      return Response.json({ error: "This draft is locked and cannot be edited." }, { status: 409 });
    }
    if (action === "cancel") {
      const cancelled = await sql.query(
        "UPDATE email_followup_drafts SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status IN ('draft','approved') RETURNING id",
        [id]
      );
      if (!cancelled.length) return Response.json({ error: "Draft already changed; reload." }, { status: 409 });
      return Response.json({ ok: true });
    }
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const emailBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!subject || subject.length > 250 || !emailBody || emailBody.length > 30000) {
      return Response.json({ error: "Subject (max 250) and body (max 30000) are required." }, { status: 400 });
    }
    if (action === "approve") {
      const source = await getEligibleFollowupCandidate(sql, String(rows[0].source_sent_id), true);
      if (!source) {
        await sql.query(
          "UPDATE email_followup_drafts SET status = 'replied', updated_at = NOW() WHERE id = $1 AND status IN ('draft','approved')",
          [id]
        );
        return Response.json({ error: "Client replied or the source is no longer eligible; draft removed from queue." }, { status: 409 });
      }
      if (normalizeEmailSubject(subject) !== normalizeEmailSubject(source.subject)) {
        return Response.json({ error: "Follow-up subject must stay the same as the original thread." }, { status: 400 });
      }
      await resolveSourceMessageId(env, source);
    }
    const result = await sql.query(
      `UPDATE email_followup_drafts
       SET subject = $2, body = $3, status = $4, updated_at = NOW(),
           approved_at = CASE WHEN $4 = 'approved' THEN NOW() ELSE NULL END
       WHERE id = $1 AND status IN ('draft','approved') RETURNING id, status`,
      [id, subject, emailBody, action === "approve" ? "approved" : "draft"]
    );
    if (!result.length) return Response.json({ error: "Draft changed. Reload." }, { status: 409 });
    return Response.json({ ok: true, draft: result[0] });
  } catch (error) {
    console.error("Follow-up edit error:", error);
    return Response.json({ error: "Could not save draft." }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });
  try {
    await ensureSchema(env);
    const payload = await context.request.json() as RequestBody;
    const action = payload.action;
    const ids = checkedIds(payload.ids, action === "send" ? maxSendBatch : maxDraftBatch);
    if (!ids || !["create", "send"].includes(String(action))) {
      return Response.json({ error: "Select valid items (up to 50 drafts or 15 sends)." }, { status: 400 });
    }
    const sql = getDb(env);
    const results: { id: string; ok: boolean; error?: string }[] = [];
    if (action === "create") {
      for (const id of ids) {
        try {
          const source = await getEligibleFollowupCandidate(sql, id);
          if (!source) throw new Error("Client already replied, or email is not due.");
          await resolveSourceMessageId(env, source);
          const draftId = crypto.randomUUID();
          const inserted = await sql.query(
            `INSERT INTO email_followup_drafts
               (id, source_sent_id, recipient, subject, body)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING RETURNING id`,
            [draftId, source.id, source.to_address, defaultFollowupSubject(source.subject), defaultFollowupBody()]
          );
          if (!inserted.length) throw new Error("Follow-up already drafted.");
          results.push({ id, ok: true });
        } catch (error) {
          results.push({ id, ok: false, error: error instanceof Error ? error.message : "Could not create draft." });
        }
      }
      return Response.json({ results });
    }

    // Sending never follows from a timer, draft generation or approval.
    // Only this authenticated explicit action can trigger the provider.
    const signatureSettings = await getEmailSignatureSettings(env);
    const signature = renderEmailSignatureHtml(signatureSettings);
    for (const id of ids) {
      let claimed: Draft | undefined;
      try {
        const rows = await sql.query(
          `UPDATE email_followup_drafts
             SET status = 'sending', updated_at = NOW()
           WHERE id = $1 AND status = 'approved'
           RETURNING id, source_sent_id, recipient, subject, body, status, resend_id`,
          [id]
        );
        claimed = rows[0] as unknown as Draft | undefined;
        if (!claimed) throw new Error("Only approved drafts may be sent.");
        const source = await getEligibleFollowupCandidate(sql, claimed.source_sent_id, true);
        if (!source || source.to_address.toLowerCase() !== claimed.recipient.toLowerCase()) {
          await sql.query(
            "UPDATE email_followup_drafts SET status = 'replied', updated_at = NOW() WHERE id = $1 AND status = 'sending'",
            [id]
          );
          claimed = undefined;
          throw new Error("Reply detected or source changed. Follow-up skipped.");
        }
        if (normalizeEmailSubject(claimed.subject) !== normalizeEmailSubject(source.subject)) {
          throw new Error("The approved follow-up subject no longer matches the original thread.");
        }
        const originalMessageId = safeMessageId(source.message_id) ||
          await resolveSourceMessageId(env, source);
        if (!originalMessageId) throw new Error("Cannot find original Message-ID.");
        const result = await sendEmail(env, {
          to: claimed.recipient,
          subject: claimed.subject,
          html: appendEmailSignature(plainTextEmailToHtml(claimed.body), signature),
          headers: { "In-Reply-To": originalMessageId, "References": originalMessageId },
          idempotencyKey: `followup/${id}`
        });
        await sql.query(
          "UPDATE email_followup_drafts SET resend_id = $2, updated_at = NOW() WHERE id = $1",
          [id, result.resendId]
        );
        await sql.query(
          `INSERT INTO sent_emails
             (id, to_address, from_address, subject, body, resend_id,
              in_reply_to_sent_id, followup_draft_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (resend_id) WHERE resend_id <> ''
             DO UPDATE SET resend_id = EXCLUDED.resend_id`,
          [result.id, claimed.recipient, "sales@tahinspare.com", claimed.subject,
            appendEmailSignature(plainTextEmailToHtml(claimed.body), signature), result.resendId, source.id, id]
        );
        await sql.query(
          "UPDATE email_followup_drafts SET status = 'sent', sent_at = NOW(), updated_at = NOW(), send_error = '' WHERE id = $1 AND status = 'sending'",
          [id]
        );
        results.push({ id, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Delivery state uncertain.";
        if (claimed) {
          // Never silently retry after an ambiguous provider result.
          await sql.query(
            "UPDATE email_followup_drafts SET status = 'uncertain', send_error = $2, updated_at = NOW() WHERE id = $1 AND status = 'sending'",
            [id, message.slice(0, 1000)]
          ).catch((saveError: unknown) => console.error("Could not persist uncertain send:", saveError));
        }
        results.push({ id, ok: false, error: message });
      }
    }
    return Response.json({ results });
  } catch (error) {
    console.error("Follow-up request error:", error);
    return Response.json({ error: "Could not process follow-up request." }, { status: 500 });
  }
};
