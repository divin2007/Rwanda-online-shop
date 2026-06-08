import DOMPurify from 'isomorphic-dompurify';

/**
 * Frontend sanitization helpers.
 *
 * The backend is the source of truth for validation, but these provide a
 * defense-in-depth UX layer so malformed or hostile input is cleaned before it
 * is sent or rendered. Never pass raw user input to dangerouslySetInnerHTML —
 * run it through sanitizeHtml first.
 */

/**
 * Sanitize a string that will be rendered as HTML. Strips scripts, event
 * handlers, and dangerous tags/attributes, allowing only basic formatting.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

// Strip C0/C1 control characters and DEL, but keep tab (\t), newline (\n),
// and carriage return (\r). Built from char codes to avoid embedding literal
// control characters in source.
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]',
  'g',
);

/**
 * Sanitize plain-text input: strip any HTML/angle brackets, remove control
 * characters, and cap length. Use on free-text form fields before submitting
 * to the API.
 */
export function sanitizeText(value: string, maxLength = 2000): string {
  if (!value) return '';
  const noHtml = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const cleaned = noHtml.replace(CONTROL_CHARS, '');
  return cleaned.slice(0, maxLength);
}

/** True when the value is non-empty and already clean (no HTML/control chars). */
export function isCleanText(value: string): boolean {
  return value.length > 0 && sanitizeText(value) === value.trim();
}
