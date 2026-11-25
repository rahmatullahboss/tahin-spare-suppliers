type InboundReader = { query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]> };

/** Only the already selected conversation's messages may change read state. */
export async function markInboundMessagesRead(sql: InboundReader, ids: Iterable<string>): Promise<number> {
  const selected = [...new Set(ids)].filter(Boolean);
  if (!selected.length) return 0;
  const rows = await sql.query(
    "UPDATE inbound_emails SET is_read = true WHERE id = ANY($1::text[]) AND is_read = false RETURNING id",
    [selected]
  );
  return rows.length;
}

export async function readInboundCounts(sql: InboundReader) {
  const rows = await sql.query("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_read = false) AS unread FROM inbound_emails");
  return { total: rows[0]?.total ?? 0, unreadCount: rows[0]?.unread ?? 0 };
}
