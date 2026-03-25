# Overview

## Purpose

SugarStitch is a local-first Node/TypeScript scraper for fiber arts pattern websites. It is meant to support a few related workflows without forcing users into one style of use:

- scrape one known pattern page
- scrape many known pattern pages from a list
- start from a listing or archive page, discover child links, and scrape the discovered pattern pages
- preview extraction before saving files

The project supports both a command-line interface and a simple browser UI so the same scraping engine can be used by both technical and non-technical users.

## Current Feature Set

At a high level, SugarStitch now supports:

- CLI scraping
- local browser UI
- selector presets
- one-off selector overrides
- saved site profiles
- preview mode
- output directory selection
- discovery crawl mode
- crawl language filtering
- crawl pagination support for listing pages with regular paginated URLs
- duplicate detection by `sourceUrl`
- PDF and image downloading

## Core Architecture

The project is split into three main layers:

1. Shared scraping engine
   File: [`src/scraper.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/scraper.ts)

2. CLI wrapper
   File: [`src/index.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/index.ts)

3. Local browser UI
   File: [`src/server.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/server.ts)

The shared scraper owns the real behavior. The CLI and UI should stay as thin adapters around that logic.

## File Map

- [`src/scraper.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/scraper.ts)
  Shared types, selector presets, saved profile loading, preview logic, discovery crawl logic, pagination expansion, language filtering, page scraping, file downloads, and JSON append behavior.

- [`src/index.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/index.ts)
  CLI argument parsing, URL source handling, output path resolution, crawl option collection, and handoff into the shared scraper.

- [`src/server.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/server.ts)
  Small Node HTTP server that renders the HTML UI, handles preview/scrape form posts, manages loading-state UX, and returns result pages.

- [`sugarstitch.profiles.json`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/sugarstitch.profiles.json)
  Starter saved profile config file. The UI and CLI know how to load profiles from it by default.

- [`README.md`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/README.md)
  User-facing usage guide.

- [`CHANGELOG.md`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/CHANGELOG.md)
  Release-oriented change history.

- [`scripts/add-shebang.js`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/scripts/add-shebang.js)
  Adds a Node shebang to the built CLI entrypoint after TypeScript compilation.

- [`package.json`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/package.json)
  Package metadata, scripts, executable `bin` entry, and dependency definitions.

## Shared Scraper Responsibilities

The shared scraper currently handles:

- selector preset definitions
- selector override sanitization and merging
- saved site profile loading
- run strategy resolution
- URL normalization and deduplication
- preview extraction
- bounded discovery crawl
- crawl language filtering
- pagination seed expansion for listing pages
- image and PDF download handling
- output JSON loading and append behavior
- duplicate `sourceUrl` prevention

