/*
  Static site build: src/ → dist/

  - Expands `<!-- include name key="value" -->` directives in src/*.html with
    the partials in src/partials/, substituting {{key}} placeholders.
  - Concatenates the css/ modules in cascade order and minifies the result to
    a single dist/css/styles.css.
  - Minifies head.js and script.js.
  - Copies all other static assets verbatim.

  Run with: npm run build
*/

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const SRC = 'src';
const DIST = 'dist';

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

async function partial(name) {
  if (!partialCache.has(name)) {
    const file = path.join(SRC, 'partials', `${name}.html`);
    partialCache.set(name, (await readFile(file, 'utf8')).replace(/\n$/, ''));
  }
  return partialCache.get(name);
}

async function renderPage(file) {
  const source = await readFile(path.join(SRC, file), 'utf8');

  /* Resolve includes sequentially (replaceAll + async don't mix) */
  let out = '';
  let last = 0;
  for (const match of source.matchAll(INCLUDE_RE)) {
    const [directive, name, attrs] = match;
    const vars = {};
    for (const [, key, dq, sq] of attrs.matchAll(ATTR_RE)) vars[key] = dq ?? sq;

    let html = await partial(name);
    /* Unset keys render as empty strings (e.g. optional aria-current) */
    html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');

    out += source.slice(last, match.index) + html;
    last = match.index + directive.length;
  }
  out += source.slice(last);

  if (/<!--\s*include\s/.test(out)) {
    throw new Error(`${file}: unresolved include directive after rendering`);
  }
  await writeFile(path.join(DIST, file), out);
}

async function buildCss() {
  const parts = await Promise.all(
    CSS_ORDER.map(f => readFile(path.join(SRC, 'css', f), 'utf8'))
  );
  const { code } = await transform(parts.join('\n'), { loader: 'css', minify: true });
  await mkdir(path.join(DIST, 'css'), { recursive: true });
  await writeFile(path.join(DIST, 'css', 'styles.css'), code);
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
await Promise.all([
  ...PAGES.map(renderPage),
  buildCss(),
  buildJs('head.js'),
  buildJs('script.js'),
  copyStatic(),
]);
console.log(`Built ${PAGES.length} pages → ${DIST}/`);
