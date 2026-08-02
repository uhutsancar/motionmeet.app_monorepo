import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repositoryRoot, 'packages', 'web', 'dist');

const walk = async (directory) => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async (entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
}))).flat();

const files = await walk(distRoot);
const failures = [];
for (const file of files) {
  const relative = path.relative(distRoot, file).replace(/\\/g, '/');
  if (/\.map$/i.test(relative)) failures.push(`public source map: ${relative}`);
  if (/(^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore))$/i.test(relative)) failures.push(`sensitive artifact name: ${relative}`);
  const extension = path.extname(file).toLowerCase();
  if (!['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(extension)) continue;
  const content = await readFile(file, 'utf8');
  for (const [label, pattern] of [
    ['AWS access key', /AKIA[0-9A-Z]{16}/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['placeholder secret', /JWT_SECRET\s*=|AWS_SECRET_ACCESS_KEY\s*=|IMAGEKIT_PRIVATE_KEY\s*=/i],
  ]) {
    if (pattern.test(content)) failures.push(`${label}: ${relative}`);
  }
}

const nginx = await readFile(path.join(repositoryRoot, 'packages', 'web', 'nginx.conf'), 'utf8');
for (const required of ['server_tokens off', 'Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options']) {
  if (!nginx.includes(required)) failures.push(`nginx policy missing: ${required}`);
}
if (/autoindex\s+on/i.test(nginx)) failures.push('nginx autoindex must remain disabled');

const vercel = JSON.parse(await readFile(path.join(repositoryRoot, 'packages', 'web', 'vercel.json'), 'utf8'));
const vercelHeaders = new Set((vercel.headers ?? []).flatMap((rule) => rule.headers ?? []).map((header) => String(header.key).toLowerCase()));
for (const required of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options']) {
  if (!vercelHeaders.has(required)) failures.push(`Vercel policy missing: ${required}`);
}

console.log(JSON.stringify({ checkedFiles: files.length, sourceMaps: files.filter((file) => file.endsWith('.map')).length, failures }, null, 2));
if (failures.length) throw new Error(`Web artifact security check failed: ${failures.join('; ')}`);
