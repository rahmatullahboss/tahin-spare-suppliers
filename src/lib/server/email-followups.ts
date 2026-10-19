import type { RuntimeEnv } from "./env";
import { getDb } from "./db";
import { getResendClient } from "./email-service";
import { extractEmailAddress, makeReplySubject, normalizeEmailSubject, normalizedEmailSubjectSql as sqlSubject } from "./email-thread";

type Sql = ReturnType<typeof getDb>;

export type ThreadHeaders = { inReplyTo: string; references: string };
export type FollowupCandidate = {
  id: string;
  to_address: string;
  subject: string;
  created_at: string;
  resend_id: string;
  message_id: string;
  delivery_status: string;
};

const messageIdPattern = /^<[^<>\s\r\n]{1,256}>$/;
export function safeMessageId(value: unknown): string {
  return typeof value === "string" && messageIdPattern.test(value.trim()) ? value.trim() : "";
}

export function readInboundThreadHeaders(value: unknown): ThreadHeaders {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { inReplyTo: "", references: "" };
  }
  const headers = value as Record<string, unknown>;
  const get = (name: string): string => {
    const key = Object.keys(headers).find((item) => item.toLowerCase() === name);
    return key && typeof headers[key] === "string" ? String(headers[key]).slice(0, 4000) : "";
  };
  return {
    inReplyTo: safeMessageId(get("in-reply-to")),
    references: (get("references").match(/<[^<>\s\r\n]{1,256}>/g) ?? []).slice(0, 25).join(" ")
  };
}

export function hasThreadReply(
  reply: { from: string; subject: string; inReplyTo?: string; references?: string },
  sent: { to: string; subject: string; messageId?: string }
): boolean {
  if (extractEmailAddress(reply.from) !== extractEmailAddress(sent.to)) return false;
  const messageId = safeMessageId(sent.messageId);
  return normalizeEmailSubject(reply.subject) === normalizeEmailSubject(sent.subject)
    || Boolean(messageId && (reply.inReplyTo === messageId
      || (reply.references ?? "").split(/\s+/).includes(messageId)));
}

export function defaultFollowupBody(): string {
  return "Hello,\n\nI wanted to follow up on my previous email. Please let me know if you need any further details or a quotation.\n\nThank you.";
}

export function defaultFollowupSubject(subject: string): string {
  return makeReplySubject(subject);
}


const emailFromInbound = "lower(substring(i.from_address from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'))";

export const FOLLOWUP_PAGE_SIZE = 100;

export function eligibleFollowupQuery(single = false, ignorePendingDraft = false, countOnly = false): string {
  const sameSubject = `${sqlSubject("s2.subject")} = ${sqlSubject("s.subject")}`;
  return `SELECT ${countOnly ? "COUNT(*) AS total" : "s.id, s.to_address, s.subject, s.created_at, s.resend_id, s.message_id, s.delivery_status"}
    FROM sent_emails s
    WHERE s.created_at <= NOW() - INTERVAL '7 days'
      AND s.resend_id IS NOT NULL AND s.resend_id <> ''
      AND s.delivery_status NOT IN ('failed','bounced','suppressed','complained')
      AND s.to_address NOT LIKE '%,%'
      AND s.to_address NOT LIKE '%;%'
      AND s.to_address LIKE '%@%'
      AND NOT EXISTS (
        SELECT 1 FROM sent_emails later
        WHERE lower(later.to_address) = lower(s.to_address)
          AND ${sqlSubject("later.subject")} = ${sqlSubject("s.subject")}
          AND (later.created_at > s.created_at OR (later.created_at = s.created_at AND later.id > s.id))
      )
      AND NOT EXISTS (
        SELECT 1 FROM inbound_emails i
        WHERE ${emailFromInbound} = lower(s.to_address)
          AND i.created_at >= (
            SELECT MIN(s2.created_at) FROM sent_emails s2
            WHERE lower(s2.to_address) = lower(s.to_address) AND ${sameSubject}
          )
          AND (
            ${sqlSubject("i.subject")} = ${sqlSubject("s.subject")}
            OR EXISTS (
              SELECT 1 FROM sent_emails s2
              WHERE lower(s2.to_address) = lower(s.to_address)
                AND ${sameSubject}
                AND s2.message_id <> ''
                AND (
                  i.in_reply_to_message_id = s2.message_id
                  OR position(s2.message_id in i.references_header) > 0
                )
            )
          )
      )
      ${ignorePendingDraft ? "" : `AND NOT EXISTS (
        SELECT 1 FROM email_followup_drafts f
        WHERE f.source_sent_id = s.id AND f.status IN ('draft','approved','sending','uncertain')
      )`}
      ${single ? "AND s.id = $1" : ""}
    ${countOnly ? "" : `ORDER BY s.created_at DESC, s.id DESC LIMIT ${single ? "1" : FOLLOWUP_PAGE_SIZE} ${single ? "" : "OFFSET $1"}`}`;
}

