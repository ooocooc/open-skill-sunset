import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { redactAbsolutePath } from './privacy.js';

const MAX_REPETITIONS = 10;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;
const SAFE_ENVIRONMENT_KEYS = new Set([
  'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC',
  'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ',
  'NO_COLOR', 'FORCE_COLOR'
]);

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function validateCommand(name, value, root) {
  if (!value || !Array.isArray(value.command) || value.command.length === 0 || value.command.some((part) => typeof part !== 'string' || !part)) {
    throw new Error(`${name}.command must be a non-empty string array`);
  }
  const cwd = path.resolve(root, value.cwd ?? '.');
  if (!inside(root, cwd)) throw new Error(`${name}.cwd must stay inside --root`);
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`${name}.cwd does not exist: ${cwd}`);
  return { command: value.command, cwd };
}

export function loadExperimentPlan(file, rootDirectory) {
  const absoluteFile = path.resolve(file);
  const plan = JSON.parse(fs.readFileSync(absoluteFile, 'utf8'));
  if (plan.schemaVersion !== 1) throw new Error('experiment plan must use schemaVersion 1');
  if (typeof plan.candidateId !== 'string' || !plan.candidateId) throw new Error('experiment plan requires candidateId');
  const root = path.resolve(rootDirectory ?? path.dirname(absoluteFile));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`experiment root does not exist: ${root}`);
  const repetitions = plan.repetitions ?? 1;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > MAX_REPETITIONS) {
    throw new Error(`repetitions must be between 1 and ${MAX_REPETITIONS}`);
  }
  const timeoutMs = plan.timeoutMs ?? 120000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`timeoutMs must be between 100 and ${MAX_TIMEOUT_MS}`);
  }
  const baseline = validateCommand('baseline', plan.baseline, root);
  const candidate = validateCommand('candidate', plan.candidate, root);
  const acceptance = {
    requireExitCode: plan.acceptance?.requireExitCode ?? 0,
    maxDurationRegressionPercent: plan.acceptance?.maxDurationRegressionPercent ?? 25,
    requireStdoutMatch: plan.acceptance?.requireStdoutMatch ?? false
  };
  if (!Number.isInteger(acceptance.requireExitCode)) throw new Error('acceptance.requireExitCode must be an integer');
  if (typeof acceptance.maxDurationRegressionPercent !== 'number' || acceptance.maxDurationRegressionPercent < 0) {
    throw new Error('acceptance.maxDurationRegressionPercent must be a non-negative number');
  }
  if (typeof acceptance.requireStdoutMatch !== 'boolean') throw new Error('acceptance.requireStdoutMatch must be boolean');
  return { schemaVersion: 1, candidateId: plan.candidateId, root, repetitions, timeoutMs, baseline, candidate, acceptance };
}

function outputDigest(value) {
  return crypto.createHash('sha256').update(value ?? '').digest('hex');
}

function commandRecord(command) {
  return {
    executable: path.basename(command[0]),
    argumentCount: command.length - 1,
    commandSha256: crypto.createHash('sha256').update(command.join('\0')).digest('hex')
  };
}

function minimalEnvironment(source) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => SAFE_ENVIRONMENT_KEYS.has(key)));
}

