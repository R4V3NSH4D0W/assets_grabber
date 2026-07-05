import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import puppeteer from 'puppeteer';
import { extractAssets, extractCssAssets } from './extractor.js';
import { extractJsAssets } from './js-parser.js';
import { logger } from './logger.js';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

/**
 * Fetches a URL and returns { data, contentType, status }
 */
async function fetchUrl(url, timeout = 15000) {
  const response = await axios.get(url, {
    headers: DEFAULT_HEADERS,
    timeout,
    responseType: 'arraybuffer',
    maxRedirects: 10,
    validateStatus: (s) => s < 400,
  });
  const contentType = response.headers['content-type'] || '';
  return { data: response.data, contentType, status: response.status };
}

/**
 * Main crawler: fetches the target page (and optionally linked pages),
 * extracts all asset URLs, optionally deep-parses CSS for nested url() refs.
 *
 * @param {string} targetUrl
 * @param {object} options
 * @returns {Map<string, { url, type }>}
 */
export async function crawl(targetUrl, options = {}) {
  const {
    types = null,
    sameDomain = false,
    deepCss = true,
    deepJs = true,   // ← new: scan JS bundles for asset strings
    crawlPages = false,
    maxPages = 10,
    timeout = 15000,
    ora,
  } = options;

  const visited = new Set();
  const queue = [targetUrl];
  const allAssets = new Map();
  let pagesVisited = 0;

  const baseOrigin = new URL(targetUrl).origin;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (err) {
    logger.warn(`Could not launch headless browser: ${err.message}. Falling back to standard HTTP requests.`);
  }

  try {
    while (queue.length > 0 && pagesVisited < maxPages) {
      const pageUrl = queue.shift();
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);
      pagesVisited++;

      if (ora) {
        ora.text = `Crawling page ${pagesVisited}: ${pageUrl}`;
      } else {
        logger.info(`Crawling: ${pageUrl}`);
      }

      let html;
      let fetchedWithBrowser = false;

      if (browser) {
        try {
          const page = await browser.newPage();
          await page.setUserAgent(DEFAULT_HEADERS['User-Agent']);
          await page.setDefaultNavigationTimeout(timeout);

          const response = await page.goto(pageUrl, {
            waitUntil: 'networkidle2',
            timeout,
          });

          const status = response ? response.status() : 200;
          const headers = response ? response.headers() : {};
          const contentType = headers['content-type'] || '';

          if (status >= 400) {
            throw new Error(`Status code ${status}`);
          }

          if (contentType && !contentType.includes('text/html')) {
            await page.close();
            continue;
          }

          html = await page.content();
          fetchedWithBrowser = true;
          await page.close();
        } catch (err) {
          logger.warn(`Browser fetch failed for ${pageUrl}: ${err.message}. Falling back to standard HTTP request.`);
        }
      }

      if (!fetchedWithBrowser) {
        try {
          const { data, contentType } = await fetchUrl(pageUrl, timeout);
          if (!contentType.includes('text/html')) continue;
          html = Buffer.from(data).toString('utf-8');
        } catch (err) {
          logger.warn(`Could not fetch page: ${pageUrl} — ${err.message}`);
          continue;
        }
      }

      // Extract assets from this page
      const pageAssets = extractAssets(html, pageUrl, { types, sameDomain });
      for (const [url, asset] of pageAssets) {
        if (!allAssets.has(url)) allAssets.set(url, asset);
      }

      // Deep CSS parsing: fetch each .css file and extract url() from it
      if (deepCss) {
        const cssAssets = [...pageAssets.values()].filter(a => a.type === 'style');
        for (const cssAsset of cssAssets) {
          try {
            const { data, contentType } = await fetchUrl(cssAsset.url, timeout);
            if (!contentType.includes('css') && !contentType.includes('text')) continue;
            const cssText = Buffer.from(data).toString('utf-8');
            const nested = extractCssAssets(cssText, cssAsset.url);
            for (const nUrl of nested) {
              if (!allAssets.has(nUrl)) {
                allAssets.set(nUrl, { url: nUrl, type: 'css-asset' });
              }
            }
          } catch (_) {
            // Silently skip CSS fetch failures
          }
        }
      }

      // Deep JS parsing: fetch every script bundle and scan for asset string literals
      if (deepJs) {
        const scriptAssets = [...pageAssets.values()].filter(a => a.type === 'script');
        for (const scriptAsset of scriptAssets) {
          try {
            const { data, contentType } = await fetchUrl(scriptAsset.url, timeout);
            if (!contentType.includes('javascript') && !contentType.includes('text')) continue;
            const jsText = Buffer.from(data).toString('utf-8');
            const nested = extractJsAssets(jsText, new URL(targetUrl).origin);
            for (const nUrl of nested) {
              if (!allAssets.has(nUrl)) {
                const ext = nUrl.split('.').pop().toLowerCase().split('?')[0];
                const type =
                  ['jpg','jpeg','png','gif','webp','svg','ico','avif','bmp','tiff'].includes(ext) ? 'image' :
                  ['woff','woff2','ttf','otf','eot'].includes(ext) ? 'font' :
                  ['mp4','webm','ogg','mov'].includes(ext) ? 'video' :
                  ['mp3','wav','flac','aac','m4a'].includes(ext) ? 'audio' :
                  ['gltf','glb','obj','fbx','stl','dae','exr'].includes(ext) ? 'model' : 'js-asset';
                allAssets.set(nUrl, { url: nUrl, type });
              }
            }

            // --- Katana Texture Hunter ---
            const origin = new URL(targetUrl).origin;
            const prefixes = [
              'Katana_and_sheath_M_Katana',
              'Katana_and_sheath_M_Sheath',
              'Katana_and_Sheath_M_Katana',
              'Katana_and_Sheath_M_Sheath',
              'M_Katana',
              'M_Sheath'
            ];
            const types = ['BaseColor', 'Metallic', 'Normal', 'Roughness', 'Height'];
            
            for (const p of prefixes) {
              for (const t of types) {
                const texUrl = `${origin}/models/k_txts/${p}_${t}.1001.jpg`;
                if (!allAssets.has(texUrl)) {
                  allAssets.set(texUrl, { url: texUrl, type: 'image' });
                }
              }
            }
          } catch (_) {
            // Silently skip JS fetch failures
          }
        }
      }

      // If crawling multiple pages, queue same-domain HTML links
      if (crawlPages) {
        const $ = cheerio.load(html);
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          try {
            const resolved = new URL(href, pageUrl).href;
            if (
              resolved.startsWith(baseOrigin) &&
              !visited.has(resolved) &&
              !resolved.includes('#') &&
              !resolved.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|tar|gz|css|js|woff|ttf)(\?|$)/i)
            ) {
              queue.push(resolved);
            }
          } catch (_) {}
        });
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return allAssets;
}

