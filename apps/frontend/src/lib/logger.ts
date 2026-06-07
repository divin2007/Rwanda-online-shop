/**
 * Sensitive-data-aware logger.
 *
 * - In production builds, debug/info logs are suppressed entirely.
 * - Any object passed in is deep-cleaned so token/password/PII-shaped keys are
 *   redacted before they can reach the console (or any future log sink).
 *
 * Use this instead of raw console.* when logging values that may contain
 * server payloads, auth state, user records, addresses, or phone numbers.
 */

const SENSITIVE_KEY = /(token|password|secret|authorization|auth|refresh|otp|pin|ssn|cvv|card|phone|email|address|coordinates|lat|lng|location)/i;

const isProd = process.env.NODE_ENV === 'production';

function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function clean(args: unknown[]): unknown[] {
  return args.map((a) => (typeof a === 'object' && a !== null ? redact(a) : a));
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isProd) console.log(...clean(args));
  },
  info: (...args: unknown[]) => {
    if (!isProd) console.info(...clean(args));
  },
  warn: (...args: unknown[]) => {
    console.warn(...clean(args));
  },
  error: (...args: unknown[]) => {
    console.error(...clean(args));
  },
};
