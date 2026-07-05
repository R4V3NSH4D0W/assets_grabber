import axios from 'axios';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { URL } from 'url';
import pLimit from 'p-limit';
import mime from 'mime-types';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { logger } from './logger.js';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

/**
 * Converts an asset URL into a safe local file path within outDir.
 */
function urlToLocalPath(assetUrl, outDir) {
  const parsed = new URL(assetUrl);
  let pathname = parsed.pathname;

  // Decode percent-encoding
  try { pathname = decodeURIComponent(pathname); } catch (_) {}

  // Sanitize: remove leading slash, replace illegal chars
  pathname = pathname.replace(/^\//, '').replace(/[<>:"|?*]/g, '_');

  // If pathname is empty or ends with /, use index.html
  if (!pathname || pathname.endsWith('/')) {
    pathname = pathname + 'index.html';
  }

  // If there are query parameters, append a short hash of them to prevent overwriting
  if (parsed.search) {
    let hash = 0;
    const searchStr = parsed.search;
    for (let i = 0; i < searchStr.length; i++) {
      const char = searchStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hashStr = '_' + Math.abs(hash).toString(36);

    const ext = path.extname(pathname);
    if (ext) {
      pathname = pathname.slice(0, -ext.length) + hashStr + ext;
    } else {
      pathname = pathname + hashStr;
    }
  }

  // If no extension, guess from MIME or leave as-is
  const ext = path.extname(pathname);
  if (!ext) {
    // Try to get extension from content-type later; default to .bin
    pathname = pathname + '.bin';
  }

  return path.join(outDir, parsed.hostname, pathname);
}

/**
 * Downloads a single asset with retry logic.
 */
async function downloadAsset(assetUrl, outDir, options = {}) {
  const { timeout = 20000, retries = 2 } = options;
  const localPath = urlToLocalPath(assetUrl, outDir);

  // Skip if already exists (resume support)
  if (fs.existsSync(localPath)) {
    return { status: 'skipped', path: localPath };
  }

  await fsp.mkdir(path.dirname(localPath), { recursive: true });

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const urlObj = new URL(assetUrl);
      const headers = {
        ...DEFAULT_HEADERS,
        'Referer': urlObj.origin + '/',
        'Origin': urlObj.origin,
      };

      const response = await axios.get(assetUrl, {
        headers,
        timeout,
        responseType: 'arraybuffer',
        maxRedirects: 10,
        validateStatus: (s) => s < 400,
      });

      // Refine file extension from content-type if path has .bin
      let finalPath = localPath;
      if (finalPath.endsWith('.bin')) {
        const ct = response.headers['content-type'] || '';
        const guessedExt = mime.extension(ct.split(';')[0].trim());
        if (guessedExt) {
          finalPath = finalPath.replace(/\.bin$/, '.' + guessedExt);
        }
      }

      await fsp.writeFile(finalPath, Buffer.from(response.data));
      return { status: 'downloaded', path: finalPath, bytes: response.data.byteLength };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  return { status: 'failed', url: assetUrl, error: lastErr?.message };
}

/**
 * Downloads all assets in the map with concurrency limiting and a progress bar.
 */
export async function downloadAll(assets, outDir, options = {}) {
  const {
    concurrency = 5,
    timeout = 20000,
    retries = 2,
    verbose = false,
  } = options;

  const assetList = [...assets.values()];
  const total = assetList.length;

  const bar = new cliProgress.SingleBar({
    format:
      chalk.cyan(' {bar}') +
      ' {percentage}% | ' +
      chalk.green('{value}') + '/' + chalk.white('{total}') +
      ' | ⬇ ' + chalk.yellow('{task}'),
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
  });

  bar.start(total, 0, { task: 'Starting…' });

  const limit = pLimit(concurrency);
  let downloaded = 0, skipped = 0, failed = 0;
  const failures = [];

  const tasks = assetList.map(({ url, type }) =>
    limit(async () => {
      const shortUrl = url.length > 60 ? '…' + url.slice(-57) : url;
      bar.update(downloaded + skipped + failed, { task: shortUrl });

      const result = await downloadAsset(url, outDir, { timeout, retries });

      if (result.status === 'downloaded') {
        downloaded++;
        if (verbose) logger.success(`[${type}] ${shortUrl}`);
      } else if (result.status === 'skipped') {
        skipped++;
        if (verbose) logger.dim(`[skip] ${shortUrl}`);
      } else {
        failed++;
        failures.push({ url, error: result.error });
        if (verbose) logger.error(`[fail] ${shortUrl} — ${result.error}`);
      }

      bar.increment();
    })
  );

  await Promise.all(tasks);
  bar.stop();

  return { total, downloaded, skipped, failed, failures };
}
