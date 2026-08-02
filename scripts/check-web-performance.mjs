import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repositoryRoot, 'packages', 'web');
const distRoot = path.join(webRoot, 'dist');
const budget = JSON.parse(await readFile(path.join(webRoot, 'performance-budget.json'), 'utf8'));
const indexHtml = await readFile(path.join(distRoot, 'index.html'), 'utf8');

const entryMatch = indexHtml.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)
  ?? indexHtml.match(/<script[^>]+src=["']([^"']+)["'][^>]+type=["']module["']/i);
if (!entryMatch) throw new Error('Production index.html does not contain a module entry.');

const fromPublicPath = (value) => path.join(distRoot, value.replace(/^\//, ''));
const staticImports = (source) => {
  const imports = new Set();
  for (const match of source.matchAll(/\bimport(?!\s*\()[^"'()]*?\bfrom\s*["']([^"']+)["']/g)) {
    if (match[1].startsWith('.')) imports.add(match[1]);
  }
  for (const match of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
    if (match[1].startsWith('.')) imports.add(match[1]);
  }
  return imports;
};

const initialFiles = new Set();
const visit = async (file) => {
  const absolute = path.resolve(file);
  if (initialFiles.has(absolute)) return;
  initialFiles.add(absolute);
  const source = await readFile(absolute, 'utf8');
  for (const imported of staticImports(source)) {
    await visit(path.resolve(path.dirname(absolute), imported));
  }
};
await visit(fromPublicPath(entryMatch[1]));

const gzipBytes = async (file) => gzipSync(await readFile(file), { level: 9 }).byteLength;
const initialJsGzipBytes = (await Promise.all([...initialFiles].map(gzipBytes))).reduce((sum, size) => sum + size, 0);
const cssFiles = [...indexHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map((match) => fromPublicPath(match[1]));
const initialCssGzipBytes = (await Promise.all(cssFiles.map(gzipBytes))).reduce((sum, size) => sum + size, 0);

const assetNames = await readdir(path.join(distRoot, 'assets'));
const jsChunks = assetNames.filter((name) => name.endsWith('.js'));
const chunkSizes = await Promise.all(jsChunks.map(async (name) => ({ name, gzipBytes: await gzipBytes(path.join(distRoot, 'assets', name)) })));
const largestChunk = chunkSizes.sort((left, right) => right.gzipBytes - left.gzipBytes)[0];

const failures = [];
if (initialJsGzipBytes > budget.initialJsGzipBytes) failures.push(`initial JS ${initialJsGzipBytes} > ${budget.initialJsGzipBytes}`);
if (initialCssGzipBytes > budget.initialCssGzipBytes) failures.push(`initial CSS ${initialCssGzipBytes} > ${budget.initialCssGzipBytes}`);
if (largestChunk?.gzipBytes > budget.maxJsChunkGzipBytes) failures.push(`largest JS chunk ${largestChunk.gzipBytes} > ${budget.maxJsChunkGzipBytes}`);

console.log(JSON.stringify({
  initialJsGzipBytes,
  initialCssGzipBytes,
  largestJsChunk: largestChunk,
  budgets: budget,
  initialFiles: [...initialFiles].map((file) => path.relative(distRoot, file).replace(/\\/g, '/')).sort(),
}, null, 2));

if (failures.length) throw new Error(`Web performance budget failed: ${failures.join('; ')}`);