export async function listFollowupCandidates(sql: Sql, page = 1): Promise<FollowupCandidate[]> {
  const safePage = Math.max(1, Math.min(10000, Math.floor(page) || 1));
  const rows = await sql.query(eligibleFollowupQuery(), [(safePage - 1) * FOLLOWUP_PAGE_SIZE]);
  return rows as unknown as FollowupCandidate[];
}

export async function countFollowupCandidates(sql: Sql): Promise<number> {
  const rows = await sql.query(eligibleFollowupQuery(false, false, true));
  return Number(rows[0]?.total ?? 0);
}

export async function getEligibleFollowupCandidate(sql: Sql, id: string, ignorePendingDraft = false): Promise<FollowupCandidate | null> {
  const rows = await sql.query(eligibleFollowupQuery(true, ignorePendingDraft), [id]);
  return (rows[0] as unknown as FollowupCandidate | undefined) ?? null;
}

export async function resolveSourceMessageId(env: RuntimeEnv, source: FollowupCandidate): Promise<string> {
  const saved = safeMessageId(source.message_id);
  if (saved) return saved;
  const result = await getResendClient(env).emails.get(source.resend_id);
  if (result.error || !result.data) {
    throw new Error("Original email Message-ID is unavailable from Resend.");
  }
  const remote = result.data as unknown as { message_id?: unknown };
  const messageId = safeMessageId(remote.message_id);
  if (!messageId) {
    throw new Error("Original email lacks a valid Message-ID. Thread-safe follow-up was not created.");
  }
  const sql = getDb(env);
  await sql.query("UPDATE sent_emails SET message_id = $2 WHERE id = $1 AND message_id = ''", [
    source.id, messageId
  ]);
  return messageId;
}

/** Used after a verified Resend receiving webhook; never sends mail. */
export async function blockAnsweredFollowups(
  sql: Sql, from: string, subject: string, headers: ThreadHeaders, receivedAt: string
): Promise<void> {
  const recipient = extractEmailAddress(from);
  if (!recipient.includes("@") || !Number.isFinite(Date.parse(receivedAt))) return;
  const normalSubject = normalizeEmailSubject(subject);
  const pending = await sql.query(
    `SELECT f.id, f.subject, s.message_id
     FROM email_followup_drafts f
     JOIN sent_emails s ON s.id = f.source_sent_id
     WHERE lower(f.recipient) = $1
       AND f.status IN ('draft','approved')
       AND s.created_at <= $2::timestamptz`,
    [recipient, receivedAt]
  );
  const answeredIds = pending.filter((row) => hasThreadReply(
    { from, subject, inReplyTo: headers.inReplyTo, references: headers.references },
    { to: recipient, subject: String(row.subject), messageId: String(row.message_id ?? "") }
  ) || normalizeEmailSubject(String(row.subject)) === normalSubject).map((row) => String(row.id));
  if (answeredIds.length) {
    await sql.query(
      "UPDATE email_followup_drafts SET status = 'replied', updated_at = NOW() WHERE id = ANY($1::text[]) AND status IN ('draft','approved')",
      [answeredIds]
    );
  }
}
