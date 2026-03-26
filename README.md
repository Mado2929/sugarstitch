<p align="center">
  <img src="assets/logo.png" alt="SugarStitch logo" width="300" height="300" />
</p>

# SugarStitch

SugarStitch is a TypeScript scraper for fiber arts pattern websites with both a CLI and a local browser UI. It can scrape individual pattern pages, batch lists of URLs, or discover pattern pages from an index page and then scrape those discovered links for titles, text, images, and PDFs.

## Screenshots

### Local UI

![SugarStitch homepage UI](website/public/screenshot_homepage.png)

![SugarStitch scraping progress state](website/public/screenshot_scraping.png)

![SugarStitch completed run summary](website/public/screenshot_completed.png)

### CLI

![SugarStitch CLI](website/public/screenshot_cli.png)

## What It Does

- Scrapes a single pattern URL or a list of URLs from a text file
- Includes a simple local browser UI for people who prefer forms over command-line flags
- Supports discovery crawl mode so one listing page can expand into many pattern pages
- Supports crawl language filtering so discovered pages can stay in one language
- Supports crawl pagination so listing pages like `/page/2/` and `/page/3/` can be added automatically
- Includes built-in selector presets for `generic`, `wordpress`, and `woocommerce`
- Supports reusable saved site profiles from a JSON config file
- Lets you override title, description, materials, instructions, and image selectors per run
- Includes a preview mode to test selectors before downloading files or writing JSON
- Lets you choose an output directory for the JSON file plus downloaded assets
- Shows an in-page loading state while preview or scrape requests are running
- Downloads linked PDFs and page images when found
- Skips already-known `sourceUrl` entries before re-scraping them

## Best Supported Site Types

SugarStitch works best on sites where the pattern content is already present in the HTML response and does not require a JavaScript app to render first.

Typical use cases include:

- sewing pattern blogs
- crochet pattern pages
- knitting pattern archives
- quilting, embroidery, and other fiber arts tutorial or pattern sites

Usually a good fit:

- WordPress pattern blogs and article pages
- Blogger and Blogspot pattern pages
- WooCommerce product-style pattern pages
- older handcrafted sites with normal HTML articles
- free-pattern archive pages that link to regular child pages

More mixed or site-specific:

- Wix
- Squarespace
- Webflow
- custom JavaScript-heavy sites

Usually not a good fit with the current scraper approach:

- React single-page apps
- hash-routed sites like `#/free-patterns`
- pages where the content only appears after client-side JavaScript runs

Why:

SugarStitch currently fetches page HTML and parses it directly. It does not run a full browser-rendered scraping flow yet, so JavaScript-only pages may return just the site shell instead of the real pattern content.

If a site only partly works, try:

- switching selector presets
- using `Test Selectors` first
- creating a saved site profile
- adding one or two advanced selector overrides

## Install

### Global Install

```bash
npm install -g @pinkpixel/sugarstitch
```

Then run it as:

```bash
sugarstitch --url "https://example.com/pattern"
```

### Local Development Install

```bash
git clone https://github.com/pinkpixel-dev/sugarstitch.git
cd sugarstitch
npm install
```

## Available Scripts

```bash
npm run build
```

Compiles TypeScript into `dist/`.

```bash
npm run scrape -- --url "https://example.com/pattern"
```

Runs the CLI with `ts-node`.

```bash
npm run ui
```

Starts the local UI at `http://localhost:4177`.

## Quick Start

### Scrape One Pattern Page

```bash
npm run scrape -- --url "https://example.com/pattern" --preset wordpress
```

### Scrape Many URLs From a File

Create `urls.txt`:

```txt
https://example.com/pattern-1
https://example.com/pattern-2
https://example.com/pattern-3
```

Then run:

```bash
npm run scrape -- --file urls.txt
```

### Save Output Somewhere Else

```bash
npm run scrape -- --url "https://example.com/pattern" --output-dir ./exports --output patterns.json
```

That saves:

- `patterns.json`
- `images/`
- `pdfs/`
- `texts/`

inside `./exports`.

## Discovery Crawl Mode

Discovery crawl mode is for index pages such as “Free Patterns” pages. Instead of entering every pattern URL yourself, you can start from one page and let SugarStitch follow links a couple levels deep before scraping the discovered pages.

This is useful for:

