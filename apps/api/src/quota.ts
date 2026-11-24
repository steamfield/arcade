/** Whether a Durable Object failure reports exhausted account quota. */
export function isQuotaError(error: unknown): boolean {
  if (error instanceof Error && 'overloaded' in error && error.overloaded === true) return false;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/durable object is overloaded|too many requests for the same object/i.test(message)) return false;

  // Cloudflare documents the spending cap error but leaves the wording of free-tier failures open.
  // Require both quota language and exhaustion so ordinary timeouts and per-request limits stay retryable.
  return (
    /\b(?:over|out of) (?:the )?quota\b/i.test(message) ||
    (/\b(?:free[- ]tier|daily (?:[\w-]+ )*(?:limits?|allowance)|quota|spending cap)\b/i.test(message) &&
      /\b(?:exceed(?:ed|s)?|exhausted|reached|hit|used up)\b/i.test(message))
  );
}
