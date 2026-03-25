#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  DEFAULT_PROFILES_FILE,
  normalizeUrl,
  dedupeStrings,
  scrapeUrls,
  previewPattern,
  getSelectorPresets,
  isSelectorPresetId,
  sanitizeSelectorOverrides,
  type SelectorPresetId
} from './scraper';

const program = new Command();

program
  .name('sugarstitch')
  .description('✨ Bulk scrape fiber arts patterns, images, AND PDFs into sweet little local files ✨')
  .version('1.0.0')
  .option('-u, --url <url>', 'A single URL of the pattern page to scrape')
  .option('-f, --file <file>', 'A text file containing a list of URLs (one per line)')
  .option('-o, --output <path>', 'Output JSON file name', 'pattern-data.json')
  .option('--output-dir <path>', 'Directory where JSON, images, and PDFs should be saved')
  .option('-p, --preset <preset>', `Selector preset: ${getSelectorPresets().map(preset => preset.id).join(', ')}`, 'generic')
  .option('--crawl', 'Discover links from the starting URL(s) before scraping them')
  .option('--crawl-depth <number>', 'How many link levels deep to follow in crawl mode', '2')
  .option('--crawl-pattern <pattern>', 'Only follow discovered links whose URL or link text matches this text or regex')
  .option('--crawl-language <language>', 'Prefer discovered URLs for one language such as english, french, or portuguese')
  .option('--crawl-paginate', 'Expand listing pages like /page/2/, /page/3/, and scrape them too')
  .option('--crawl-max-pages <number>', 'Maximum listing pages to add in pagination mode', '20')
  .option('--crawl-any-domain', 'Allow crawl mode to follow links to other domains')
  .option('--crawl-max-urls <number>', 'Maximum number of discovered page URLs to scrape', '100')
  .option('--profile <id>', 'Use a saved site profile from the profiles config file')
  .option('--profiles-file <path>', `Path to the site profiles config file (default: ${DEFAULT_PROFILES_FILE})`, DEFAULT_PROFILES_FILE)
  .option('--preview', 'Preview what would be extracted without downloading files or writing JSON')
  .option('--title-selector <selector>', 'Override the title selector for this run')
  .option('--description-selector <selector>', 'Override the description selector for this run')
  .option('--materials-selector <selector>', 'Override the materials selector for this run')
  .option('--instructions-selector <selector>', 'Override the instructions selector for this run')
  .option('--image-selector <selector>', 'Override the image selector for this run')
  .parse(process.argv);

const options = program.opts();

const ANSI_RESET = '\x1b[0m';
const ANSI_PINK = '\x1b[38;5;205m';
const ANSI_MINT = '\x1b[38;5;121m';
const ANSI_SKY = '\x1b[38;5;117m';
const ANSI_GOLD = '\x1b[38;5;223m';

function colorize(line: string, color: string): string {
  return `${color}${line}${ANSI_RESET}`;
}

function printBanner(): void {
  if (!process.stdout.isTTY || process.env.NO_COLOR) {
    console.log('\nSugarStitch\n');
    return;
  }

  const bannerLines = [
    colorize('███████╗██╗   ██╗ ██████╗  █████╗ ██████╗ ', ANSI_PINK),
    colorize('██╔════╝██║   ██║██╔════╝ ██╔══██╗██╔══██╗', ANSI_MINT),
    colorize('███████╗██║   ██║██║  ███╗███████║██████╔╝', ANSI_SKY),
    colorize('╚════██║██║   ██║██║   ██║██╔══██║██╔══██╗', ANSI_GOLD),
    colorize('███████║╚██████╔╝╚██████╔╝██║  ██║██║  ██║', ANSI_PINK),
    colorize('╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝', ANSI_MINT),
    colorize(' ███████╗████████╗██╗████████╗ ██████╗██╗  ██╗', ANSI_SKY),
    colorize(' ██╔════╝╚══██╔══╝██║╚══██╔══╝██╔════╝██║  ██║', ANSI_GOLD),
    colorize(' ███████╗   ██║   ██║   ██║   ██║     ███████║', ANSI_PINK),
    colorize(' ╚════██║   ██║   ██║   ██║   ██║     ██╔══██║', ANSI_MINT),
    colorize(' ███████║   ██║   ██║   ██║   ╚██████╗██║  ██║', ANSI_SKY),
    colorize(' ╚══════╝   ╚═╝   ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝', ANSI_GOLD)
  ];

  console.log(`\n${bannerLines.join('\n')}`);
  console.log(colorize('Sweet little fiber arts scraper', ANSI_GOLD));
  console.log('');
}

