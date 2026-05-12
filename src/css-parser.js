import { URL } from 'url';

// Match url(...) in CSS — handles quotes and no-quotes
const CSS_URL_RE = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;
// Match @import "..." or @import url(...)
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*['"]?([^'")\s]+)['"]?\s*\)|['"]([^'"]+)['"])/gi;

/**
 * Extracts all referenced URLs from a CSS string.
 * @param {string} css
 * @param {string} baseUrl
 * @returns {string[]}
 */
export function parse(css, baseUrl) {
  const found = new Set();

  const add = (raw) => {
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('#')) return;
    try {
      found.add(new URL(raw.trim(), baseUrl).href);
    } catch (_) {}
  };

  let match;

  // url(...) references
  CSS_URL_RE.lastIndex = 0;
  while ((match = CSS_URL_RE.exec(css)) !== null) {
    add(match[2]);
  }

  // @import references
  CSS_IMPORT_RE.lastIndex = 0;
  while ((match = CSS_IMPORT_RE.exec(css)) !== null) {
    add(match[1] || match[2]);
  }

  return [...found];
}
