# Asset Grabber 🌐

A powerful, fast, and configurable CLI tool to download **all assets** from any website to your local machine — images, fonts, stylesheets, scripts, videos, audio, documents, and more.

---

## Features

- **🔍 Deep extraction** — parses HTML attributes, inline styles, CSS `url()`, `@import`, `srcset`, meta tags, and preload hints.
- **🎨 CSS deep-dive** — fetches external CSS files and extracts nested `url()` references (fonts, background images, etc.).
- **🕷 Multi-page crawl** — optionally follows internal links to grab assets across the entire website.
- **⚡ Concurrent downloads** — configurable parallelism for fast, optimized bulk downloads.
- **🔁 Robust retry logic** — automatically retries failed downloads with exponential back-off.
- **⏭ Intelligent resume** — automatically skips already-downloaded files, making it safe to pause and re-run.
- **🗂 Organized output** — mirrors the website's structure: `<outDir>/<hostname>/<path>`.
- **🔎 Dry-run mode** — list all assets to be downloaded without actually downloading them.
- **🎛 Type filtering** — target specific asset types like `image`, `font`, `style`, `script`, `video`, `audio`, `doc`, or `data`.
- **🌐 Same-domain filter** — restrict asset downloads to only those hosted on the target domain.
- **💬 Interactive mode** — launch the tool without arguments to run through a guided setup.

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/asset-grabber.git
   cd asset-grabber
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Link the package globally to use the `grab` command from anywhere:
   ```bash
   npm link
   ```

---


## Usage

If installed globally or linked:
```bash
grab <url> [options]
```

Or run directly with Node:
```bash
node src/index.js <url> [options]
```

Or use interactively:
```bash
grab
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --out <dir>` | Output directory | `./grabbed` |
| `-t, --types <types>` | Comma-separated types: `image,style,script,font,video,audio,doc,data,other` | `all` |
| `-c, --concurrency <n>` | Max parallel downloads | `8` |
| `--same-domain` | Only grab assets hosted on the target domain | `false` |
| `--crawl-pages` | Follow internal HTML links to grab assets from other pages | `false` |
| `--max-pages <n>` | Max pages to crawl when `--crawl-pages` is active | `20` |
| `--no-deep-css` | Disable deep extraction of `url()` from CSS files | (enabled) |
| `--timeout <ms>` | Network request timeout in milliseconds | `20000` |
| `--retries <n>` | Retry count for failed downloads | `2` |
| `-v, --verbose` | Show every file result and progress info | `false` |
| `--dry-run` | List discovered assets without downloading them | `false` |

---

## Examples

```bash
# Grab everything from a site using interactive mode
grab

# Quick-grab all assets from a single page
grab https://example.com

# Grab only images and fonts to a custom output directory
grab https://example.com -o ./assets --types image,font

# Crawl all internal pages (up to 50) with high parallelism
grab https://example.com --crawl-pages --max-pages 50 -c 10

# Perform a dry-run to preview what assets will be fetched
grab https://example.com --same-domain --dry-run
```

---

## Output Structure

Assets are saved mirroring the remote website's directory structure, preventing conflicts and keeping things organized:

```
grabbed/
└── example.com/
    ├── css/
    │   └── main.css
    ├── fonts/
    │   └── inter.woff2
    ├── images/
    │   ├── hero.jpg
    │   └── logo.svg
    └── js/
        └── main.js
```

---

## Asset Types Detected

| Type | Extensions Detected |
|------|---------------------|
| `image` | `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `ico`, `avif`, `bmp`, `tiff` |
| `style` | `css` |
| `script` | `js`, `mjs`, `cjs` |
| `font` | `woff`, `woff2`, `ttf`, `otf`, `eot` |
| `video` | `mp4`, `webm`, `ogg`, `mov`, `avi` |
| `audio` | `mp3`, `wav`, `ogg`, `flac`, `aac`, `m4a` |
| `doc` | `pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx` |
| `data` | `json`, `xml`, `csv` |

## Disclaimer

> [!WARNING]
> **Legal Disclaimer:** This tool is intended for educational, testing, and personal archiving purposes only. Grabbing, copying, or using intellectual property or assets owned by others without explicit authorization, license, or permission may constitute copyright infringement or theft. The author is not responsible for how you use this software, and users assume all risks associated with downloading third-party assets.

## License

This project is licensed under a custom Personal Use Only License. See the [LICENSE](LICENSE) file for details.


