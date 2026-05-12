import * as cheerio from 'cheerio';
import { parse as parseCss } from './css-parser.js';
import { URL } from 'url';

// All HTML attributes that reference external assets
const ASSET_ATTRS = {
  img:    ['src', 'srcset', 'data-src', 'data-srcset'],
  script: ['src'],
  link:   ['href'],
  source: ['src', 'srcset'],
  video:  ['src', 'poster'],
  audio:  ['src'],
  track:  ['src'],
  embed:  ['src'],
  object: ['data'],
  input:  ['src'],
  use:    ['href', 'xlink:href'],
  image:  ['href', 'xlink:href'],  // SVG <image>
};

// Asset type classification by extension
const EXT_CATEGORIES = {
  image:  ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif', '.bmp', '.tiff'],
  style:  ['.css'],
  script: ['.js', '.mjs', '.cjs'],
  font:   ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
  video:  ['.mp4', '.webm', '.ogg', '.mov', '.avi'],
  audio:  ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
  doc:    ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  data:   ['.json', '.xml', '.csv'],
};

function classify(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.substring(pathname.lastIndexOf('.'));
    for (const [cat, exts] of Object.entries(EXT_CATEGORIES)) {
      if (exts.includes(ext)) return cat;
    }
  } catch (_) {}
  return 'other';
}

function resolveUrl(base, raw) {
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return null;
  try {
    return new URL(raw.trim(), base).href;
  } catch (_) {
    return null;
  }
}

function parseSrcset(srcsetStr) {
  return srcsetStr
    .split(',')
    .map(entry => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/**
 * Extracts all asset URLs from raw HTML.
 * @param {string} html
 * @param {string} baseUrl
 * @param {object} options - { types, sameDomain }
 * @returns {Map<string, { url, type }>}
 */
export function extractAssets(html, baseUrl, options = {}) {
  const { types = null, sameDomain = false } = options;
  const origin = new URL(baseUrl).origin;
  const assets = new Map();

  const add = (rawUrl) => {
    const resolved = resolveUrl(baseUrl, rawUrl);
    if (!resolved) return;
    if (sameDomain && !resolved.startsWith(origin)) return;
    if (assets.has(resolved)) return;
    const type = classify(resolved);
    if (types && !types.includes(type)) return;
    assets.set(resolved, { url: resolved, type });
  };

  const $ = cheerio.load(html);

  // Scan all known HTML attributes
  for (const [tag, attrs] of Object.entries(ASSET_ATTRS)) {
    $(tag).each((_, el) => {
      for (const attr of attrs) {
        const val = $(el).attr(attr);
        if (!val) continue;
        if (attr.includes('srcset')) {
          parseSrcset(val).forEach(add);
        } else {
          add(val);
        }
      }
    });
  }

  // Inline <style> blocks
  $('style').each((_, el) => {
    const css = $(el).html() || '';
    parseCss(css, baseUrl).forEach(add);
  });

  // style="..." attributes
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    parseCss(style, baseUrl).forEach(add);
  });

  // Meta tags (og:image, twitter:image, etc.)
  $('meta[content]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name') || '';
    if (prop.includes('image') || prop.includes('url')) {
      add($(el).attr('content'));
    }
  });

  // Linked external CSS files — add their URL as a style asset
  // (their contents are fetched later for deeper CSS url() extraction)
  $('link[rel="stylesheet"]').each((_, el) => {
    add($(el).attr('href'));
  });

  // Preload / prefetch hints
  $('link[rel="preload"], link[rel="prefetch"]').each((_, el) => {
    add($(el).attr('href'));
  });

  return assets;
}

/**
 * Extracts asset URLs from a CSS string (url(...) declarations).
 */
export function extractCssAssets(cssText, baseUrl) {
  return parseCss(cssText, baseUrl);
}
