import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { analyze } from '../src/analyzer.js';
import { loadExperimentPlan, renderExperimentDryRun, runExperiment } from '../src/experiment.js';
import { writeReports } from '../src/report.js';

function temporaryDirectory(prefix = 'skill-sunset-security-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runWithDurations(t, plan, baselineMs, candidateMs) {
  assert.equal(plan.repetitions, 1);
  const baselineNs = BigInt(Math.round(baselineMs * 1_000_000));
  const candidateNs = BigInt(Math.round(candidateMs * 1_000_000));
  const timestamps = [0n, baselineNs, baselineNs, baselineNs + candidateNs];
  const clock = t.mock.method(process.hrtime, 'bigint', () => {
    assert.ok(timestamps.length > 0, 'unexpected experiment clock read');
    return timestamps.shift();
  });
  try {
    const result = runExperiment(plan);
    assert.equal(timestamps.length, 0, 'both command durations should be measured');
    return result;
  } finally {
    clock.mock.restore();
  }
}

function assertCommandOutcomes(result, expectedExitCode) {
  for (const variant of ['baseline', 'candidate']) {
    assert.equal(result[variant].runs.length, 1);
    const run = result[variant].runs[0];
    assert.equal(run.exitCode, expectedExitCode, `${variant} exit code`);
    assert.equal(run.signal, null, `${variant} signal`);
    assert.equal(run.timedOut, false, `${variant} timeout`);
    assert.equal(run.launchError, null, `${variant} launch error`);
  }
}

test('redacts absolute target paths from every generated report artifact', () => {
  const result = analyze(path.resolve('test/fixtures/sample-setup'));
  const output = temporaryDirectory();
  const reports = writeReports(result, output, 'en');
  const privatePrefix = `${os.homedir()}${path.sep}`;
  for (const file of Object.values(reports)) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes(privatePrefix), `${path.basename(file)} exposed the home path`);
  }
  assert.match(fs.readFileSync(reports.json, 'utf8'), /\$(?:HOME|ABSOLUTE)\//);
});

test('experiment commands receive a minimal environment unless full inheritance is explicit', (t) => {
  const root = temporaryDirectory();
  const planFile = path.join(root, 'experiment.json');
  const variable = 'SKILL_SUNSET_PRIVATE_TEST_VALUE';
  const previousValue = process.env[variable];
  fs.writeFileSync(planFile, JSON.stringify({
    schemaVersion: 1,
    candidateId: 'environment-boundary',
    repetitions: 1,
    baseline: { command: [process.execPath, '-e', `process.exit(process.env.${variable} ? 9 : 0)`] },
    candidate: { command: [process.execPath, '-e', `process.exit(process.env.${variable} ? 9 : 0)`] }
  }));
  try {
    process.env[variable] = 'must-not-leak';
    const plan = loadExperimentPlan(planFile, root);
    // Force a timing regression: environment isolation must not depend on speed.
    const protectedResult = runWithDurations(t, plan, 10, 13);
    assertCommandOutcomes(protectedResult, 0);
    assert.equal(protectedResult.environmentPolicy, 'minimal-allowlist');

    const inheritedResult = runExperiment(plan, { inheritEnvironment: true });
    assertCommandOutcomes(inheritedResult, 9);
    assert.equal(inheritedResult.verdict, 'INCONCLUSIVE');
    assert.equal(inheritedResult.environmentPolicy, 'explicit-full-inheritance');

    const dryRun = renderExperimentDryRun(plan);
    assert.ok(!dryRun.includes('process.env'));
    assert.ok(!dryRun.includes('must-not-leak'));
  } finally {
    if (previousValue === undefined) delete process.env[variable];
    else process.env[variable] = previousValue;
  }
});

test('experiment duration gate enforces the default threshold with a deterministic clock', (t) => {
  const root = temporaryDirectory();
  const planFile = path.join(root, 'experiment.json');
  fs.writeFileSync(planFile, JSON.stringify({
    schemaVersion: 1,
    candidateId: 'duration-boundary',
    repetitions: 1,
    baseline: { command: [process.execPath, '-e', 'process.exit(0)'] },
    candidate: { command: [process.execPath, '-e', 'process.exit(0)'] }
  }));
  const plan = loadExperimentPlan(planFile, root);
  assert.equal(plan.acceptance.maxDurationRegressionPercent, 25);

  for (const [candidateMs, regressionPercent, verdict] of [
    [12, 20, 'PASS'],
    [12.5, 25, 'PASS'],
    [13, 30, 'REGRESSION']
  ]) {
    const result = runWithDurations(t, plan, 10, candidateMs);
    assertCommandOutcomes(result, 0);
    assert.equal(result.metrics.baselineMedianMs, 10);
    assert.equal(result.metrics.candidateMedianMs, candidateMs);
    assert.equal(result.metrics.durationRegressionPercent, regressionPercent);
    assert.equal(result.verdict, verdict, `${regressionPercent}% duration regression`);
    if (verdict === 'REGRESSION') {
      assert.deepEqual(result.reasons, ['candidate median duration regressed by 30.0%']);
    }
  }
});

test('CLI keeps execution and full environment inheritance behind separate flags', () => {
  const root = temporaryDirectory();
  const marker = path.join(root, 'marker.txt');
  const planFile = path.join(root, 'experiment.json');
  fs.writeFileSync(planFile, JSON.stringify({
    schemaVersion: 1,
    candidateId: 'cli-gates',
    repetitions: 1,
    baseline: { command: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`] },
    candidate: { command: [process.execPath, '-e', 'process.exit(0)'] },
    acceptance: { maxDurationRegressionPercent: 100000 }
  }));
  const bin = path.resolve('bin/skill-sunset.js');
  const dryRun = spawnSync(process.execPath, [bin, 'test', planFile, '--root', root], { encoding: 'utf8' });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(fs.existsSync(marker), false);
  assert.ok(!dryRun.stdout.includes('writeFileSync'));

  const unsafeDryRun = spawnSync(process.execPath, [bin, 'test', planFile, '--root', root, '--inherit-env'], { encoding: 'utf8' });
  assert.equal(unsafeDryRun.status, 1);
  assert.match(unsafeDryRun.stderr, /--inherit-env requires --run/);

  const executed = spawnSync(process.execPath, [bin, 'test', planFile, '--root', root, '--run'], { encoding: 'utf8' });
  assert.equal(executed.status, 0, executed.stderr);
  assert.equal(fs.existsSync(marker), true);
});
