/*
  Static site build: src/ → dist/

  - Expands `<!-- include name key="value" -->` directives in src/*.html with
    the partials in src/partials/, substituting {{key}} placeholders.
  - Concatenates the css/ modules in cascade order, minifies the result and
    inlines it into each page's <head> (replacing the stylesheet link in the
    head-assets partial) so first paint needs no render-blocking CSS request.
  - Minifies head.js and script.js.
  - Generates llms-full.txt from the English pages (the content between each
    page's nav and footer includes, converted to Markdown), so it can never
    drift from the site copy. llms.txt stays hand-curated in src/.
  - Copies all other static assets verbatim.

  Languages: English pages live in src/ and build to dist/; each extra
  language in LANGS has a full set of translated twins in src/<lang>/ that
  build to dist/<lang>/. Partials resolve per language: src/partials/<lang>/
  first, falling back to the shared src/partials/. Content edits to an
  English page must be mirrored in its src/<lang>/ twin.

  Run with: npm run build
*/

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';
import TurndownService from 'turndown';

const SRC = 'src';
const DIST = 'dist';

const LANGS = ['en', 'es']; /* 'en' is the root/default language */
const PAGES = ['index.html', 'about.html', 'how-it-works.html', 'sources.html'];

/* Cascade-significant order — must match the documented order in base.css */
const CSS_ORDER = [
  'base.css',
  'chrome.css',
  'layout.css',
  'components.css',
  'footer.css',
  'responsive.css',
];

const STATIC_ASSETS = [
  'fonts',
  'img',
  'favicon.svg',
  'og-image.png',
  'robots.txt',
  'llms.txt',
  'sitemap.xml',
  'CNAME',
  '.nojekyll',
];

const INCLUDE_RE = /<!--\s*include\s+([\w-]+)((?:\s+\w+=(?:"[^"]*"|'[^']*'))*)\s*-->/g;
const ATTR_RE = /(\w+)=(?:"([^"]*)"|'([^']*)')/g;

const partialCache = new Map();

async function partial(name, lang) {
  const key = `${lang}:${name}`;
  if (!partialCache.has(key)) {
    let html;
    try {
      /* Language-specific override first… */
      html = await readFile(path.join(SRC, 'partials', lang, `${name}.html`), 'utf8');
    } catch {
      /* …then the shared partial */
      html = await readFile(path.join(SRC, 'partials', `${name}.html`), 'utf8');
    }
    partialCache.set(key, html.replace(/\n$/, ''));
  }
  return partialCache.get(key);
}

const CSS_LINK_TAG = '<link rel="stylesheet" href="/css/styles.css">';

async function renderPage(file, lang, css) {
  const srcFile = lang === 'en' ? path.join(SRC, file) : path.join(SRC, lang, file);
  const outDir = lang === 'en' ? DIST : path.join(DIST, lang);
  const source = await readFile(srcFile, 'utf8');

  /* Resolve includes sequentially (replaceAll + async don't mix) */
  let out = '';
  let last = 0;
  for (const match of source.matchAll(INCLUDE_RE)) {
    const [directive, name, attrs] = match;
    const vars = {};
    for (const [, key, dq, sq] of attrs.matchAll(ATTR_RE)) vars[key] = dq ?? sq;

    let html = await partial(name, lang);
    /* Unset keys render as empty strings (e.g. optional aria-current) */
    html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');

    out += source.slice(last, match.index) + html;
    last = match.index + directive.length;
  }
  out += source.slice(last);

  if (/<!--\s*include\s/.test(out)) {
    throw new Error(`${srcFile}: unresolved include directive after rendering`);
  }
  if (!out.includes(CSS_LINK_TAG)) {
    throw new Error(`${srcFile}: stylesheet link not found, cannot inline CSS`);
  }
  out = out.replace(CSS_LINK_TAG, `<style>${css}</style>`);

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, file), out);
}

/* ─── llms-full.txt: Markdown mirror of the English pages, generated from the
   same source HTML so it can never drift from the site copy ─── */

const LLMS_PAGES = [
  { file: 'index.html', label: 'Overview (Home)', url: 'https://extraspacescam.com/' },
  { file: 'how-it-works.html', label: 'How It Works', url: 'https://extraspacescam.com/how-it-works.html' },
  { file: 'about.html', label: 'About', url: 'https://extraspacescam.com/about.html' },
  { file: 'sources.html', label: 'Sources & Standards', url: 'https://extraspacescam.com/sources.html' },
];

const LLMS_DISCLAIMER =
  '**Important disclaimer (applies to everything below):** This is an ' +
  'independent consumer-advocacy resource, not affiliated with, endorsed by, ' +
  'or sponsored by any company mentioned. All factual claims are based on ' +
  'publicly available sources (court filings, government press releases, ' +
  'academic publications, news reporting), and all sources are cited. The ' +
  'lawsuits and complaints described contain allegations that have not been ' +
  'proven in court; where a company resolved a case by settlement, it did so ' +
  'without admitting liability. Characterizations such as "trap" and "scam" ' +
  'are the authors\' opinions. This site does not provide legal advice.';

