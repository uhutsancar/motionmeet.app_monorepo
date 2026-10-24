import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The oldest Node.js release on each supported line that carries every fix
 * from the most recent security release.
 *
 * `pnpm audit` only looks at npm packages, so it cannot tell whether the
 * `node` binary running the API, the build or CI is still exposed to a CVE in
 * Node itself. This table is that answer. When nodejs.org publishes a new
 * security release, raise the affected minimums here and point `advisory` at
 * it; the Dockerfiles, the CI workflow and `engines` are then held to it by
 * `--scan`.
 *
 * Only LTS lines the project builds and tests on are listed. A Current line
 * (23, 25, 26) is rejected rather than trusted by default.
 */
export const NODE_SECURITY_BASELINE = {
  advisory: 'https://nodejs.org/en/blog/vulnerability/october-2026-security-releases',
  minimums: {
    22: '22.23.4',
    24: '24.22.1',
  },
};

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export const parseVersion = (value) => {
  const match = String(value ?? '').trim().match(VERSION_PATTERN);
  return match ? match.slice(1, 4).map(Number) : null;
};

const compareVersions = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

/** Whether one exact Node.js version is acceptable to run MotionMeet on. */
export const evaluateNodeVersion = (value, baseline = NODE_SECURITY_BASELINE) => {
  const version = parseVersion(value);
  if (!version) return { ok: false, reason: `"${value}" is not an exact Node.js version` };
  const minimum = baseline.minimums[version[0]];
  if (!minimum) {
    return { ok: false, reason: `Node.js ${version.join('.')} is not on a supported line (${Object.keys(baseline.minimums).join(', ')})` };
  }
  if (compareVersions(version, parseVersion(minimum)) < 0) {
    return { ok: false, reason: `Node.js ${version.join('.')} predates the security release ${minimum} (${baseline.advisory})` };
  }
  return { ok: true, reason: `Node.js ${version.join('.')} meets the ${minimum} minimum` };
};

/**
 * Every `FROM node:...` in a Dockerfile must name an exact patched release.
 *
 * A floating tag such as `node:24-alpine` is what let the images sit on an
 * unpatched runtime: the file never changed, so nothing showed that the cached
 * base under it was months old. An exact tag (optionally with its digest) makes
 * the runtime version a reviewed line in the diff.
 */
export const scanDockerfile = (text, label, baseline = NODE_SECURITY_BASELINE) => {
  const failures = [];
  const stages = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?(?:docker\.io\/)?(?:library\/)?node:([^\s@]+)(@sha256:[0-9a-f]{64})?/i);
    if (!match) continue;
    const where = `${label}:${index + 1}`;
    const tag = match[1];
    const version = tag.match(/^(\d+\.\d+\.\d+)(?:-[a-z0-9.]+)?$/i)?.[1];
    stages.push({ where, tag, digest: match[2]?.slice(1) ?? null });
    if (!version) {
      failures.push(`${where}: node:${tag} is a floating tag; pin an exact patched release`);
      continue;
    }
    const result = evaluateNodeVersion(version, baseline);
    if (!result.ok) failures.push(`${where}: ${result.reason}`);
  }
  return { failures, stages };
};

/** `node-version:` entries in a GitHub Actions workflow, scalar or list. */
export const scanWorkflow = (text, label, baseline = NODE_SECURITY_BASELINE) => {
  const failures = [];
  const versions = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*node-version:\s*(.+?)\s*(?:#.*)?$/);
    if (!match) continue;
    const value = match[1];
    if (value.startsWith('${{')) continue;
    const entries = value.startsWith('[')
      ? value.replace(/^\[|\]$/g, '').split(',')
      : [value];
    for (const entry of entries) {
      const version = entry.trim().replace(/^["']|["']$/g, '');
      const where = `${label}:${index + 1}`;
      versions.push({ where, version });
      const result = evaluateNodeVersion(version, baseline);
      if (!result.ok) failures.push(`${where}: node-version ${version}: ${result.reason}`);
    }
  }
  return { failures, versions };
};

/**
 * `engines.node` must admit only patched releases of the supported lines, and
 * each line must be closed above so a Current major is not accepted by accident.
 */
export const scanEngines = (range, baseline = NODE_SECURITY_BASELINE) => {
  const failures = [];
  if (typeof range !== 'string' || !range.trim()) return { failures: ['package.json engines.node is missing'] };
  for (const part of range.split('||').map((entry) => entry.trim())) {
    const match = part.match(/^>=\s*(\d+\.\d+\.\d+)\s+<\s*(\d+)(?:\.0\.0)?$/);
    if (!match) {
      failures.push(`engines.node "${part}" must look like ">=X.Y.Z <X+1"`);
      continue;
    }
    const result = evaluateNodeVersion(match[1], baseline);
    if (!result.ok) failures.push(`engines.node "${part}": ${result.reason}`);
    if (Number(match[2]) !== parseVersion(match[1])[0] + 1) failures.push(`engines.node "${part}" must stop before the next major`);
  }
  return { failures };
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const findDockerfiles = async (directory) => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'android', '.turbo', '.pnpm-store'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findDockerfiles(target));
    else if (/^Dockerfile(?:\..+)?$/.test(entry.name)) found.push(target);
  }
  return found;
};

export const scanRepository = async (root = repositoryRoot, baseline = NODE_SECURITY_BASELINE) => {
  const failures = [];
  const relative = (file) => path.relative(root, file).replace(/\\/g, '/');

  const dockerStages = [];
  for (const file of await findDockerfiles(path.join(root, 'packages'))) {
    const result = scanDockerfile(await readFile(file, 'utf8'), relative(file), baseline);
    failures.push(...result.failures);
    dockerStages.push(...result.stages);
  }

  const workflowVersions = [];
  const workflowDirectory = path.join(root, '.github', 'workflows');
  for (const name of await readdir(workflowDirectory).catch(() => [])) {
    if (!/\.ya?ml$/.test(name)) continue;
    const result = scanWorkflow(await readFile(path.join(workflowDirectory, name), 'utf8'), `.github/workflows/${name}`, baseline);
    failures.push(...result.failures);
    workflowVersions.push(...result.versions);
  }
  if (!workflowVersions.length) failures.push('no node-version found in .github/workflows');

  const engines = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).engines?.node;
  failures.push(...scanEngines(engines, baseline).failures);

  return { failures, dockerStages, workflowVersions, engines };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const requested = process.argv.find((argument) => argument.startsWith('--version='))?.slice('--version='.length);
  const runtimeVersion = requested ?? process.versions.node;
  const runtime = evaluateNodeVersion(runtimeVersion);
  const report = {
    advisory: NODE_SECURITY_BASELINE.advisory,
    minimums: NODE_SECURITY_BASELINE.minimums,
    checked: requested ? 'requested version' : 'running binary',
    node: runtimeVersion,
    openssl: requested ? null : process.versions.openssl,
    runtime,
    failures: runtime.ok ? [] : [runtime.reason],
  };
  if (process.argv.includes('--scan')) {
    const repository = await scanRepository();
    Object.assign(report, { dockerStages: repository.dockerStages, workflowVersions: repository.workflowVersions, engines: repository.engines });
    report.failures.push(...repository.failures);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) {
    console.error(`Node.js security check failed:\n- ${report.failures.join('\n- ')}`);
    process.exitCode = 1;
  }
}