If a feature changes what SugarStitch actually scrapes or how it discovers pages, it should usually begin in [`src/scraper.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/scraper.ts).

## Selector System

The selector system has three layers:

1. Built-in preset
   Examples: `generic`, `wordpress`, `woocommerce`

2. Optional saved profile
   Loaded from a JSON config file and typically used for site-specific tuning

3. Optional one-off overrides
   Per-run selector overrides that replace only the fields provided

Resolution order:

- choose preset
- optionally load saved profile
- merge profile overrides
- merge one-off overrides last

That means:

- one-off overrides win over profile values
- profile values win over the base preset

## Preview Flow

Preview mode exists to answer:

“Before I download anything, what does SugarStitch think this page contains?”

The preview flow:

1. resolve preset/profile/override strategy
2. fetch the page HTML
3. run selector extraction
4. return title, description, materials, instructions, image URLs, and PDF URLs
5. do not write JSON
6. do not download assets

This is the safest way to validate selectors on a new site.

## Discovery Crawl Flow

Discovery crawl mode is for archive or listing pages where the real patterns live deeper in the site.

The crawl flow:

1. start from one or more seed URLs
2. optionally expand paginated listing pages
3. fetch page HTML
4. collect link targets from `a[href]`
5. resolve them to absolute URLs
6. optionally restrict to the same domain
7. optionally restrict by language
8. optionally filter by URL or link text pattern
9. stop at the configured depth and max-URL limits
10. pass the discovered URLs into the normal scrape flow

Important:

- crawl mode is intentionally bounded
- it is not meant to be a full general-purpose spider
- it is designed to help discover likely pattern pages from listing pages

## Crawl Language Filtering

Some sites expose multiple language sections from the same listing page. For example:

- English archive page
- French archive page
- Portuguese archive page

The crawler can now prefer one language when discovered URLs clearly indicate a language, either by query string or pathname conventions. This helps avoid mixing multiple language archives into a single run.

This is especially useful for sites like Tilda where a top-level page links to multiple language-specific pattern sections.

## Crawl Pagination Support

Some sites use a `Load More` interaction in the UI, but also expose those later batches as normal paginated URLs.

SugarStitch now supports pagination-aware crawl seeding:

- inspect the seed page for listing pagination hints
- detect max page counts where possible
- add `/page/2/`, `/page/3/`, and similar listing pages up to a configured cap
- continue crawl discovery from those expanded listing pages

This works well when the site exposes traditional archive pages even if the visual UI presents them as a load-more interaction.

## Output Model

Each successful page becomes a `PatternData` object with:

- `title`
- `description`
- `materials`
- `instructions`
- `sourceUrl`
- `localImages`
- `localPdfs`

Output behavior:

- JSON is appended to an output file
- duplicate `sourceUrl` entries are skipped before re-scraping
- downloaded images go into `images/<sanitized-title>/`
- downloaded PDFs go into `pdfs/<sanitized-title>/`
- all of that lives under the selected output directory

## UI Notes

The UI is intentionally simple and server-rendered.

Key design choices:

- no frontend framework
- HTML assembled on the server
- form-submit workflow instead of a client-side app
- loading overlay and spinner so long requests feel active
- result pages returned after preview or scrape completion

Why it is structured this way:

- easy to maintain
- easy to inspect
- minimal dependencies
- keeps most logic in the shared scraper instead of duplicated client code

## CLI Notes

The CLI acts as a thin adapter over the shared scraper. It currently handles:

- mutual exclusion of `--url` and `--file`
- URL list loading from files
- output path and output directory resolution
- crawl option parsing
- preview vs full scrape routing

If behavior is purely about command syntax or argument ergonomics, it belongs in [`src/index.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/index.ts).

## Result and Success Semantics

A “successful” scrape does not mean every field matched.

Examples of valid successful runs:

- title plus PDF download only
- title plus images only
- title, description, and article content with no PDF

This matters because some fiber arts sites store the actual pattern inside a PDF, while others use a blog-post layout with visible HTML content.

## Known Constraints

- selector quality is site-dependent
- some sites render important content with JavaScript after load
- browser security means the UI uses an output-directory path field rather than a native folder picker
- the crawler is bounded and heuristic-based, not exhaustive
- HTTPS certificate issues on some environments can affect preview or scrape runs against certain sites
- pagination support currently assumes the site exposes discoverable regular listing pages rather than a fully hidden API-only load-more flow

## Good Next Improvements

If development continues, strong candidates include:

- richer site-specific profile library
- selector test diagnostics showing which selector matched which field
- live streaming logs in the UI instead of request/response-only updates
- optional desktop wrapper if native folder selection becomes important
- export options beyond JSON
- more explicit crawl diagnostics for why a URL was followed or skipped
- support for sites whose load-more behavior only exists through AJAX or browser interaction

## Development Workflow

### Build

```bash
npm run build
```

### Run CLI

```bash
npm run scrape -- --url "https://example.com/pattern"
```

### Run UI

```bash
npm run ui
```

## Common Places To Edit

If scraping quality is the issue:
- edit [`src/scraper.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/scraper.ts)

If CLI behavior is the issue:
- edit [`src/index.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/index.ts)

If UI workflow or local-browser UX is the issue:
- edit [`src/server.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/server.ts)

If site-specific defaults are the issue:
- edit [`sugarstitch.profiles.json`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/sugarstitch.profiles.json)
