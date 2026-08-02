import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.join(repositoryRoot, 'packages', 'mobile');
const distRoot = path.join(mobileRoot, 'dist');
const budget = JSON.parse(await readFile(path.join(mobileRoot, 'performance-budget.json'), 'utf8'));

const walk = async (directory) => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async (entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
}))).flat();

const files = await walk(distRoot);
const sizes = new Map(await Promise.all(files.map(async (file) => [file, (await stat(file)).size])));
const relative = (file) => path.relative(distRoot, file).replace(/\\/g, '/');
const findBundle = (platform, extension) => files.find((file) => relative(file).startsWith(`_expo/static/js/${platform}/`) && file.endsWith(extension));
const androidBundle = findBundle('android', '.hbc');
const iosBundle = findBundle('ios', '.hbc');
const webBundle = findBundle('web', '.js');
const totalArtifactBytes = [...sizes.values()].reduce((sum, size) => sum + size, 0);
const failures = [];

for (const [label, file, limit] of [
  ['Android bundle', androidBundle, budget.androidBundleBytes],
  ['iOS bundle', iosBundle, budget.iosBundleBytes],
  ['web bundle', webBundle, budget.webBundleBytes],
]) {
  if (!file) failures.push(`${label} is missing`);
  else if (sizes.get(file) > limit) failures.push(`${label} ${sizes.get(file)} > ${limit}`);
}
if (totalArtifactBytes > budget.totalArtifactBytes) failures.push(`total artifact ${totalArtifactBytes} > ${budget.totalArtifactBytes}`);

for (const file of files) {
  const name = relative(file);
  if (/\.map$/i.test(name)) failures.push(`public source map: ${name}`);
  if (/(^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore))$/i.test(name)) failures.push(`sensitive artifact name: ${name}`);
  const content = (await readFile(file)).toString('latin1');
  for (const [label, pattern] of [
    ['AWS access key', /AKIA[0-9A-Z]{16}/],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['embedded secret assignment', /(?:JWT_SECRET|AWS_SECRET_ACCESS_KEY|IMAGEKIT_PRIVATE_KEY)\s*=/i],
  ]) {
    if (pattern.test(content)) failures.push(`${label}: ${name}`);
  }
}

const bundleBytes = (file) => file ? sizes.get(file) : null;
console.log(JSON.stringify({
  checkedFiles: files.length,
  bundleBytes: {
    android: bundleBytes(androidBundle),
    ios: bundleBytes(iosBundle),
    web: bundleBytes(webBundle),
  },
  totalArtifactBytes,
  budgets: budget,
  sourceMaps: files.filter((file) => file.endsWith('.map')).length,
  failures,
}, null, 2));

if (failures.length) throw new Error(`Mobile artifact check failed: ${failures.join('; ')}`);
