#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as http from 'http';
import * as path from 'path';
import {
  DEFAULT_PROFILES_FILE,
  dedupeStrings,
  normalizeUrl,
  scrapeUrls,
  previewPattern,
  getSelectorPresets,
  isSelectorPresetId,
  loadSiteProfiles,
  sanitizeSelectorOverrides,
  type SelectorPresetId
} from './scraper';

const PORT = 4177;
const ROOT_DIRECTORY = process.cwd();
const ASSETS_DIRECTORY = path.resolve(ROOT_DIRECTORY, 'assets');
const PUBLIC_DIRECTORY = path.resolve(ROOT_DIRECTORY, 'public');

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseBody(body: string): URLSearchParams {
  return new URLSearchParams(body);
}

function pageTemplate(content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SugarStitch UI</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    :root {
      --bg: #fff8f1;
      --panel: rgba(255, 255, 255, 0.82);
      --panel-strong: #fffdf9;
      --text: #2f1f1b;
      --muted: #7a5f59;
      --line: rgba(107, 63, 46, 0.14);
      --accent: #e8684a;
      --accent-2: #ffb36b;
      --shadow: 0 22px 60px rgba(110, 66, 44, 0.14);
      --radius: 22px;
    }

    html[data-theme="dark"] {
      --bg: #1a1418;
      --panel: rgba(34, 27, 33, 0.84);
      --panel-strong: #231c21;
      --text: #f6e9e2;
      --muted: #d0b7ae;
      --line: rgba(255, 214, 196, 0.12);
      --accent: #ff8f73;
      --accent-2: #ffc074;
      --shadow: 0 24px 64px rgba(0, 0, 0, 0.38);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(255, 193, 132, 0.7), transparent 30%),
        radial-gradient(circle at top right, rgba(255, 132, 143, 0.32), transparent 28%),
        linear-gradient(180deg, #fff5ea 0%, #fffdfa 50%, #fff7f1 100%);
    }

    html[data-theme="dark"] body {
      background:
        radial-gradient(circle at top left, rgba(255, 143, 115, 0.14), transparent 30%),
        radial-gradient(circle at top right, rgba(126, 203, 255, 0.12), transparent 26%),
        linear-gradient(180deg, #151015 0%, #1a1418 48%, #110d11 100%);
    }

    .shell {
      width: min(1080px, calc(100% - 32px));
      margin: 32px auto;
      display: grid;
      gap: 20px;
    }

    .shell-top {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .theme-toggle,
    .icon-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow);
      cursor: pointer;
      transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
    }

    .theme-toggle:hover,
    .icon-link:hover {
      transform: translateY(-1px);
    }

    .theme-toggle-label {
      font-size: 0.92rem;
      color: var(--muted);
    }

    .theme-icon,
    .icon-link-icon {
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--accent);
      flex: 0 0 auto;
    }

    .theme-icon svg,
    .icon-link-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .icon-link {
      padding: 10px 12px;
      text-decoration: none;
    }

    .hero,
    .panel {
      background: var(--panel);
      backdrop-filter: blur(10px);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .hero {
      padding: 28px;
      position: relative;
      overflow: hidden;
    }

    .hero::after {
      content: "";
      position: absolute;
      inset: auto -40px -55px auto;
      width: 180px;
      height: 180px;
      border-radius: 999px;
      background: linear-gradient(135deg, rgba(255, 179, 107, 0.35), rgba(232, 104, 74, 0.2));
      filter: blur(6px);
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 4vw, 3.3rem);
      line-height: 0.95;
      letter-spacing: -0.03em;
    }

    .kicker {
      display: inline-block;
      margin-bottom: 10px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8c4a33;
      background: rgba(255,255,255,0.65);
      border: 1px solid rgba(140, 74, 51, 0.12);
    }

    html[data-theme="dark"] .kicker {
      color: #ffd3c2;
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 211, 194, 0.12);
    }

    .sub {
      max-width: 720px;
      margin: 0;
      color: var(--muted);
      font-size: 1.05rem;
      line-height: 1.55;
    }

    .hero-banner {
      position: relative;
      z-index: 1;
      width: min(100%, 760px);
      margin-top: 8px;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid var(--line);
      box-shadow: 0 18px 42px rgba(110, 66, 44, 0.16);
      background: rgba(255, 255, 255, 0.54);
    }

    .hero-banner img {
      display: block;
      width: 100%;
      height: auto;
    }

    .hero-banner .hero-banner-dark {
      display: none;
    }

    html[data-theme="dark"] .hero-banner {
      background: rgba(255, 255, 255, 0.04);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32);
    }

    html[data-theme="dark"] .hero-banner .hero-banner-light {
      display: none;
    }

    html[data-theme="dark"] .hero-banner .hero-banner-dark {
      display: block;
    }

    .grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
    }

    .panel {
      padding: 22px;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 1.25rem;
    }

    form {
      display: grid;
      gap: 14px;
    }

    label {
      display: grid;
      gap: 8px;
      font-size: 0.95rem;
      color: var(--muted);
    }

    input, select, textarea, button {
      font: inherit;
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid rgba(122, 95, 89, 0.22);
      border-radius: 14px;
      padding: 12px 14px;
      background: var(--panel-strong);
      color: var(--text);
      outline: none;
      transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
    }

    input:focus, select:focus, textarea:focus {
      border-color: rgba(232, 104, 74, 0.5);
      box-shadow: 0 0 0 4px rgba(232, 104, 74, 0.12);
    }

    textarea {
      min-height: 180px;
      resize: vertical;
      line-height: 1.45;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .hint, .note {
      margin: 0;
      font-size: 0.9rem;
      color: var(--muted);
      line-height: 1.5;
    }

    .button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 13px 18px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: white;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 12px 28px rgba(232, 104, 74, 0.28);
      transition: transform 140ms ease, box-shadow 140ms ease;
    }

    .button:hover {
      transform: translateY(-1px);
      box-shadow: 0 16px 34px rgba(232, 104, 74, 0.32);
    }

    .button[disabled] {
      opacity: 0.72;
      cursor: progress;
      transform: none;
      box-shadow: 0 8px 20px rgba(232, 104, 74, 0.18);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat {
      padding: 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid var(--line);
    }

    .stat strong {
      display: block;
      font-size: 1.5rem;
      margin-bottom: 3px;
    }

    .log, .list {
      margin: 0;
      padding: 14px;
      border-radius: 18px;
      background: #2c211e;
      color: #ffeadd;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 0.88rem;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      max-height: 360px;
      overflow: auto;
    }

    .list {
      background: rgba(255,255,255,0.72);
      color: var(--text);
      font-family: inherit;
      white-space: normal;
    }

    html[data-theme="dark"] .list,
    html[data-theme="dark"] .stat,
    html[data-theme="dark"] details {
      background: rgba(255, 255, 255, 0.04);
    }

    .list ul {
      margin: 0;
      padding-left: 18px;
    }

    details {
      border: 1px dashed rgba(122, 95, 89, 0.28);
      border-radius: 18px;
      padding: 14px;
      background: rgba(255,255,255,0.45);
    }

    summary {
      cursor: pointer;
      font-weight: 700;
      color: #8c4a33;
      list-style: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    .details-grid {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }

    .status {
      display: inline-block;
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .status.ok {
      background: rgba(90, 160, 89, 0.12);
      color: #326632;
    }

    .status.error {
      background: rgba(190, 76, 58, 0.12);
      color: #8d2c1f;
    }

    .overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(255, 248, 241, 0.78);
      backdrop-filter: blur(8px);
      z-index: 999;
    }

    html[data-theme="dark"] .overlay {
      background: rgba(17, 13, 17, 0.72);
    }

    .overlay.active {
      display: flex;
    }

    .overlay-card {
      width: min(520px, 100%);
      padding: 24px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      text-align: center;
    }

    html[data-theme="dark"] .log {
      background: #120e12;
      color: #ffe8dc;
    }

    .spinner {
      width: 54px;
      height: 54px;
      margin: 0 auto 16px;
      border-radius: 999px;
      border: 5px solid rgba(232, 104, 74, 0.18);
      border-top-color: var(--accent);
      animation: spin 0.9s linear infinite;
    }

    .progress-track {
      width: 100%;
      height: 10px;
      margin-top: 16px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(232, 104, 74, 0.12);
    }

    .progress-bar {
      width: 38%;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
      animation: glide 1.25s ease-in-out infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes glide {
      0% { transform: translateX(-120%); }
      50% { transform: translateX(140%); }
      100% { transform: translateX(280%); }
    }

    @media (max-width: 860px) {
      .grid, .row, .stats {
        grid-template-columns: 1fr;
      }

      .shell-top {
        justify-content: space-between;
      }
    }
  </style>
</head>
<body>
  <div id="workingOverlay" class="overlay" aria-hidden="true">
    <div class="overlay-card">
      <div class="spinner"></div>
      <h2 id="overlayTitle">Working on it...</h2>
      <p id="overlayMessage" class="note">SugarStitch is running now. This page will update when the scrape finishes.</p>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
  <main class="shell">
    <div class="shell-top">
      <div class="top-actions">
        <a
          class="icon-link"
          href="https://sugarstitch.pinkpixel.dev"
          target="_blank"
          rel="noreferrer"
          aria-label="Open SugarStitch docs"
          title="Open SugarStitch docs"
        >
          <span class="icon-link-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4.75h8.5a2.75 2.75 0 0 1 2.75 2.75V19.25H8.75A2.75 2.75 0 0 0 6 22"></path>
              <path d="M6 4.75A2.75 2.75 0 0 0 3.25 7.5v11.75H12"></path>
              <path d="M8.5 8.5h6"></path>
              <path d="M8.5 11.5h6"></path>
            </svg>
          </span>
        </a>
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Toggle dark mode" aria-pressed="false">
          <span id="themeIcon" class="theme-icon" aria-hidden="true"></span>
          <span id="themeLabel" class="theme-toggle-label">Dark mode</span>
        </button>
      </div>
    </div>
    ${content}
  </main>
  <script>
    (() => {
      const root = document.documentElement;
      const themeToggle = document.getElementById('themeToggle');
      const themeIcon = document.getElementById('themeIcon');
      const themeLabel = document.getElementById('themeLabel');
      const forms = document.querySelectorAll('form[data-enhanced="true"]');
      const overlay = document.getElementById('workingOverlay');
      const overlayTitle = document.getElementById('overlayTitle');
      const overlayMessage = document.getElementById('overlayMessage');
      const darkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 1 1 12.5 4a6.5 6.5 0 0 0 7.5 11.5Z"></path></svg>';
      const lightIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M6.34 17.66l-1.41 1.41"></path><path d="M19.07 4.93l-1.41 1.41"></path></svg>';

      const getPreferredTheme = () => {
        const savedTheme = window.localStorage.getItem('sugarstitch-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          return savedTheme;
        }
        return 'light';
      };

      const applyTheme = (theme) => {
        root.setAttribute('data-theme', theme);
        if (themeToggle) {
          themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        }
        if (themeIcon) {
          themeIcon.innerHTML = theme === 'dark' ? lightIcon : darkIcon;
        }
        if (themeLabel) {
          themeLabel.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
        }
      };

      applyTheme(getPreferredTheme());

      if (themeToggle) {
        themeToggle.addEventListener('click', () => {
          const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
          window.localStorage.setItem('sugarstitch-theme', nextTheme);
          applyTheme(nextTheme);
        });
      }

      forms.forEach((form) => {
        form.addEventListener('submit', (event) => {
          const submitter = event.submitter;
          const isPreview = submitter && submitter.getAttribute('formaction') === '/preview';
          if (overlay) {
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
          }
          if (overlayTitle) {
            overlayTitle.textContent = isPreview ? 'Testing selectors...' : 'Scraping in progress...';
          }
          if (overlayMessage) {
            overlayMessage.textContent = isPreview
              ? 'SugarStitch is checking what it can pull from the page before saving anything.'
              : 'SugarStitch is fetching pages and downloading matching files. This screen will update when the run finishes.';
          }
          const buttons = form.querySelectorAll('button');
          buttons.forEach((button) => {
            button.disabled = true;
          });
          if (submitter) {
            submitter.textContent = isPreview ? 'Testing...' : 'Scraping...';
          }
        });
      });
    })();
  </script>
</body>
</html>`;
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

async function renderHome(values?: Record<string, string>, message?: string): Promise<string> {
  const mode = values?.mode === 'many' ? 'many' : 'single';
  const singleUrl = escapeHtml(values?.singleUrl ?? '');
  const urlsText = escapeHtml(values?.urlsText ?? '');
  const output = escapeHtml(values?.output ?? 'pattern-data.json');
  const outputDirectory = escapeHtml(values?.outputDirectory ?? '');
  const preset = values?.preset && isSelectorPresetId(values.preset) ? values.preset : 'generic';
  const crawlEnabled = values?.crawlEnabled === 'true';
  const crawlDepth = escapeHtml(values?.crawlDepth ?? '2');
  const crawlPattern = escapeHtml(values?.crawlPattern ?? '');
  const crawlMaxUrls = escapeHtml(values?.crawlMaxUrls ?? '100');
  const crawlLanguage = escapeHtml(values?.crawlLanguage ?? '');
  const crawlPaginate = values?.crawlPaginate === 'true';
  const crawlMaxPages = escapeHtml(values?.crawlMaxPages ?? '20');
  const crawlAnyDomain = values?.crawlAnyDomain === 'true';
  const profileId = escapeHtml(values?.profileId ?? '');
  const profilesFile = escapeHtml(values?.profilesFile ?? DEFAULT_PROFILES_FILE);
  const titleSelector = escapeHtml(values?.titleSelector ?? '');
  const descriptionSelector = escapeHtml(values?.descriptionSelector ?? '');
  const materialsSelector = escapeHtml(values?.materialsSelector ?? '');
  const instructionsSelector = escapeHtml(values?.instructionsSelector ?? '');
  const imageSelector = escapeHtml(values?.imageSelector ?? '');
  const messageMarkup = message ? `<p class="note">${escapeHtml(message)}</p>` : '';
  const presetOptions = getSelectorPresets()
    .map(selectorPreset => `<option value="${selectorPreset.id}"${preset === selectorPreset.id ? ' selected' : ''}>${escapeHtml(selectorPreset.label)}</option>`)
    .join('');
  const presetDescriptions = getSelectorPresets()
    .map(selectorPreset => `<li><strong>${escapeHtml(selectorPreset.label)}:</strong> ${escapeHtml(selectorPreset.description)}</li>`)
    .join('');
  const availableProfiles = await loadSiteProfiles(path.resolve(process.cwd(), values?.profilesFile ?? DEFAULT_PROFILES_FILE));
  const profileOptions = ['<option value="">None</option>', ...availableProfiles.map(profile => `<option value="${escapeHtml(profile.id)}"${profileId === profile.id ? ' selected' : ''}>${escapeHtml(profile.label)}</option>`)].join('');
  const profileDescriptions = availableProfiles.length > 0
    ? `<div class="list"><ul>${availableProfiles.map(profile => `<li><strong>${escapeHtml(profile.label)}:</strong> ${escapeHtml(profile.description ?? 'Saved profile from your config file.')}</li>`).join('')}</ul></div>`
    : `<p class="note">No custom profiles found yet. Create <code>${escapeHtml(values?.profilesFile ?? DEFAULT_PROFILES_FILE)}</code> to add reusable site presets.</p>`;

  return pageTemplate(`
    <section class="hero">
      <span class="kicker">Sweet little scraping station</span>
      <div class="hero-banner">
        <img class="hero-banner-light" src="/assets/banner_light.png" alt="SugarStitch banner for light mode" />
        <img class="hero-banner-dark" src="/assets/banner_dark.png" alt="SugarStitch banner for dark mode" />
      </div>
    </section>

    <section class="grid">
      <section class="panel">
        <h2>Run a Scrape</h2>
        ${messageMarkup}
        <form method="post" action="/scrape" data-enhanced="true">
          <label>
            Mode
            <select name="mode">
              <option value="single"${mode === 'single' ? ' selected' : ''}>Single URL</option>
              <option value="many"${mode === 'many' ? ' selected' : ''}>Paste Multiple URLs</option>
            </select>
          </label>

          <label>
            Single Pattern URL
            <input type="url" name="singleUrl" placeholder="https://example.com/pattern" value="${singleUrl}" />
          </label>

          <label>
            Multiple URLs
            <textarea name="urlsText" placeholder="Paste one pattern URL per line">${urlsText}</textarea>
          </label>

          <div class="row">
            <label>
              Saved Site Profile
              <select name="profileId">
                ${profileOptions}
              </select>
            </label>

            <label>
              Output JSON File
              <input type="text" name="output" placeholder="pattern-data.json" value="${output}" />
            </label>
          </div>

          <label>
            Output Directory
            <input type="text" name="outputDirectory" placeholder="Leave blank to save in the project folder" value="${outputDirectory}" />
          </label>
          <p class="hint">For now this is a folder path field. Regular browser pages cannot safely hand a native local folder path back to the server the way a desktop app can.</p>

          <details>
            <summary>Discovery crawl</summary>
            <div class="details-grid">
              <p class="hint">Use this when you want SugarStitch to start from a listing page, follow links a couple levels deep, and scrape the discovered pages for PDFs and pattern data.</p>
              <label>
                <select name="crawlEnabled">
                  <option value="false"${!crawlEnabled ? ' selected' : ''}>Off</option>
                  <option value="true"${crawlEnabled ? ' selected' : ''}>On</option>
                </select>
              </label>
              <div class="row">
                <label>
                  Crawl Depth
                  <input type="number" min="0" max="5" name="crawlDepth" value="${crawlDepth}" />
                </label>
                <label>
                  Max Discovered URLs
                  <input type="number" min="1" max="500" name="crawlMaxUrls" value="${crawlMaxUrls}" />
                </label>
              </div>
              <div class="row">
                <label>
                  Preferred Language
                  <input type="text" name="crawlLanguage" placeholder="english" value="${crawlLanguage}" />
                </label>
                <label>
                  Pagination
                  <select name="crawlPaginate">
                    <option value="false"${!crawlPaginate ? ' selected' : ''}>Off</option>
                    <option value="true"${crawlPaginate ? ' selected' : ''}>On</option>
                  </select>
                </label>
              </div>
              <label>
                Link Filter
                <input type="text" name="crawlPattern" placeholder="free_pattern|pattern|pillow|quilt" value="${crawlPattern}" />
              </label>
              <div class="row">
                <label>
                  Max Listing Pages
                  <input type="number" min="1" max="100" name="crawlMaxPages" value="${crawlMaxPages}" />
                </label>
                <label>
                  <select name="crawlAnyDomain">
                    <option value="false"${!crawlAnyDomain ? ' selected' : ''}>Stay on the same domain</option>
                    <option value="true"${crawlAnyDomain ? ' selected' : ''}>Allow other domains too</option>
                  </select>
                </label>
              </div>
            </div>
          </details>

          <div class="row">
            <label>
              Profiles Config File
              <input type="text" name="profilesFile" placeholder="${DEFAULT_PROFILES_FILE}" value="${profilesFile}" />
            </label>

            <label>
              Selector Preset
              <select name="preset">
                ${presetOptions}
              </select>
            </label>
          </div>

          <p class="hint">Presets change the CSS selectors SugarStitch uses in <code>src/scraper.ts</code>. Start with <strong>Generic / Custom</strong> unless you already know the site matches a WordPress article or WooCommerce product layout.</p>
          <details>
            <summary>Advanced selector overrides</summary>
            <div class="details-grid">
              <p class="hint">Use these only if the preset is close but one or two fields still miss. Any field you fill in will take priority over the preset for this run.</p>
              <label>
                Title Selector
                <input type="text" name="titleSelector" placeholder="h1.entry-title" value="${titleSelector}" />
              </label>
              <label>
                Description Selector
                <input type="text" name="descriptionSelector" placeholder=".entry-content p" value="${descriptionSelector}" />
              </label>
              <label>
                Materials Selector
                <input type="text" name="materialsSelector" placeholder=".materials-list li" value="${materialsSelector}" />
              </label>
              <label>
                Instructions Selector
                <input type="text" name="instructionsSelector" placeholder=".instruction-step" value="${instructionsSelector}" />
              </label>
              <label>
                Image Selector
                <input type="text" name="imageSelector" placeholder=".entry-content img" value="${imageSelector}" />
              </label>
            </div>
          </details>
          <div class="row">
            <button class="button" type="submit" formaction="/preview">Test Selectors</button>
            <button class="button" type="submit" formaction="/scrape">Start Scraping</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <h2>Saved Profiles</h2>
        ${profileDescriptions}
        <h2>Preset Guide</h2>
        <div class="list"><ul>${presetDescriptions}</ul></div>
        <h2>How It Feels</h2>
        <p class="note">Use <strong>Single URL</strong> for one pattern page. Use <strong>Paste Multiple URLs</strong> when you have a batch list and want the UI to behave like the CLI file mode without creating a text file first.</p>
        <p class="note">Downloads land inside your chosen output directory. SugarStitch writes the JSON file there and creates <code>images/</code> and <code>pdfs/</code> folders underneath it.</p>
        <p class="note">Already-known URLs are skipped before the scraper fetches them again, so reruns are a lot less wasteful now.</p>
      </section>
    </section>
  `);
}

function renderResults(params: {
  status: 'ok' | 'error';
  title: string;
  logs: string[];
  outputPath?: string;
  outputDirectory?: string;
  presetLabel?: string;
  profileLabel?: string;
  selectorOverrides?: Record<string, string>;
  scrapedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  patterns?: string[];
  completionNote?: string;
  discoveredUrlCount?: number;
}): string {
  const statsMarkup = params.status === 'ok'
    ? `<div class="stats">
        <div class="stat"><strong>${params.scrapedCount ?? 0}</strong>New Patterns</div>
        <div class="stat"><strong>${params.skippedCount ?? 0}</strong>Skipped</div>
        <div class="stat"><strong>${params.failedCount ?? 0}</strong>Failed</div>
      </div>`
    : '';
  const patternsMarkup = params.patterns && params.patterns.length > 0
    ? `<div class="list"><ul>${params.patterns.map(pattern => `<li>${escapeHtml(pattern)}</li>`).join('')}</ul></div>`
    : '<p class="note">No new pattern titles were written during this run.</p>';
  const overrideItems = params.selectorOverrides
    ? Object.entries(params.selectorOverrides)
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> <code>${escapeHtml(value)}</code></li>`)
        .join('')
    : '';

  return pageTemplate(`
    <section class="hero">
      <span class="status ${params.status}">${params.status === 'ok' ? 'Run complete' : 'Run failed'}</span>
      <h1>${escapeHtml(params.title)}</h1>
      <p class="sub">SugarStitch finished this local run. You can review the logs below or head back and try another batch.</p>
    </section>

    <section class="grid">
      <section class="panel">
        <h2>Summary</h2>
        ${statsMarkup}
        ${params.outputPath ? `<p class="note">Output file: <code>${escapeHtml(params.outputPath)}</code></p>` : ''}
        ${params.outputDirectory ? `<p class="note">Output directory: <code>${escapeHtml(params.outputDirectory)}</code></p>` : ''}
        ${typeof params.discoveredUrlCount === 'number' ? `<p class="note">Discovered page URLs processed: <strong>${params.discoveredUrlCount}</strong></p>` : ''}
        ${params.presetLabel ? `<p class="note">Selector preset: <strong>${escapeHtml(params.presetLabel)}</strong></p>` : ''}
        ${params.profileLabel ? `<p class="note">Saved profile: <strong>${escapeHtml(params.profileLabel)}</strong></p>` : ''}
        ${params.completionNote ? `<p class="note">${escapeHtml(params.completionNote)}</p>` : ''}
        ${overrideItems ? `<h2>Advanced Overrides</h2><div class="list"><ul>${overrideItems}</ul></div>` : ''}
        <h2>New Pattern Titles</h2>
        ${patternsMarkup}
      </section>

      <section class="panel">
        <h2>Run Log</h2>
        <pre class="log">${escapeHtml(params.logs.join('\n'))}</pre>
      </section>
    </section>

    <section class="panel">
      <a class="button" href="/">Back to the form</a>
    </section>
  `);
}

function renderPreview(params: {
  title: string;
  description: string;
  materials: string[];
  instructions: string[];
  imageUrls: string[];
  pdfUrls: string[];
  logs: string[];
  presetLabel: string;
  profileLabel?: string;
  selectorOverrides?: Record<string, string>;
}): string {
  const overrideItems = params.selectorOverrides
    ? Object.entries(params.selectorOverrides)
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> <code>${escapeHtml(value)}</code></li>`)
        .join('')
    : '';

  return pageTemplate(`
    <section class="hero">
      <span class="status ok">Preview ready</span>
      <h1>Selector Test Preview</h1>
      <p class="sub">This is what SugarStitch would pull from the page before any JSON writes or file downloads happen.</p>
    </section>

    <section class="grid">
      <section class="panel">
        <h2>Preview Summary</h2>
        <p class="note">Selector preset: <strong>${escapeHtml(params.presetLabel)}</strong></p>
        ${params.profileLabel ? `<p class="note">Saved profile: <strong>${escapeHtml(params.profileLabel)}</strong></p>` : ''}
        ${overrideItems ? `<h2>Advanced Overrides</h2><div class="list"><ul>${overrideItems}</ul></div>` : ''}
        <h2>Title</h2>
        <div class="list"><p>${escapeHtml(params.title)}</p></div>
        <h2>Description</h2>
        <div class="list"><p>${escapeHtml(params.description)}</p></div>
        <h2>Materials</h2>
        <div class="list"><ul>${params.materials.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No materials matched.</li>'}</ul></div>
        <h2>Instructions</h2>
        <div class="list"><ul>${params.instructions.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No instructions matched.</li>'}</ul></div>
      </section>

      <section class="panel">
        <h2>Found Assets</h2>
        <p class="note">Images found: <strong>${params.imageUrls.length}</strong></p>
        <div class="list"><ul>${params.imageUrls.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No images matched.</li>'}</ul></div>
        <h2>Linked PDFs</h2>
        <div class="list"><ul>${params.pdfUrls.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No PDFs matched.</li>'}</ul></div>
        <h2>Preview Log</h2>
        <pre class="log">${escapeHtml(params.logs.join('\n'))}</pre>
      </section>
    </section>

    <section class="panel">
      <a class="button" href="/">Back to the form</a>
    </section>
  `);
}

async function handleScrape(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const bodyChunks: Buffer[] = [];

  for await (const chunk of req) {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const params = parseBody(Buffer.concat(bodyChunks).toString('utf8'));
  const mode = params.get('mode') === 'many' ? 'many' : 'single';
  const singleUrl = (params.get('singleUrl') ?? '').trim();
  const urlsText = (params.get('urlsText') ?? '').trim();
  const outputName = (params.get('output') ?? 'pattern-data.json').trim() || 'pattern-data.json';
  const outputDirectoryInput = (params.get('outputDirectory') ?? '').trim();
  const crawlEnabled = (params.get('crawlEnabled') ?? 'false') === 'true';
  const crawlDepth = (params.get('crawlDepth') ?? '2').trim() || '2';
  const crawlPattern = (params.get('crawlPattern') ?? '').trim();
  const crawlMaxUrls = (params.get('crawlMaxUrls') ?? '100').trim() || '100';
  const crawlLanguage = (params.get('crawlLanguage') ?? '').trim();
  const crawlPaginate = (params.get('crawlPaginate') ?? 'false') === 'true';
  const crawlMaxPages = (params.get('crawlMaxPages') ?? '20').trim() || '20';
  const crawlAnyDomain = (params.get('crawlAnyDomain') ?? 'false') === 'true';
  const preset = isSelectorPresetId(params.get('preset') ?? '') ? (params.get('preset') as SelectorPresetId) : 'generic';
  const profilesFile = (params.get('profilesFile') ?? DEFAULT_PROFILES_FILE).trim() || DEFAULT_PROFILES_FILE;
  const profileId = (params.get('profileId') ?? '').trim();
  const selectorOverrides = sanitizeSelectorOverrides({
    titleSelector: params.get('titleSelector') ?? '',
    descriptionSelector: params.get('descriptionSelector') ?? '',
    materialsSelector: params.get('materialsSelector') ?? '',
    instructionsSelector: params.get('instructionsSelector') ?? '',
    imageSelector: params.get('imageSelector') ?? ''
  });
  const values = {
    mode,
    singleUrl,
    urlsText,
    output: outputName,
    outputDirectory: outputDirectoryInput,
    crawlEnabled: String(crawlEnabled),
    crawlDepth,
    crawlPattern,
    crawlMaxUrls,
    crawlLanguage,
    crawlPaginate: String(crawlPaginate),
    crawlMaxPages,
    crawlAnyDomain: String(crawlAnyDomain),
    preset,
    profileId,
    profilesFile,
    titleSelector: selectorOverrides?.titleSelector ?? '',
    descriptionSelector: selectorOverrides?.descriptionSelector ?? '',
    materialsSelector: selectorOverrides?.materialsSelector ?? '',
    instructionsSelector: selectorOverrides?.instructionsSelector ?? '',
    imageSelector: selectorOverrides?.imageSelector ?? ''
  };

  let urls: string[] = [];

  if (mode === 'single') {
    const normalizedUrl = normalizeUrl(singleUrl);
    if (!normalizedUrl) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await renderHome(values, 'Please enter one valid http(s) URL for single mode.'));
      return;
    }
    urls = [normalizedUrl];
  } else {
    urls = dedupeStrings(
      urlsText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(normalizeUrl)
        .filter((url): url is string => Boolean(url))
    );

    if (urls.length === 0) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await renderHome(values, 'Paste at least one valid http(s) URL in multiple mode.'));
      return;
    }
  }

  const logs: string[] = [];

  try {
    const { outputDirectory, outputPath } = resolveOutputPaths(outputName, outputDirectoryInput);
    const result = await scrapeUrls({
      urls,
      outputPath,
      preset,
      profileId: profileId || undefined,
      profilesPath: path.resolve(process.cwd(), profilesFile),
      selectorOverrides,
      crawl: {
        enabled: crawlEnabled,
        maxDepth: Number.parseInt(crawlDepth, 10),
        sameDomainOnly: !crawlAnyDomain,
        linkPattern: crawlPattern,
        maxDiscoveredUrls: Number.parseInt(crawlMaxUrls, 10),
        language: crawlLanguage,
        paginate: crawlPaginate,
        maxPaginationPages: Number.parseInt(crawlMaxPages, 10)
      },
      workingDirectory: outputDirectory,
      logger: message => logs.push(message)
    });
    const lowMatchCount = result.patterns.filter(pattern =>
      pattern.description === 'No description found.' &&
      pattern.materials.length === 0 &&
      pattern.instructions.length === 0 &&
      pattern.localImages.length === 0 &&
      pattern.localPdfs.length > 0
    ).length;
    const completionNote = lowMatchCount > 0
      ? `${lowMatchCount} saved item(s) mainly matched PDFs and titles. That still counts as a successful scrape, but trying another preset or running Test Selectors may help capture more page content.`
      : undefined;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderResults({
      status: 'ok',
      title: 'Scrape completed successfully',
      logs,
      outputPath: result.outputPath,
      outputDirectory: result.outputDirectory,
      discoveredUrlCount: result.discoveredUrlCount,
      presetLabel: getSelectorPresets().find(selectorPreset => selectorPreset.id === result.preset)?.label ?? result.preset,
      profileLabel: result.profileLabel,
      completionNote,
      selectorOverrides: result.selectorOverrides ? {
        title: result.selectorOverrides.titleSelector ?? '',
        description: result.selectorOverrides.descriptionSelector ?? '',
        materials: result.selectorOverrides.materialsSelector ?? '',
        instructions: result.selectorOverrides.instructionsSelector ?? '',
        images: result.selectorOverrides.imageSelector ?? ''
      } : undefined,
      scrapedCount: result.scrapedCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      patterns: result.patterns.map(pattern => pattern.title)
    }));
  } catch (error: any) {
    logs.push(`❌ ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderResults({
      status: 'error',
      title: 'Scrape failed',
      logs
    }));
  }
}

async function handlePreview(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const bodyChunks: Buffer[] = [];

  for await (const chunk of req) {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const params = parseBody(Buffer.concat(bodyChunks).toString('utf8'));
  const singleUrl = (params.get('singleUrl') ?? '').trim();
  const preset = isSelectorPresetId(params.get('preset') ?? '') ? (params.get('preset') as SelectorPresetId) : 'generic';
  const profilesFile = (params.get('profilesFile') ?? DEFAULT_PROFILES_FILE).trim() || DEFAULT_PROFILES_FILE;
  const profileId = (params.get('profileId') ?? '').trim();
  const selectorOverrides = sanitizeSelectorOverrides({
    titleSelector: params.get('titleSelector') ?? '',
    descriptionSelector: params.get('descriptionSelector') ?? '',
    materialsSelector: params.get('materialsSelector') ?? '',
    instructionsSelector: params.get('instructionsSelector') ?? '',
    imageSelector: params.get('imageSelector') ?? ''
  });
  const values = {
    mode: 'single',
    singleUrl,
    urlsText: '',
    output: (params.get('output') ?? 'pattern-data.json').trim() || 'pattern-data.json',
    outputDirectory: (params.get('outputDirectory') ?? '').trim(),
    crawlEnabled: String((params.get('crawlEnabled') ?? 'false') === 'true'),
    crawlDepth: (params.get('crawlDepth') ?? '2').trim() || '2',
    crawlPattern: (params.get('crawlPattern') ?? '').trim(),
    crawlMaxUrls: (params.get('crawlMaxUrls') ?? '100').trim() || '100',
    crawlLanguage: (params.get('crawlLanguage') ?? '').trim(),
    crawlPaginate: String((params.get('crawlPaginate') ?? 'false') === 'true'),
    crawlMaxPages: (params.get('crawlMaxPages') ?? '20').trim() || '20',
    crawlAnyDomain: String((params.get('crawlAnyDomain') ?? 'false') === 'true'),
    preset,
    profileId,
    profilesFile,
    titleSelector: selectorOverrides?.titleSelector ?? '',
    descriptionSelector: selectorOverrides?.descriptionSelector ?? '',
    materialsSelector: selectorOverrides?.materialsSelector ?? '',
    instructionsSelector: selectorOverrides?.instructionsSelector ?? '',
    imageSelector: selectorOverrides?.imageSelector ?? ''
  };

  const normalizedUrl = normalizeUrl(singleUrl);
  if (!normalizedUrl) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await renderHome(values, 'Enter one valid URL in Single URL mode before testing selectors.'));
    return;
  }

  const logs: string[] = [];

  try {
    const preview = await previewPattern({
      url: normalizedUrl,
      preset,
      profileId: profileId || undefined,
      profilesPath: path.resolve(process.cwd(), profilesFile),
      selectorOverrides
    }, message => logs.push(message));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderPreview({
      title: preview.title,
      description: preview.description,
      materials: preview.materials,
      instructions: preview.instructions,
      imageUrls: preview.imageUrls,
      pdfUrls: preview.pdfUrls,
      logs,
      presetLabel: preview.presetLabel,
      profileLabel: preview.profileLabel,
      selectorOverrides: preview.selectorOverrides ? {
        title: preview.selectorOverrides.titleSelector ?? '',
        description: preview.selectorOverrides.descriptionSelector ?? '',
        materials: preview.selectorOverrides.materialsSelector ?? '',
        instructions: preview.selectorOverrides.instructionsSelector ?? '',
        images: preview.selectorOverrides.imageSelector ?? ''
      } : undefined
    }));
  } catch (error: any) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await renderHome(values, error.message));
  }
}

async function serveStaticFile(res: http.ServerResponse, filePath: string): Promise<void> {
  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(file);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Unable to load file');
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : await renderHome());
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && req.url === '/favicon.png') {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end();
      return;
    }

    await serveStaticFile(res, path.resolve(PUBLIC_DIRECTORY, 'favicon.png'));
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/assets/')) {
    const assetPath = req.url.slice('/assets/'.length);
    const safeAssetPath = path.normalize(assetPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.resolve(ASSETS_DIRECTORY, safeAssetPath);

    if (!filePath.startsWith(ASSETS_DIRECTORY)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end();
      return;
    }

    await serveStaticFile(res, filePath);
    return;
  }

  if (req.method === 'POST' && req.url === '/scrape') {
    await handleScrape(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/preview') {
    await handlePreview(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`SugarStitch UI is running at http://localhost:${PORT}`);
});
