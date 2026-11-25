type ReplayReader = { query(text: string, params: string[]): Promise<Record<string, unknown>[]> };

// Only completed forwards can bypass the original processing path.
// Pending, failed, interrupted and unknown records must retain existing recovery.
export async function isCompletedInboundReplay(sql: ReplayReader, emailId: string): Promise<boolean> {
  if (!emailId) return false;
  const rows = await sql.query(
    "SELECT 1 AS completed FROM inbound_emails WHERE resend_email_id = $1 AND forward_status = 'forwarded' LIMIT 1",
    [emailId]
  );
  return rows.length > 0;
}