function executeVariant(variant, repetitions, timeoutMs, inheritEnvironment) {
  const runs = [];
  const environment = inheritEnvironment ? process.env : minimalEnvironment(process.env);
  for (let index = 0; index < repetitions; index += 1) {
    const started = process.hrtime.bigint();
    const result = spawnSync(variant.command[0], variant.command.slice(1), {
      cwd: variant.cwd,
      encoding: 'utf8',
      shell: false,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: environment
    });
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    runs.push({
      repetition: index + 1,
      exitCode: result.status,
      signal: result.signal,
      timedOut: result.error?.code === 'ETIMEDOUT',
      launchError: result.error ? (result.error.code ?? 'PROCESS_ERROR') : null,
      durationMs: Math.round(durationMs * 100) / 100,
      stdoutBytes: Buffer.byteLength(result.stdout ?? ''),
      stderrBytes: Buffer.byteLength(result.stderr ?? ''),
      stdoutSha256: outputDigest(result.stdout),
      stderrSha256: outputDigest(result.stderr)
    });
  }
  return runs;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function runExperiment(plan, options = {}) {
  const inheritEnvironment = options.inheritEnvironment === true;
  const baselineRuns = executeVariant(plan.baseline, plan.repetitions, plan.timeoutMs, inheritEnvironment);
  const candidateRuns = executeVariant(plan.candidate, plan.repetitions, plan.timeoutMs, inheritEnvironment);
  const required = plan.acceptance.requireExitCode;
  const baselinePasses = baselineRuns.every((run) => run.exitCode === required && !run.timedOut && !run.launchError);
  const candidatePasses = candidateRuns.every((run) => run.exitCode === required && !run.timedOut && !run.launchError);
  const baselineMedianMs = median(baselineRuns.map((run) => run.durationMs));
  const candidateMedianMs = median(candidateRuns.map((run) => run.durationMs));
  const durationRegressionPercent = baselineMedianMs === 0 ? 0 : ((candidateMedianMs - baselineMedianMs) / baselineMedianMs) * 100;
  const outputMatches = baselineRuns.every((run, index) => run.stdoutSha256 === candidateRuns[index]?.stdoutSha256);
  const reasons = [];
  let verdict = 'PASS';
  if (!baselinePasses) {
    verdict = 'INCONCLUSIVE';
    reasons.push('baseline did not satisfy the acceptance exit code on every run');
  } else if (!candidatePasses) {
    verdict = 'REGRESSION';
    reasons.push('candidate did not satisfy the acceptance exit code on every run');
  }
  if (verdict === 'PASS' && durationRegressionPercent > plan.acceptance.maxDurationRegressionPercent) {
    verdict = 'REGRESSION';
    reasons.push(`candidate median duration regressed by ${durationRegressionPercent.toFixed(1)}%`);
  }
  if (verdict === 'PASS' && plan.acceptance.requireStdoutMatch && !outputMatches) {
    verdict = 'REGRESSION';
    reasons.push('candidate stdout hash differs from baseline');
  }
  if (verdict === 'PASS') reasons.push('candidate met the configured non-inferiority gates');
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidateId: plan.candidateId,
    verdict,
    reasons,
    acceptance: plan.acceptance,
    environmentPolicy: inheritEnvironment ? 'explicit-full-inheritance' : 'minimal-allowlist',
    metrics: {
      baselineMedianMs: Math.round(baselineMedianMs * 100) / 100,
      candidateMedianMs: Math.round(candidateMedianMs * 100) / 100,
      durationRegressionPercent: Math.round(durationRegressionPercent * 100) / 100,
      outputMatches
    },
    baseline: { ...commandRecord(plan.baseline.command), cwd: redactAbsolutePath(plan.baseline.cwd), runs: baselineRuns },
    candidate: { ...commandRecord(plan.candidate.command), cwd: redactAbsolutePath(plan.candidate.cwd), runs: candidateRuns },
    limitations: [
      'A passing command is only evidence for the acceptance criteria encoded by that command.',
      'The harness does not modify instructions or infer that a candidate configuration was applied correctly.',
      'Captured stdout and stderr are represented only by byte counts and SHA-256 hashes to reduce secret leakage.',
      'Commands receive a minimal environment by default; full inheritance requires the explicit --inherit-env flag.'
    ]
  };
}

export function writeExperimentResult(result, outputDirectory) {
  const directory = path.resolve(outputDirectory);
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = result.generatedAt.replace(/[-:.]/g, '');
  const file = path.join(directory, `experiment-result-${timestamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return file;
}

export function renderExperimentDryRun(plan) {
  const baseline = commandRecord(plan.baseline.command);
  const candidate = commandRecord(plan.candidate.command);
  return [
    'Skill Sunset experiment plan validated; no commands were run.',
    '',
    `Candidate    ${plan.candidateId}`,
    `Root         ${redactAbsolutePath(plan.root)}`,
    `Repetitions  ${plan.repetitions}`,
    `Timeout      ${plan.timeoutMs} ms`,
    `Baseline     ${baseline.executable} (${baseline.argumentCount} args, sha256 ${baseline.commandSha256})`,
    `Candidate    ${candidate.executable} (${candidate.argumentCount} args, sha256 ${candidate.commandSha256})`,
    '',
    'Re-run with --run to execute both command arrays without a shell and with a minimal environment.',
    'Add --inherit-env only when the commands are trusted and require the caller\'s full environment.',
    ''
  ].join('\n');
}
