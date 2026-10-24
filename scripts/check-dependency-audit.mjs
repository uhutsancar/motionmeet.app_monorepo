import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The CI dependency gate: `pnpm audit --prod`, failing on any high or critical
 * advisory that has not been explicitly accepted in audit-exceptions.json.
 *
 * Plain `pnpm audit --audit-level=high` has no way to say "this one has no fix
 * yet and does not reach us", so a single unfixable advisory kept the whole job
 * red and every real regression behind it went unnoticed. pnpm's own
 * `ignoreGhsas` would silence it forever instead. An exception here names the
 * package, says why it is acceptable and expires: once the date passes the gate
 * fails again until somebody re-reviews it.
 */
const GATED_SEVERITIES = new Set(['high', 'critical']);

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const evaluateAudit = (report, exceptions, today = new Date()) => {
  const day = today.toISOString().slice(0, 10);
  const failures = [];
  const accepted = [];
  const ungated = [];
  const matchedExceptions = new Set();

  for (const exception of exceptions) {
    if (!/^GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}$/.test(exception.ghsa ?? '') || !exception.package || !exception.reason || !/^\d{4}-\d{2}-\d{2}$/.test(exception.expires ?? '')) {
      failures.push(`malformed audit exception: ${JSON.stringify(exception)}`);
    } else if (exception.expires < day) {
      failures.push(`audit exception for ${exception.package} ${exception.ghsa} expired on ${exception.expires}; re-review it`);
    }
  }

  for (const advisory of Object.values(report.advisories ?? {})) {
    const entry = {
      ghsa: advisory.github_advisory_id,
      package: advisory.module_name,
      severity: advisory.severity,
      installed: [...new Set((advisory.findings ?? []).map((finding) => finding.version))],
      patched: advisory.patched_versions,
      url: advisory.url,
    };
    if (!GATED_SEVERITIES.has(advisory.severity)) {
      ungated.push(entry);
      continue;
    }
    const exception = exceptions.find((candidate) => candidate.ghsa === entry.ghsa && candidate.package === entry.package);
    if (exception && exception.expires >= day) {
      matchedExceptions.add(exception);
      accepted.push({ ...entry, expires: exception.expires });
    } else {
      failures.push(`${entry.severity} ${entry.package}@${entry.installed.join(',')} ${entry.ghsa} (patched: ${entry.patched}) ${entry.url}`);
    }
  }

  const unusedExceptions = exceptions.filter((exception) => !matchedExceptions.has(exception)).map(({ package: name, ghsa }) => `${name} ${ghsa}`);
  return { failures, accepted, ungated, unusedExceptions };
};

/** pnpm is reached through Corepack locally and on PATH in CI. */
const runPnpmAudit = () => {
  const args = ['audit', '--prod', '--json'];
  const execPath = process.env.npm_execpath;
  const options = { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  if (execPath && /\.c?js$/.test(execPath)) return spawnSync(process.execPath, [execPath, ...args], options);
  // Windows resolves pnpm.cmd only through a shell; the arguments are constants.
  return process.platform === 'win32'
    ? spawnSync(`pnpm ${args.join(' ')}`, { ...options, shell: true })
    : spawnSync('pnpm', args, options);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const exceptions = JSON.parse(await readFile(path.join(repositoryRoot, 'scripts', 'audit-exceptions.json'), 'utf8')).exceptions;
  const result = runPnpmAudit();
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = null;
  }
  // An unreachable registry is not "zero vulnerabilities". It is reported as
  // blocked and still fails the job, with its own exit code.
  if (!report || report.error || !report.advisories) {
    console.error(`BLOCKED: pnpm audit returned no advisory report (exit ${result.status}).`);
    console.error((result.stderr || result.stdout || '').slice(0, 2000));
    process.exit(2);
  }
  const evaluation = evaluateAudit(report, exceptions);
  console.log(JSON.stringify({
    totals: report.metadata?.vulnerabilities,
    gatedSeverities: [...GATED_SEVERITIES],
    acceptedExceptions: evaluation.accepted,
    unusedExceptions: evaluation.unusedExceptions,
    belowGate: evaluation.ungated.map(({ severity, package: name, ghsa, installed, patched }) => `${severity} ${name}@${installed.join(',')} ${ghsa} (patched: ${patched})`),
    failures: evaluation.failures,
  }, null, 2));
  if (evaluation.unusedExceptions.length) console.warn(`Audit exceptions no longer needed (remove them): ${evaluation.unusedExceptions.join(', ')}`);
  if (evaluation.failures.length) {
    console.error(`Dependency audit failed:\n- ${evaluation.failures.join('\n- ')}`);
    process.exitCode = 1;
  }
}
