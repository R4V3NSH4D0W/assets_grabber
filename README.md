# Asset Grabber 🌐

A powerful CLI tool to download **all assets** from any website to your local machine — images, fonts, stylesheets, scripts, videos, audio, documents, and more.

---

## Features

- **🔍 Deep extraction** — parses HTML attributes, inline styles, CSS `url()`, `@import`, `srcset`, meta tags, and preload hints
- **🎨 CSS deep-dive** — fetches external CSS files and extracts nested `url()` references (fonts, background images, etc.)
- **🕷 Multi-page crawl** — optionally follows internal links and grabs assets from all pages
- **⚡ Concurrent downloads** — configurable parallelism for fast bulk downloads
- **🔁 Retry logic** — automatically retries failed downloads with exponential back-off
- **⏭ Resume support** — skips already-downloaded files, safe to re-run
- **🗂 Organized output** — mirrors site structure: `<outDir>/<hostname>/<path>`
- **🔎 Dry-run mode** — list all assets without downloading anything
- **🎛 Type filtering** — grab only `image`, `font`, `style`, `script`, `video`, `audio`, `doc`, or `data`
- **🌐 Same-domain filter** — restrict to assets hosted on the target domain only

---

## Installation

```bash
npm install
```

---

## Usage

```bash
node src/index.js <url> [options]
```

Or after `npm link`:

```bash
grab <url> [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --out <dir>` | Output directory | `./grabbed` |
| `-t, --types <types>` | Comma-separated types: `image,style,script,font,video,audio,doc,data,other` | all |
| `-c, --concurrency <n>` | Max parallel downloads | `8` |
| `--same-domain` | Only assets from the same domain | `false` |
| `--crawl-pages` | Follow internal HTML links | `false` |
| `--max-pages <n>` | Max pages when crawling | `20` |
| `--no-deep-css` | Disable deep CSS `url()` extraction | (enabled) |
| `--timeout <ms>` | Request timeout in ms | `20000` |
| `--retries <n>` | Retry count for failures | `2` |
| `-v, --verbose` | Show every file result | `false` |
| `--dry-run` | List assets without downloading | `false` |

---

## Examples

```bash
# Grab everything from a site
node src/index.js https://example.com

# Only images and fonts, custom output dir
node src/index.js https://example.com -o ./assets --types image,font

# Crawl all internal pages (up to 50), 10 parallel downloads
node src/index.js https://example.com --crawl-pages --max-pages 50 -c 10

# Only same-domain assets, dry-run first
node src/index.js https://example.com --same-domain --dry-run

# Verbose output to see every file
node src/index.js https://example.com -v
```

---

## Output Structure

Assets are saved mirroring the remote path:

```
grabbed/
└── example.com/
    ├── images/
    │   ├── hero.jpg
    │   └── logo.svg
    ├── fonts/
    │   └── inter.woff2
    └── css/
        └── main.css
```

---

## Asset Types Detected

| Type | Extensions |
|------|------------|
| `image` | jpg, jpeg, png, gif, webp, svg, ico, avif, bmp, tiff |
| `style` | css |
| `script` | js, mjs, cjs |
| `font` | woff, woff2, ttf, otf, eot |
| `video` | mp4, webm, ogg, mov, avi |
| `audio` | mp3, wav, ogg, flac, aac, m4a |
| `doc` | pdf, doc, docx, xls, xlsx, ppt, pptx |
| `data` | json, xml, csv |
# assets_grabber
