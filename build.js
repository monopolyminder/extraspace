/*
  Static site build: src/ → dist/

  - Expands `<!-- include name key="value" -->` directives in src/*.html with
    the partials in src/partials/, substituting {{key}} placeholders.
  - Concatenates the css/ modules in cascade order, minifies the result and
    inlines it into each page's <head> (replacing the stylesheet link in the
    head-assets partial) so first paint needs no render-blocking CSS request.
  - Minifies head.js and script.js.
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

const SRC = 'src';
const DIST = 'dist';

const LANGS = ['en', 'es']; /* 'en' is the root/default language */
const PAGES = ['index.html', 'about.html', 'how-it-works.html'];

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
  'llms-full.txt',
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

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
const css = await buildCss();
await Promise.all([
  ...LANGS.flatMap(lang => PAGES.map(file => renderPage(file, lang, css))),
  buildJs('head.js'),
  buildJs('script.js'),
  copyStatic(),
]);
console.log(`Built ${PAGES.length * LANGS.length} pages (${LANGS.join(', ')}) → ${DIST}/`);
