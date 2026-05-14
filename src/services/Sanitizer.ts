import type { AppError } from '@/models/AppError'
import type { Result } from '@/models/Result'

/**
 * Sanitizer — escapes XSS-relevant characters and detects dangerous patterns.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export class Sanitizer {
  // -----------------------------------------------------------------------
  // HTML entity escape map
  // -----------------------------------------------------------------------
  private static readonly ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  }

  // -----------------------------------------------------------------------
  // Patterns that indicate an XSS vector.
  // We check AFTER sanitization so we are looking at the escaped form.
  // Because sanitize() converts < → &lt; and > → &gt;, a literal <script>
  // in the original input becomes &lt;script&gt; in the sanitized output.
  // We therefore test the ORIGINAL (pre-sanitization) string for dangerous
  // patterns, and also test HTML-entity-decoded variants in the original.
  // -----------------------------------------------------------------------

  /**
   * Patterns matched against the RAW (pre-sanitization) input.
   * Covers literal constructs and common obfuscation tricks.
   */
  private static readonly RAW_DANGER_PATTERNS: RegExp[] = [
    // <script …> or </script>
    /<\s*\/?\s*script\b/i,
    // onerror= (and other on* event handlers)
    /\bon\w+\s*=/i,
    // javascript: URI (with optional whitespace / encoding)
    /javascript\s*:/i,
    // data: URI (can carry scripts)
    /data\s*:/i,
    // vbscript: URI
    /vbscript\s*:/i,
    // <iframe, <object, <embed, <form, <input, <img, <svg, <link, <meta
    /<\s*(iframe|object|embed|form|input|img|svg|link|meta)\b/i,
    // expression( — CSS expression injection
    /expression\s*\(/i,
    // url( with a dangerous scheme — css url injection
    // Note: bare url( is intentionally NOT blocked here to avoid false positives
    // on plain text like "see url (below)". The dangerous schemes (javascript:,
    // data:, vbscript:) are already caught by the patterns above.
    /url\s*\(\s*(?:javascript|data|vbscript)\s*:/i,
  ]

  /**
   * Patterns matched against the HTML-entity-decoded form of the input,
   * catching entity-encoded XSS variants (e.g. &#x3C;script&#x3E;).
   */
  private static readonly DECODED_DANGER_PATTERNS: RegExp[] = [
    /<\s*\/?\s*script\b/i,
    /\bon\w+\s*=/i,
    /javascript\s*:/i,
    /data\s*:/i,
    /vbscript\s*:/i,
    /<\s*(iframe|object|embed|form|input|img|svg|link|meta)\b/i,
    /expression\s*\(/i,
    /url\s*\(\s*(?:javascript|data|vbscript)\s*:/i,
  ]

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Escapes `<`, `>`, `"`, `'`, and `&` to their HTML entity equivalents.
   *
   * The operation is idempotent: sanitize(sanitize(s)) === sanitize(s).
   * Idempotence is achieved by first normalising any existing HTML entities
   * back to their raw characters, then escaping everything uniformly.
   * This prevents double-escaping (e.g. `&amp;` → `&amp;amp;`).
   *
   * Requirement 9.1, 9.3
   */
  sanitize(input: string): string {
    // Step 1: decode any existing HTML entities so we start from a clean slate.
    const decoded = this.decodeHtmlEntities(input)
    // Step 2: escape all five characters, & first to avoid double-escaping.
    return decoded.replace(/[&<>"']/g, (char) => Sanitizer.ESCAPE_MAP[char] ?? char)
  }

  /**
   * Returns `true` when the input is free of known XSS vectors.
   * Checks both the raw string and its HTML-entity-decoded form to catch
   * entity-encoded variants (Requirement 9.4).
   *
   * Requirement 9.2, 9.4
   */
  isSafe(input: string): boolean {
    // Check raw input for literal dangerous patterns.
    for (const pattern of Sanitizer.RAW_DANGER_PATTERNS) {
      if (pattern.test(input)) return false
    }

    // Decode HTML entities and check again for encoded variants.
    const decoded = this.decodeHtmlEntities(input)
    if (decoded !== input) {
      for (const pattern of Sanitizer.DECODED_DANGER_PATTERNS) {
        if (pattern.test(decoded)) return false
      }
    }

    return true
  }

  /**
   * Sanitizes the input and then verifies it is safe.
   * Returns a `Result` — either the sanitized string or a
   * `SANITIZATION_REJECTED` error.
   *
   * Requirement 9.5
   */
  sanitizeAndValidate(input: string): Result<string, AppError> {
    // First check the raw input for XSS vectors.
    if (!this.isSafe(input)) {
      return {
        ok: false,
        error: {
          code: 'SANITIZATION_REJECTED',
          message: 'Input contains disallowed content.',
        },
      }
    }

    const sanitized = this.sanitize(input)

    // Double-check the sanitized output (defence-in-depth).
    if (!this.isSafe(sanitized)) {
      return {
        ok: false,
        error: {
          code: 'SANITIZATION_REJECTED',
          message: 'Input contains disallowed content.',
        },
      }
    }

    return { ok: true, value: sanitized }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Decodes common HTML entities back to their character equivalents so that
   * entity-encoded XSS payloads can be detected, and so that sanitize() can
   * be idempotent (decode-then-encode avoids double-escaping).
   */
  decodeHtmlEntities(input: string): string {
    return input
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
  }
}

/** Singleton instance for convenience. */
export const sanitizer = new Sanitizer()
