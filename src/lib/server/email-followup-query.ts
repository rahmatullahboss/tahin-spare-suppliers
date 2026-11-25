import { normalizedEmailSubjectSql as sqlSubject } from "./email-thread.ts";

const emailFromInbound = "lower(substring(i.from_address from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'))";

export const FOLLOWUP_PAGE_SIZE = 100;

export function eligibleFollowupQuery(single = false, ignorePendingDraft = false, countOnly = false, mode: "page" | "all" | "selected" = "page"): string {
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
      ${single ? "AND s.id = $1" : mode === "selected" ? "AND s.id = ANY($1::text[])" : ""}
    ${countOnly || mode !== "page" ? "" : `ORDER BY s.created_at DESC, s.id DESC LIMIT ${single ? "1" : FOLLOWUP_PAGE_SIZE} ${single ? "" : "OFFSET $1"}`}`;
}

export function followupPageQuery(): string {
  return `WITH eligible AS MATERIALIZED (${eligibleFollowupQuery(false, false, false, "all")})
    SELECT page.*, totals.total AS candidate_total
    FROM (SELECT COUNT(*) AS total FROM eligible) totals
    LEFT JOIN LATERAL (
      SELECT * FROM eligible ORDER BY created_at DESC, id DESC
      LIMIT ${FOLLOWUP_PAGE_SIZE} OFFSET $1
    ) page ON true
    ORDER BY page.created_at DESC, page.id DESC`;
}

export type FollowupQueryReader = { query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]> };

export async function readFollowupPage(sql: FollowupQueryReader, page = 1) {
  const safePage = Math.max(1, Math.min(10000, Math.floor(page) || 1));
  const rows = await sql.query(followupPageQuery(), [(safePage - 1) * FOLLOWUP_PAGE_SIZE]);
  const candidateCount = Number(rows[0]?.candidate_total ?? 0);
  const candidates = rows.filter(row => row.id != null).map(({ candidate_total, ...candidate }) => candidate);
  return { candidates, candidateCount };
}
