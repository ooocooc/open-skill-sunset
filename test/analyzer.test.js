import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyze } from '../src/analyzer.js';
import { writeReports } from '../src/report.js';

const fixture = path.resolve('test/fixtures/sample-setup');

test('offers dependency-free download commands without global installation', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(packageJson.scripts['scan:codex'], 'node ./bin/skill-sunset.js audit --codex --open');
  assert.equal(packageJson.scripts['scan:claude'], 'node ./bin/skill-sunset.js audit --claude --open');
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);

  const readme = fs.readFileSync(path.resolve('README.md'), 'utf8');
  assert.match(readme, /Run it — no install/);
  assert.doesNotMatch(readme, /From the downloaded project folder, install the command once/);
});

test('finds deterministic and semantic review candidates', () => {
  const result = analyze(fixture);
  const ruleIds = new Set(result.findings.map((item) => item.ruleId));
  assert.equal(result.summary.scannedFiles, 5);
  assert.ok(ruleIds.has('context7-assumption'));
  assert.ok(ruleIds.has('progressive-disclosure'));
  assert.ok(ruleIds.has('exact-bundle-duplicate-same-name'));
  assert.ok(ruleIds.has('broken-reference'));
  assert.equal(result.summary.domainExcluded, 1);
  assert.equal(result.summary.verdicts.RETIRE, 1);
});

test('writes a portable report bundle', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-sunset-test-'));
  const files = writeReports(analyze(fixture), directory, 'en');
  for (const file of Object.values(files)) assert.ok(fs.existsSync(file));
  const html = fs.readFileSync(files.htmlEnglish, 'utf8');
  const chineseHtml = fs.readFileSync(files.htmlChinese, 'utf8');
  assert.match(html, /Audit findings/);
  assert.match(html, /Handle findings/);
  assert.match(html, /Needs validation/);
  assert.match(html, /Hand off verdict-specific work/);
  assert.match(html, /简体中文/);
  assert.match(chineseHtml, /审查发现/);
  assert.match(chineseHtml, /交给 Agent 分项处理/);
  assert.match(chineseHtml, /English/);
  const prompt = fs.readFileSync(files.codexPrompt, 'utf8');
  assert.match(prompt, /RETIRE: recompute the complete-bundle comparison/);
  assert.match(prompt, /UPDATE: independently verify the current path/);
  assert.match(prompt, /DEMOTE: keep triggers, safety boundaries/);
  assert.match(prompt, /TEST: make no cleanup edit first/);
  assert.match(html, /Read-only input analysis/);
});

test('localizes finding content and supporting artifacts without changing verdicts', () => {
  const result = analyze(fixture);
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-sunset-bilingual-'));
  const files = writeReports(result, output, 'en');
  const audit = JSON.parse(fs.readFileSync(files.json, 'utf8'));
  assert.equal(audit.locale, 'en');
  assert.equal(audit.findings.find((item) => item.ruleId === 'broken-reference').title, 'Referenced local file does not exist');
  assert.match(fs.readFileSync(files.markdown, 'utf8'), /## Findings/);
  assert.match(fs.readFileSync(files.evalPlan, 'utf8'), /Behavioral evaluation plan/);
  assert.match(fs.readFileSync(files.htmlChinese, 'utf8'), /引用的本地文件不存在/);
  assert.equal(audit.summary.verdicts.RETIRE, result.summary.verdicts.RETIRE);
});

test('derives single-result Agent handoff wording from the verdict', () => {
  const expected = {
    MERGE: '交给 Agent 合并整理',
    UPDATE: '交给 Agent 更新修复',
    DEMOTE: '交给 Agent 精简下沉',
    RETIRE: '交给 Agent 安全归档',
    TEST: '交给 Agent 验证假设'
  };
  const base = analyze(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-sunset-wording-')));
  for (const [verdict, heading] of Object.entries(expected)) {
    const verdicts = Object.fromEntries(['KEEP', 'MERGE', 'UPDATE', 'DEMOTE', 'RETIRE', 'TEST'].map((key) => [key, key === verdict ? 1 : 0]));
    const finding = {
      file: 'AGENTS.md', line: 1, verdict, severity: 'medium', confidence: 'high',
      ruleId: `wording-${verdict.toLowerCase()}`, title: 'Synthetic wording check',
      evidence: 'Test evidence.', action: 'Test action.', scope: 'generic'
    };
    const result = { ...base, findings: [finding], summary: { ...base.summary, findingCount: 1, verdicts } };
    const output = fs.mkdtempSync(path.join(os.tmpdir(), `skill-sunset-${verdict.toLowerCase()}-`));
    const reports = writeReports(result, output);
    assert.match(fs.readFileSync(reports.html, 'utf8'), new RegExp(heading));
  }
});
