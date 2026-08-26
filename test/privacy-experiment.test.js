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

test('experiment commands receive a minimal environment unless full inheritance is explicit', () => {
  const root = temporaryDirectory();
  const planFile = path.join(root, 'experiment.json');
  const variable = 'SKILL_SUNSET_PRIVATE_TEST_VALUE';
  process.env[variable] = 'must-not-leak';
  fs.writeFileSync(planFile, JSON.stringify({
    schemaVersion: 1,
    candidateId: 'environment-boundary',
    repetitions: 1,
    baseline: { command: [process.execPath, '-e', `process.exit(process.env.${variable} ? 9 : 0)`] },
    candidate: { command: [process.execPath, '-e', `process.exit(process.env.${variable} ? 9 : 0)`] }
  }));
  try {
    const plan = loadExperimentPlan(planFile, root);
    const protectedResult = runExperiment(plan);
    assert.equal(protectedResult.verdict, 'PASS');
    assert.equal(protectedResult.environmentPolicy, 'minimal-allowlist');

    const inheritedResult = runExperiment(plan, { inheritEnvironment: true });
    assert.equal(inheritedResult.verdict, 'INCONCLUSIVE');
    assert.equal(inheritedResult.environmentPolicy, 'explicit-full-inheritance');

    const dryRun = renderExperimentDryRun(plan);
    assert.ok(!dryRun.includes('process.env'));
    assert.ok(!dryRun.includes('must-not-leak'));
  } finally {
    delete process.env[variable];
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
    candidate: { command: [process.execPath, '-e', 'process.exit(0)'] }
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
