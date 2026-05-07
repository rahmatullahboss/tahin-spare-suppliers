export function extractEmailAddress(value: string): string {
  const angleMatch = value.match(/<([^>]+)>/);
  const candidate = angleMatch?.[1] ?? value;
  const emailMatch = candidate.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (emailMatch?.[0] ?? candidate).trim().toLowerCase();
}

export function normalizeEmailSubject(subject: string): string {
  return subject
    .replace(/^(\s*((re|fw|fwd)\s*:\s*)+)/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function makeReplySubject(subject: string): string {
  const trimmed = subject.trim();
  return /^re\s*:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