const LLMS_CONTACT =
  '## Contact\n' +
  '- Reader stories: stories@extraspacescam.com\n' +
  '- Corrections / accuracy disputes: editor@extraspacescam.com';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
});
turndown.remove(['script', 'style']);

function pageMarkdown(source, pageUrl) {
  const navEnd = source.indexOf('-->', source.indexOf('<!-- include nav')) + 3;
  const footerStart = source.indexOf('<!-- include footer');
  if (navEnd < 3 || footerStart === -1) {
    throw new Error('llms-full: could not locate nav/footer includes');
  }
  const html = source
    .slice(navEnd, footerStart)
    /* The hero video facade is visual chrome; reduce it to a plain link */
    .replace(
      /<a\s+class="hero-video-facade[\s\S]*?href="([^"]+)"[\s\S]*?yt-facade-title">([^<]*)<[\s\S]*?<\/a>/g,
      '<p><a href="$1">Hero video: $2</a></p>'
    )
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<img[^>]*>/g, '')
    /* Decorative kicker labels ("On the Record", …) read as stray words */
    .replace(/<span class="section-label">[^<]*<\/span>/g, '')
    /* Inline card/group labels run into the following text; make them blocks */
    .replace(/<span class="recourse-label[^"]*">([^<]*)<\/span>/g, '<p>$1</p>')
    /* Resolve links against the live site so the file stands alone */
    .replace(/href="#/g, `href="${pageUrl}#`)
    .replace(/href="\//g, 'href="https://extraspacescam.com/')
    .replace(/href="(?!https?:|mailto:)/g, 'href="https://extraspacescam.com/');
  return turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
}

async function buildLlmsFull() {
  const updated = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const header =
    '# ExtraSpaceScam.com — Full Text\n\n' +
    '> Independent consumer-awareness resource on Extra Space Storage ' +
    `(NYSE: EXR). Full text of all pages as Markdown, generated from the live site. Last updated: ${updated}.\n\n` +
    LLMS_DISCLAIMER;
  const sections = await Promise.all(
    LLMS_PAGES.map(async ({ file, label, url }) => {
      const source = await readFile(path.join(SRC, file), 'utf8');
      return `# Page: ${label} — ${url}\n\n${pageMarkdown(source, url)}`;
    })
  );
  const footer = `${LLMS_CONTACT}\n\n© ${new Date().getFullYear()} ExtraSpaceScam.com. All rights reserved.`;
  const text = [header, ...sections, footer].join('\n\n---\n\n') + '\n';
  await writeFile(path.join(DIST, 'llms-full.txt'), text);
}

async function buildCss() {
  const parts = await Promise.all(
    CSS_ORDER.map(f => readFile(path.join(SRC, 'css', f), 'utf8'))
  );
  const { code } = await transform(parts.join('\n'), { loader: 'css', minify: true });
  return code;
}

async function buildJs(file) {
  const source = await readFile(path.join(SRC, file), 'utf8');
  const { code } = await transform(source, { loader: 'js', minify: true });
  await writeFile(path.join(DIST, file), code);
}

async function copyStatic() {
  await Promise.all(
    STATIC_ASSETS.map(asset =>
      cp(path.join(SRC, asset), path.join(DIST, asset), { recursive: true })
    )
  );
}

/* Rasterize favicon.svg → transparent .ico and apple-touch-icon.png.
   Safari ignores SVG favicons; the old .ico had an opaque white matte. */
async function buildFavicons() {
  const svg = await readFile(path.join(SRC, 'favicon.svg'));
  const pngs = await Promise.all(
    [16, 32, 48].map(size =>
      sharp(svg, { density: 288 }).resize(size, size).png().toBuffer()
    )
  );
  const ico = await pngToIco(pngs);
  const apple = await sharp(svg, { density: 288 }).resize(180, 180).png().toBuffer();
  await Promise.all([
    writeFile(path.join(SRC, 'favicon.ico'), ico),
    writeFile(path.join(SRC, 'apple-touch-icon.png'), apple),
    writeFile(path.join(DIST, 'favicon.ico'), ico),
    writeFile(path.join(DIST, 'apple-touch-icon.png'), apple),
  ]);
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
const css = await buildCss();
await Promise.all([
  ...LANGS.flatMap(lang => PAGES.map(file => renderPage(file, lang, css))),
  buildJs('head.js'),
  buildJs('script.js'),
  buildLlmsFull(),
  buildFavicons(),
  copyStatic(),
]);
console.log(`Built ${PAGES.length * LANGS.length} pages (${LANGS.join(', ')}) → ${DIST}/`);
