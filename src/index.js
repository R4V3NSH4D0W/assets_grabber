#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
import path from 'path';
import fsp from 'fs/promises';
import { URL } from 'url';
import readline from 'readline';
import ora from 'ora';
import chalk from 'chalk';

import { logger } from './logger.js';
import { crawl } from './crawler.js';
import { downloadAll } from './downloader.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// ─── Interactive Prompt Helpers ───────────────────────────────────────────────

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function promptOptions() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  logger.banner();
  console.log(chalk.bold('  Interactive mode — press Enter to accept defaults\n'));

  // ── URL ──
  let rawUrl;
  while (true) {
    rawUrl = (await ask(rl, chalk.cyan('  Paste URL  › '))).trim();
    if (!rawUrl) { console.log(chalk.red('  URL is required.')); continue; }
    if (!rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl;
    try { new URL(rawUrl); break; } catch (_) { console.log(chalk.red('  Invalid URL, try again.')); }
  }

  // ── Output dir ──
  const outRaw = (await ask(rl, chalk.cyan(`  Output dir  [./grabbed] › `))).trim();
  const out = outRaw || './grabbed';

  // ── Asset types ──
  console.log(chalk.dim('  Types: image, style, script, font, video, audio, doc, data, other'));
  const typesRaw = (await ask(rl, chalk.cyan('  Filter types [all] › '))).trim();

  // ── Crawl pages ──
  const crawlRaw = (await ask(rl, chalk.cyan('  Crawl internal pages? [y/N] › '))).trim().toLowerCase();
  const crawlPages = crawlRaw === 'y' || crawlRaw === 'yes';

  // ── Concurrency ──
  const concRaw = (await ask(rl, chalk.cyan('  Concurrency [8] › '))).trim();
  const concurrency = parseInt(concRaw, 10) || 8;

  // ── Same domain ──
  const sdRaw = (await ask(rl, chalk.cyan('  Same-domain assets only? [y/N] › '))).trim().toLowerCase();
  const sameDomain = sdRaw === 'y' || sdRaw === 'yes';

  rl.close();
  console.log();

  return { rawUrl, out, typesRaw: typesRaw || null, crawlPages, concurrency, sameDomain, interactiveFilter: !typesRaw };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('grab')
  .description('Download all assets from a website to your local machine')
  .version(pkg.version)
  .argument('[url]', 'Target website URL — omit to enter interactive mode')
  .option('-o, --out <dir>', 'Output directory', './grabbed')
  .option(
    '-t, --types <types>',
    'Comma-separated asset types to grab: image,style,script,font,video,audio,doc,data,other (default: all)',
  )
  .option('-c, --concurrency <n>', 'Max parallel downloads', '8')
  .option('--same-domain', 'Only download assets from the same domain', false)
  .option('--crawl-pages', 'Follow internal HTML links and grab from all pages', false)
  .option('--max-pages <n>', 'Max pages to crawl (requires --crawl-pages)', '20')
  .option('--no-deep-css', 'Disable deep CSS url() extraction')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '20000')
  .option('--retries <n>', 'Retry count for failed downloads', '2')
  .option('-v, --verbose', 'Show every file downloaded/skipped/failed', false)
  .option('--dry-run', 'List assets without downloading', false)
  .addHelpText(
    'after',
    `
${chalk.bold('Examples:')}
  ${chalk.cyan('grab')} https://example.com
  ${chalk.cyan('grab')} https://example.com -o ./my-assets --types image,font
  ${chalk.cyan('grab')} https://example.com --crawl-pages --max-pages 50 -c 10
  ${chalk.cyan('grab')} https://example.com --same-domain --dry-run
`,
  );

program.parse(process.argv);

let [rawUrl] = program.args;
const opts = program.opts();

// If no URL supplied, drop into interactive mode
const isInteractive = !rawUrl;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(0);
  return `${m}m ${s}s`;
}

