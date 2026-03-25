# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project currently tracks releases in a simple manual format.

## [1.0.0] - 2026-03-25

### Added

- Initial public CLI for scraping fiber arts pattern pages into local JSON, image, and PDF files
- Plain-text pattern artifacts saved under `texts/<pattern_title>/pattern.txt` for each scraped page
- README improvements covering installation, usage, selector discovery, troubleshooting, and output structure
- MIT license
- A simple local web UI with a mode dropdown, URL inputs, output field, summary view, and run log
- A shared scraper module so the CLI and UI use the same scraping engine
- Built-in selector presets for generic pages, WordPress posts, and WooCommerce product pages
- Advanced per-run selector overrides for title, description, materials, instructions, and images
- Saved site profiles loaded from a JSON config file
- Preview mode for testing selectors before a full scrape
- Discovery crawl mode for following links from a listing page and scraping discovered child pages
- Output directory support for both the CLI and local UI
- In-page loading feedback with a spinner/progress overlay in the local UI
- `OVERVIEW.md` with a technical and development-oriented guide to the project
- Crawl language filtering to keep discovered URLs focused on one language
- Crawl pagination support for paginated listing pages and load-more style archives that expose regular page URLs

### Changed

- Broadened user-facing project wording from sewing-specific language to fiber arts language so the docs and CLI better reflect crochet, knitting, sewing, and related pattern sites
- Corrected the CLI version string to `1.0.0`
- Wired the package up as a real executable CLI with a `bin` entry and a post-build shebang step
- Improved CLI option placeholders to use clearer argument names
- Refactored the scraping logic out of the CLI entrypoint and into reusable shared code
- Added preset-aware selector matching so the CLI and UI can switch site strategies without code edits
- Added field-level selector overrides so users can adjust only the parts a preset misses
- Added reusable profile resolution so presets and overrides can be saved and reused across runs
- Added preview flows in both the CLI and the local UI
- Added early validation so `--url` and `--file` cannot be used together
- Added URL normalization and validation for single URL and batch file input
- Added URL deduplication for batch mode
- Added image and PDF URL deduplication before download
- Added request timeouts for page fetches and file downloads
- Improved filename sanitization with a stable fallback for empty titles
- Changed duplicate handling so previously scraped `sourceUrl` entries are skipped before network work begins
- Made output loading safer by surfacing invalid JSON instead of silently overwriting it
- Improved result messaging so PDF-only or partial-content matches are clearer in the UI
- Expanded the README to document crawl mode, output directories, profiles, preview flow, and UI behavior
- Expanded crawl controls in both the CLI and UI to include language and pagination tuning

### Fixed

- Prevented accidental re-scraping of URLs already present in the output JSON
- Reduced duplicate asset downloads caused by repeated image or PDF links on a page