- free-pattern listing pages
- archive pages
- blog category pages
- collections where the real pattern content lives on child pages

### Example

```bash
npm run scrape -- \
  --url "https://www.tildasworld.com/free-patterns/" \
  --preset wordpress \
  --crawl \
  --crawl-depth 2 \
  --crawl-pattern "free_pattern|pattern|quilt|pillow" \
  --crawl-language english \
  --crawl-paginate
```

That tells SugarStitch to:

1. Start from the given listing page
2. Follow matching links up to 2 levels deep
3. Stay on the same domain by default
4. Scrape the discovered pages themselves

So if a child page is a blog-style pattern page with no PDF but useful article content, SugarStitch will still try to scrape that page normally.

### Crawl Options

- `--crawl`: turns discovery mode on
- `--crawl-depth <number>`: how many link levels deep to follow
- `--crawl-pattern <pattern>`: only follow links whose URL or link text matches this text or regex
- `--crawl-language <language>`: prefer discovered URLs for one language such as `english`, `french`, or `portuguese`
- `--crawl-paginate`: expand paginated listing pages like `/page/2/`, `/page/3/`, and so on
- `--crawl-max-pages <number>`: cap how many listing pages are added in pagination mode
- `--crawl-any-domain`: allow discovery to follow links outside the starting domain
- `--crawl-max-urls <number>`: cap how many discovered pages get scraped

### Why Crawl Language Filtering Helps

Some sites expose multiple language sections from the same listing page. For example, an English archive may also link to French or Portuguese archives. With `--crawl-language english`, SugarStitch can keep the discovered crawl focused on English pages instead of mixing languages into one run.

### Why Crawl Pagination Helps

Some listing pages only expose the first batch of pattern cards until you click a `Load More` control. If the site also exposes those later batches as regular paginated URLs, SugarStitch can add those deeper listing pages automatically before discovery continues.

## Local Web UI

Run:

```bash
npm run ui
```

Then open:

```text
http://localhost:4177
```

![SugarStitch homepage showing the scrape form and saved profiles](website/public/screenshot_homepage.png)

The UI includes:

- single URL mode
- multi-URL paste mode
- saved site profile dropdown
- selector preset dropdown
- advanced selector override fields
- discovery crawl controls
- crawl language and crawl pagination controls
- output JSON filename field
- output directory field
- `Test Selectors` preview button
- `Start Scraping` button
- light and dark mode toggle
- spinner/progress overlay while requests are running

![SugarStitch progress overlay while a scrape is running](website/public/screenshot_scraping.png)

![SugarStitch completed run summary with log output](website/public/screenshot_completed.png)

### Output Directory In the UI

Use the `Output Directory` field to choose where the JSON file and downloaded folders should be saved.

If left blank, SugarStitch saves into the project folder you launched it from.

Note:
This is currently a path field, not a native folder picker. In a normal browser-based local UI, the page cannot reliably hand a true local filesystem path back to the server the way a desktop app can.

## Selector Presets