function parseTypes(typesStr) {
  if (!typesStr) return null;
  return typesStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let interactiveFilter = false;

  // ── Interactive mode when no CLI URL given ────────────────────────────────
  if (isInteractive) {
    const answers = await promptOptions();
    rawUrl          = answers.rawUrl;
    opts.out        = answers.out;
    opts.types      = answers.typesRaw;
    opts.crawlPages = answers.crawlPages;
    opts.concurrency = String(answers.concurrency);
    opts.sameDomain  = answers.sameDomain;
    interactiveFilter = answers.interactiveFilter;
  } else {
    logger.banner();
  }

  // Validate URL
  let targetUrl;
  try {
    targetUrl = new URL(rawUrl).href;
  } catch (_) {
    logger.error(`Invalid URL: ${rawUrl}`);
    process.exit(1);
  }

  const outDir = path.resolve(opts.out);
  const types = parseTypes(opts.types);
  const concurrency = parseInt(opts.concurrency, 10);
  const timeout = parseInt(opts.timeout, 10);
  const retries = parseInt(opts.retries, 10);
  const maxPages = parseInt(opts.maxPages, 10);
  const deepCss = opts.deepCss !== false;

  logger.info(`Target  : ${chalk.white(targetUrl)}`);
  logger.info(`Output  : ${chalk.white(outDir)}`);
  logger.info(`Types   : ${chalk.white(types ? types.join(', ') : 'all')}`);
  logger.info(`Options : concurrency=${concurrency}, timeout=${timeout}ms, retries=${retries}`);
  if (opts.crawlPages) logger.info(`Crawling: up to ${maxPages} pages`);
  logger.blank();

  const startTime = Date.now();

  // ── Step 1: Crawl ──────────────────────────────────────────────────────────
  const spinner = ora({
    text: 'Analyzing page…',
    color: 'cyan',
  }).start();

  let assets;
  try {
    assets = await crawl(targetUrl, {
      types,
      sameDomain: opts.sameDomain,
      deepCss,
      crawlPages: opts.crawlPages,
      maxPages,
      timeout,
      ora: spinner,
    });
  } catch (err) {
    spinner.fail(`Crawl failed: ${err.message}`);
    process.exit(1);
  }

  spinner.succeed(
    `Found ${chalk.bold.green(assets.size)} asset(s) across ${
      opts.crawlPages ? `up to ${maxPages}` : '1'
    } page(s)`,
  );
  logger.blank();

  if (assets.size === 0) {
    logger.warn('No assets found. Try removing --types filter or --same-domain flag.');
    process.exit(0);
  }

  // ── Step 1.5: Interactive Asset Type Selection ──────────────────────────────
  if (interactiveFilter) {
    const byType = {};
    for (const { type } of assets.values()) {
      byType[type] = (byType[type] || 0) + 1;
    }

    const categories = Object.keys(byType).sort();
    console.log(chalk.bold('📦 Found Assets:'));
    categories.forEach((cat, i) => {
      console.log(`  ${chalk.cyan(i + 1)}. ${chalk.white(cat.padEnd(10))} (${byType[cat]} files)`);
    });
    console.log(`  ${chalk.cyan('A')}. ${chalk.white('All of them')}`);
    console.log();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const choice = (await ask(rl, chalk.bold.yellow('  Which categories to download? (e.g. 1,2 or A) › '))).trim().toUpperCase();
    rl.close();
    console.log();

    if (choice !== 'A' && choice !== '') {
      const selectedIndices = choice.split(',').map(s => parseInt(s.trim(), 10) - 1);
      const selectedTypes = selectedIndices.map(idx => categories[idx]).filter(Boolean);
      
      if (selectedTypes.length > 0) {
        logger.info(`Filtering for: ${chalk.white(selectedTypes.join(', '))}`);
        for (const [url, asset] of assets.entries()) {
          if (!selectedTypes.includes(asset.type)) {
            assets.delete(url);
          }
        }
        logger.info(`Remaining assets: ${chalk.bold.green(assets.size)}`);
        logger.blank();
      }
    }
  }

  // ── Step 2: Dry-run listing ────────────────────────────────────────────────
  if (opts.dryRun) {
    logger.info(chalk.bold('Dry-run mode — no files will be downloaded:\n'));
    const byType = {};
    for (const { url, type } of assets.values()) {
      (byType[type] = byType[type] || []).push(url);
    }
    for (const [type, urls] of Object.entries(byType)) {
      console.log(chalk.bold.cyan(`  [${type}] (${urls.length})`));
      urls.forEach(u => console.log(chalk.dim(`    ${u}`)));
    }
    logger.blank();
    logger.info('Run without --dry-run to download.');
    process.exit(0);
  }

  // ── Step 3: Ensure output directory ───────────────────────────────────────
  await fsp.mkdir(outDir, { recursive: true });

  // ── Step 4: Download ───────────────────────────────────────────────────────
  logger.info('Starting downloads…');
  logger.blank();

  const results = await downloadAll(assets, outDir, {
    concurrency,
    timeout,
    retries,
    verbose: opts.verbose,
  });

  // ── Step 5: Failure report ─────────────────────────────────────────────────
  if (results.failures.length > 0 && !opts.verbose) {
    logger.blank();
    logger.warn(`${results.failures.length} failed download(s):`);
    results.failures.slice(0, 10).forEach(f =>
      logger.error(`  ${f.url}\n     → ${f.error}`)
    );
    if (results.failures.length > 10) {
      logger.dim(`  … and ${results.failures.length - 10} more`);
    }
  }

  // ── Step 6: Summary ───────────────────────────────────────────────────────
  const elapsed = formatDuration(Date.now() - startTime);
  logger.summary({
    url: targetUrl,
    total: results.total,
    downloaded: results.downloaded,
    skipped: results.skipped,
    failed: results.failed,
    outDir,
    elapsed,
  });
}

main().catch(err => {
  logger.error(err.message);
  process.exit(1);
});
