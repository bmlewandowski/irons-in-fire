import { describe, it, expect } from 'vitest'
import { Sanitizer } from './Sanitizer'

// Unit tests for Sanitizer — Requirements 9.1–9.5

describe('Sanitizer', () => {
  const s = new Sanitizer()

  // -----------------------------------------------------------------------
  // sanitize()
  // -----------------------------------------------------------------------
  describe('sanitize()', () => {
    it('escapes & to &amp;', () => {
      expect(s.sanitize('a & b')).toBe('a &amp; b')
    })

    it('escapes < to &lt;', () => {
      expect(s.sanitize('<div>')).toBe('&lt;div&gt;')
    })

    it('escapes > to &gt;', () => {
      expect(s.sanitize('a > b')).toBe('a &gt; b')
    })

    it('escapes " to &quot;', () => {
      expect(s.sanitize('"hello"')).toBe('&quot;hello&quot;')
    })

    it("escapes ' to &#x27;", () => {
      expect(s.sanitize("it's")).toBe('it&#x27;s')
    })

    it('escapes all five characters in one string', () => {
      expect(s.sanitize('<a href="test" data-x=\'y\'>a & b</a>')).toBe(
        '&lt;a href=&quot;test&quot; data-x=&#x27;y&#x27;&gt;a &amp; b&lt;/a&gt;',
      )
    })

    it('leaves clean text unchanged', () => {
      expect(s.sanitize('Hello, World!')).toBe('Hello, World!')
    })

    it('handles empty string', () => {
      expect(s.sanitize('')).toBe('')
    })

    it('is idempotent — sanitize(sanitize(s)) === sanitize(s)', () => {
      const inputs = [
        '<script>alert(1)</script>',
        'a & b < c > d "e" \'f\'',
        'Hello, World!',
        '',
        '&amp; already escaped',
        '&lt;div&gt;',
      ]
      for (const input of inputs) {
        const once = s.sanitize(input)
        const twice = s.sanitize(once)
        expect(twice).toBe(once)
      }
    })
  })

  // -----------------------------------------------------------------------
  // isSafe()
  // -----------------------------------------------------------------------
  describe('isSafe()', () => {
    it('returns true for plain text', () => {
      expect(s.isSafe('Hello, World!')).toBe(true)
    })

    it('returns true for empty string', () => {
      expect(s.isSafe('')).toBe(true)
    })

    it('returns false for <script> tag', () => {
      expect(s.isSafe('<script>alert(1)</script>')).toBe(false)
    })

    it('returns false for </script> closing tag', () => {
      expect(s.isSafe('</script>')).toBe(false)
    })

    it('returns false for onerror= attribute', () => {
      expect(s.isSafe('<img onerror=alert(1)>')).toBe(false)
    })

    it('returns false for onclick= attribute', () => {
      expect(s.isSafe('<div onclick="evil()">')).toBe(false)
    })

    it('returns false for javascript: URI', () => {
      expect(s.isSafe('javascript:void(0)')).toBe(false)
    })

    it('returns false for javascript: URI with spaces', () => {
      expect(s.isSafe('javascript : alert(1)')).toBe(false)
    })

    it('returns false for data: URI', () => {
      expect(s.isSafe('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('returns false for vbscript: URI', () => {
      expect(s.isSafe('vbscript:msgbox(1)')).toBe(false)
    })

    it('returns false for entity-encoded <script> (&#x3C;script&#x3E;)', () => {
      expect(s.isSafe('&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;')).toBe(false)
    })

    it('returns false for decimal-entity-encoded <script> (&#60;script&#62;)', () => {
      expect(s.isSafe('&#60;script&#62;alert(1)&#60;/script&#62;')).toBe(false)
    })

    it('returns false for &lt;script&gt; (already-escaped form)', () => {
      // The decoded form of &lt;script&gt; is <script>, which is dangerous.
      expect(s.isSafe('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe(false)
    })

    it('returns false for <iframe>', () => {
      expect(s.isSafe('<iframe src="evil.com">')).toBe(false)
    })

    it('returns false for <img> tag', () => {
      expect(s.isSafe('<img src=x onerror=alert(1)>')).toBe(false)
    })

    // url() false-positive regression
    it('returns true for plain text containing "url ("', () => {
      expect(s.isSafe('See url (below) for details')).toBe(true)
    })

    it('returns true for plain text containing "url(" without a scheme', () => {
      expect(s.isSafe('Upload the url(link) here')).toBe(true)
    })

    it('returns false for url(javascript:…) — CSS injection vector', () => {
      expect(s.isSafe('background:url(javascript:alert(1))')).toBe(false)
    })

    it('returns false for url(data:…) — CSS injection vector', () => {
      expect(s.isSafe('background:url(data:text/html,<h1>xss</h1>)')).toBe(false)
    })

    it('returns false for url( vbscript:…) with spaces', () => {
      expect(s.isSafe('url( vbscript:msgbox(1))')).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // sanitizeAndValidate()
  // -----------------------------------------------------------------------
  describe('sanitizeAndValidate()', () => {
    it('returns ok:true with sanitized value for clean input', () => {
      const result = s.sanitizeAndValidate('Hello & World')
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toBe('Hello &amp; World')
    })

    it('returns ok:false with SANITIZATION_REJECTED for <script> input', () => {
      const result = s.sanitizeAndValidate('<script>alert(1)</script>')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('SANITIZATION_REJECTED')
        expect(result.error.message).toMatch(/disallowed/i)
      }
    })

    it('returns ok:false with SANITIZATION_REJECTED for onerror= input', () => {
      const result = s.sanitizeAndValidate('onerror=alert(1)')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('SANITIZATION_REJECTED')
    })

    it('returns ok:false with SANITIZATION_REJECTED for javascript: URI', () => {
      const result = s.sanitizeAndValidate('javascript:void(0)')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('SANITIZATION_REJECTED')
    })

    it('returns ok:false for entity-encoded XSS variant', () => {
      const result = s.sanitizeAndValidate('&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('SANITIZATION_REJECTED')
    })

    it('returns ok:true for empty string', () => {
      const result = s.sanitizeAndValidate('')
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toBe('')
    })

    it('sanitized output contains no unescaped < > " \'', () => {
      const result = s.sanitizeAndValidate('Hello <World> "test" \'foo\' a&b')
      expect(result.ok).toBe(true)
      if (result.ok) {
        const out = result.value
        // The output should not contain raw < > " ' characters.
        // & is allowed because it appears as part of entity sequences (&amp;, &lt;, etc.)
        expect(out).not.toMatch(/[<>"']/)
        // Verify the & only appears as the start of entity sequences
        expect(out.replace(/&(?:amp|lt|gt|quot|#x27);/g, '')).not.toContain('&')
      }
    })
  })
})
