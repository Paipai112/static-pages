import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(root, 'pages-dist');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'assets'), { recursive: true });
const html = await readFile(resolve(dist, 'demo.html'));
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, 'demo.html'), html);
await cp(resolve(dist, 'favicon.svg'), resolve(output, 'favicon.svg'));
for (const file of await readdir(resolve(dist, 'assets'))) {
  if (!file.startsWith('main-')) await cp(resolve(dist, 'assets', file), resolve(output, 'assets', file));
}
console.log('Demo Pages package written to pages-dist/');
