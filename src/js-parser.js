import { URL } from 'url';

// Known asset extensions to look for inside JS
const ASSET_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif', '.bmp', '.tiff',
  '.mp4', '.webm', '.ogg', '.mov',
  '.mp3', '.wav', '.flac', '.aac', '.m4a',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.json', '.xml', '.csv',
  '.gltf', '.glb', '.obj', '.fbx', '.stl', '.dae', '.exr',
  '.css', // occasionally referenced in JS
];

// Matches any quoted or template-literal string that ends in a known asset extension
// Handles:  "/images/foo.jpg"  |  '/fonts/bar.woff2'  |  `/images/${x}.png`  (skips the dynamic ones)
const ASSET_STRING_RE = /['"`]([^'"`\s\n\r]{2,300}\.(?:jpe?g|png|gif|webp|svg|ico|avif|bmp|tiff|mp4|webm|ogg|mov|mp3|wav|flac|aac|m4a|woff2?|ttf|otf|eot|pdf|json|xml|csv|gltf|glb|obj|fbx|stl|dae|exr))['"`]/gi;

// Catch common resource directories and short-hand texture patterns (like _c, _n, _m)
const FOLDER_ASSET_RE = /['"`]((?:models|images|assets|k_txts|w_txts)\/[^'"`\s\n\r]{1,300}(?:\.[a-z0-9]+)?)/gi;

// URL(...) inside JS strings
const JS_URL_RE = /url\(['"`]?([^'"`)\s]+)['"`]?\)/gi;

/**
 * Extracts all asset URLs referenced as string literals in a JS file.
 * @param {string} jsText   Raw JS source text
 * @param {string} baseUrl  URL of the JS file itself (for resolving relative paths)
 * @returns {string[]}      Resolved absolute asset URLs
 */
export function extractJsAssets(jsText, baseUrl) {
  const found = new Set();

  const add = (raw) => {
    if (!raw || raw.includes('${') || raw.startsWith('data:') || raw.startsWith('blob:')) return;
    // Must start with / or http to be an actual path, not a regex or identifier
    if (!raw.startsWith('/') && !raw.startsWith('http') && !raw.startsWith('./') && !raw.startsWith('../')) return;
    try {
      found.add(new URL(raw.trim(), baseUrl).href);
    } catch (_) {}
  };

  let m;

  ASSET_STRING_RE.lastIndex = 0;
  while ((m = ASSET_STRING_RE.exec(jsText)) !== null) {
    add(m[1]);
  }

  FOLDER_ASSET_RE.lastIndex = 0;
  while ((m = FOLDER_ASSET_RE.exec(jsText)) !== null) {
    add(m[1]);
  }

  JS_URL_RE.lastIndex = 0;
  while ((m = JS_URL_RE.exec(jsText)) !== null) {
    add(m[1]);
  }

  return [...found];
}