Selector presets are defined in [`src/scraper.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/scraper.ts).

Built-in presets:

- `generic`: a broad fallback for custom and article-style pages
- `wordpress`: tuned for common WordPress post wrappers like `.entry-content`
- `woocommerce`: tuned for WooCommerce product pages and galleries

These are starting points, not guarantees.

## Advanced Selector Overrides

If a preset is close but not quite right, you can override only the fields you need for a single run.

Available override flags:

- `--title-selector`
- `--description-selector`
- `--materials-selector`
- `--instructions-selector`
- `--image-selector`

Example:

```bash
npm run scrape -- \
  --url "https://example.com/pattern" \
  --preset wordpress \
  --materials-selector ".entry-content ul li"
```

Overrides take priority over the selected preset for that field only.

## Saved Site Profiles

SugarStitch can load reusable profiles from [`sugarstitch.profiles.json`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/sugarstitch.profiles.json).

Each profile can define:

- `id`
- `label`
- `description`
- `preset`
- `selectorOverrides`

Example:

```json
{
  "profiles": [
    {
      "id": "tildas-world",
      "label": "Tilda's World",
      "preset": "wordpress",
      "selectorOverrides": {
        "materialsSelector": ".entry-content ul li",
        "instructionsSelector": ".entry-content ol li"
      }
    }
  ]
}
```

Use one with:

```bash
npm run scrape -- --url "https://example.com/pattern" --profile tildas-world
```

Or point to another file:

```bash
npm run scrape -- --url "https://example.com/pattern" --profile tildas-world --profiles-file ./my-profiles.json
```

## Preview Mode

Preview mode lets you test extraction before writing JSON or downloading files.

It:

- fetches the page
- applies the selected preset, saved profile, and any advanced overrides
- shows the matched title, description, materials, instructions, images, and PDFs
- does not write files

CLI example:

```bash
npm run scrape -- --url "https://example.com/pattern" --profile tildas-world --preview
```

UI flow:

1. Choose `Single URL`
2. Enter a pattern page URL
3. Pick a preset or saved profile
4. Add overrides if needed
5. Click `Test Selectors`

## CLI Options

```text
-u, --url <url>                     A single URL of the pattern page to scrape
-f, --file <file>                   A text file containing a list of URLs
-o, --output <path>                 Output JSON file name
--output-dir <path>                 Directory where JSON, images, and PDFs should be saved
-p, --preset <preset>               Selector preset
--crawl                             Discover links from the starting URL(s) before scraping them
--crawl-depth <number>              How many link levels deep to follow in crawl mode
--crawl-pattern <pattern>           Only follow discovered links whose URL or link text matches this text or regex
--crawl-language <language>         Prefer discovered URLs for one language such as english, french, or portuguese
--crawl-paginate                    Expand listing pages like /page/2/, /page/3/, and scrape them too
--crawl-max-pages <number>          Maximum listing pages to add in pagination mode
--crawl-any-domain                  Allow crawl mode to follow links to other domains
--crawl-max-urls <number>           Maximum number of discovered page URLs to scrape
--profile <id>                      Use a saved site profile
--profiles-file <path>              Path to the profiles config file
--preview                           Preview extraction without saving files
--title-selector <selector>
--description-selector <selector>
--materials-selector <selector>
--instructions-selector <selector>
--image-selector <selector>
```

## Output Structure

SugarStitch writes one object per successfully scraped page:

```json
{
  "title": "Pattern Title",
  "description": "Short description from the page",
  "materials": ["Cotton fabric", "Stuffing", "Thread"],
  "instructions": ["Cut the pieces", "Sew the body", "Stuff and close"],
  "sourceUrl": "https://example.com/pattern",
  "localImages": ["images/pattern_title/image_1.jpg"],
  "localPdfs": ["pdfs/pattern_title/pattern.pdf"],
  "localTextFile": "texts/pattern_title/pattern.txt"
}
```

Each scraped page also gets a plain-text artifact at `texts/<pattern_title>/pattern.txt`.

That text file includes:

- title
- source URL
- selected preset and optional profile
- extracted description
- extracted materials list
- extracted instructions list
- a fuller page text block gathered from the article content

## Notes

- The CLI prints a small SugarStitch ASCII banner when run in a normal terminal.
- The local UI now includes a light/dark mode toggle, with light mode as the default.

![SugarStitch CLI banner and progress output](website/public/screenshot_cli.png)

## Troubleshooting

### It scraped PDFs and titles, but not much else

That still counts as a successful scrape. It usually means the page-level selectors for description, materials, instructions, or images do not match the site structure yet.

Try one of these:

- run `Test Selectors` in the UI first
- switch presets
- use a saved profile for that site
- add one or two advanced overrides

### Discovery crawl found too much or too little

Adjust:

- `crawl depth`
- `crawl pattern`
- `crawl language`
- crawl pagination settings
- same-domain restriction
- max discovered URLs

### The output file already exists but the scraper refuses to run

If the JSON file contains invalid JSON, SugarStitch will stop instead of silently overwriting it. Fix or remove the broken file first.

## Development Notes

- CLI entrypoint: [`src/index.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/index.ts)
- UI entrypoint: [`src/server.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/server.ts)
- Shared scraper logic: [`src/scraper.ts`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/src/scraper.ts)
- Starter profiles config: [`sugarstitch.profiles.json`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/sugarstitch.profiles.json)
- Technical overview: [`OVERVIEW.md`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/OVERVIEW.md)

## License

This project is licensed under the MIT License. See [`LICENSE`](/home/sizzlebop/PINKPIXEL/PROJECTS/CURRENT/sugarstitch/LICENSE).