function validateInputOptions(): void {
  if (options.url && options.file) {
    console.error('\n❌ Please use either --url or --file, not both at the same time.');
    process.exitCode = 1;
    program.help();
  }

  if (!options.url && !options.file) {
    console.error('\n❌ You need to provide either a single URL (-u) or a text file (-f) to scrape.');
    process.exitCode = 1;
    program.help();
  }

  if (!isSelectorPresetId(options.preset)) {
    console.error(`\n❌ Unknown preset "${options.preset}". Use one of: ${getSelectorPresets().map(preset => preset.id).join(', ')}`);
    process.exitCode = 1;
    program.help();
  }
}

function resolveOutputPaths(outputName: string, outputDirectory?: string): { outputDirectory: string; outputPath: string } {
  const resolvedOutputDirectory = outputDirectory
    ? path.resolve(process.cwd(), outputDirectory)
    : process.cwd();
  const outputPath = path.isAbsolute(outputName)
    ? outputName
    : path.resolve(resolvedOutputDirectory, outputName);

  return {
    outputDirectory: resolvedOutputDirectory,
    outputPath
  };
}

async function getUrlsFromOptions(): Promise<string[]> {
  if (options.url) {
    const normalizedUrl = normalizeUrl(options.url);

    if (!normalizedUrl) {
      throw new Error(`That doesn't look like a valid URL: ${options.url}`);
    }

    return [normalizedUrl];
  }

  const filePath = path.resolve(process.cwd(), options.file);
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const rawLines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const validUrls = rawLines
    .map(normalizeUrl)
    .filter((line): line is string => Boolean(line));
  const invalidCount = rawLines.length - validUrls.length;
  const urls = dedupeStrings(validUrls);

  console.log(`\n📚 Fuck yeah, loaded ${urls.length} URLs from ${options.file}. Let's get to work...`);

  if (invalidCount > 0) {
    console.log(`⚠️ Skipped ${invalidCount} line(s) because they were not valid http(s) URLs.`);
  }

  return urls;
}

async function run() {
  printBanner();
  validateInputOptions();

  try {
    const urls = await getUrlsFromOptions();
    const profilesPath = path.resolve(process.cwd(), options.profilesFile);
    const { outputDirectory, outputPath } = resolveOutputPaths(options.output, options.outputDir);
    const selectorOverrides = sanitizeSelectorOverrides({
      titleSelector: options.titleSelector,
      descriptionSelector: options.descriptionSelector,
      materialsSelector: options.materialsSelector,
      instructionsSelector: options.instructionsSelector,
      imageSelector: options.imageSelector
    });

    if (options.preview) {
      const preview = await previewPattern({
        url: urls[0],
        preset: options.preset as SelectorPresetId,
        selectorOverrides,
        profileId: options.profile,
        profilesPath
      }, message => console.log(message));

      console.log('\nPreview Summary');
      console.log(`Title: ${preview.title}`);
      console.log(`Description: ${preview.description}`);
      console.log(`Preset: ${preview.presetLabel}`);
      if (preview.profileLabel) {
        console.log(`Profile: ${preview.profileLabel}`);
      }
      if (preview.materials.length > 0) {
        console.log(`Materials (${preview.materials.length}): ${preview.materials.join(' | ')}`);
      }
      if (preview.instructions.length > 0) {
        console.log(`Instructions (${preview.instructions.length}): ${preview.instructions.slice(0, 5).join(' | ')}`);
      }
      console.log(`Images found: ${preview.imageUrls.length}`);
      console.log(`PDFs found: ${preview.pdfUrls.length}`);
      return;
    }

    await scrapeUrls({
      urls,
      outputPath,
      preset: options.preset as SelectorPresetId,
      profileId: options.profile,
      profilesPath,
      selectorOverrides,
      crawl: {
        enabled: Boolean(options.crawl),
        maxDepth: Number.parseInt(options.crawlDepth, 10),
        sameDomainOnly: !options.crawlAnyDomain,
        linkPattern: options.crawlPattern,
        maxDiscoveredUrls: Number.parseInt(options.crawlMaxUrls, 10),
        language: options.crawlLanguage,
        paginate: Boolean(options.crawlPaginate),
        maxPaginationPages: Number.parseInt(options.crawlMaxPages, 10)
      },
      workingDirectory: outputDirectory,
      logger: message => console.log(message)
    });
  } catch (error: any) {
    console.error(`\n❌ ${error.message}`);
    process.exitCode = 1;
  }
}

run();
