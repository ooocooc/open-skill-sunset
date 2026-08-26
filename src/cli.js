import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { analyze } from './analyzer.js';
import { loadExperimentPlan, renderExperimentDryRun, runExperiment, writeExperimentResult } from './experiment.js';
import { writeReports } from './report.js';
import { resolveLocale } from './i18n.js';

function usage() {
  return `Skill Sunset\n\nQuick start:\n  skill-sunset audit --codex --open\n  skill-sunset audit --claude --open\n\nUsage:\n  skill-sunset audit [target | --codex | --claude] [--lang auto|en|zh-CN] [--out directory] [--format text|json] [--fail-on critical|high|medium|low] [--open]\n  skill-sunset test <experiment.json> [--root directory] [--out directory] [--format text|json] [--run] [--inherit-env]\n\n--codex scans ~/.codex; --claude scans ~/.claude.\n--lang defaults to auto and controls the report, Markdown, and Agent prompts.\nInput analysis is read-only. Reports are written to --out or <target>/.skill-sunset.\nThe test command validates only unless --run is explicit; full environment inheritance additionally requires --inherit-env.\nGenerated reports never authorize deletion.`;
}

function openFile(file) {
  const platformCommand = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  const child = spawn(platformCommand, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

function testCommand(args) {
  let planFile;
  let root;
  let output;
  let format = 'text';
  let shouldRun = false;
  let inheritEnvironment = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--root' || value === '--out' || value === '--format') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) throw new Error(`${value} requires a value`);
      if (value === '--root') root = next;
      if (value === '--out') output = next;
      if (value === '--format') format = next;
      index += 1;
    } else if (value === '--run') shouldRun = true;
    else if (value === '--inherit-env') inheritEnvironment = true;
    else if (!value.startsWith('-') && !planFile) planFile = value;
    else throw new Error(`unknown test option: ${value}`);
  }
  if (!planFile) throw new Error('test requires exactly one experiment JSON file');
  if (!['text', 'json'].includes(format)) throw new Error('--format must be text or json');
  if (inheritEnvironment && !shouldRun) throw new Error('--inherit-env requires --run');
  const absolutePlan = path.resolve(planFile);
  const plan = loadExperimentPlan(absolutePlan, root ? path.resolve(root) : undefined);
  if (!shouldRun) {
    if (format === 'json') console.log(JSON.stringify({ status: 'validated-not-run', candidateId: plan.candidateId }, null, 2));
    else process.stdout.write(renderExperimentDryRun(plan));
    return;
  }
  const result = runExperiment(plan, { inheritEnvironment });
  const resultFile = writeExperimentResult(result, output ? path.resolve(output) : path.dirname(absolutePlan));
  if (format === 'json') console.log(JSON.stringify({ result, resultFile }, null, 2));
  else process.stdout.write(`Skill Sunset experiment: ${result.verdict}\nResult: ${resultFile}\n${result.reasons.map((reason) => `- ${reason}`).join('\n')}\n`);
  if (result.verdict === 'REGRESSION') process.exitCode = 3;
  if (result.verdict === 'INCONCLUSIVE') process.exitCode = 4;
}

export async function runCli(args) {
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  const command = args[0];
  if (command === 'test') return testCommand(args.slice(1));
  if (command !== 'audit') throw new Error(`unknown command: ${command}\n\n${usage()}`);
  let target = '.';
  let output;
  let shouldOpen = false;
  let format = 'text';
  let failOn;
  let requestedLocale = 'auto';
  let targetSource;
  for (let index = 1; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--out') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) throw new Error('--out requires a directory');
      output = next;
      index += 1;
    }
    else if (value === '--format') {
      const next = args[index + 1];
      if (!['text', 'json'].includes(next)) throw new Error('--format must be text or json');
      format = next;
      index += 1;
    }
    else if (value === '--fail-on') {
      const next = args[index + 1];
      if (!['critical', 'high', 'medium', 'low'].includes(next)) throw new Error('--fail-on must be critical, high, medium, or low');
      failOn = next;
      index += 1;
    }
    else if (value === '--lang') {
      const next = args[index + 1];
      if (!['auto', 'en', 'zh-CN'].includes(next)) throw new Error('--lang must be auto, en, or zh-CN');
      requestedLocale = next;
      index += 1;
    }
    else if (value === '--codex' || value === '--claude') {
      if (targetSource) throw new Error('choose exactly one target: a path, --codex, or --claude');
      target = path.join(os.homedir(), value === '--codex' ? '.codex' : '.claude');
      targetSource = value;
    }
    else if (value === '--open') shouldOpen = true;
    else if (!value.startsWith('-')) {
      if (targetSource) throw new Error('choose exactly one target: a path, --codex, or --claude');
      target = value;
      targetSource = 'path';
    }
    else throw new Error(`unknown option: ${value}`);
  }
  const resolvedTarget = path.resolve(target);
  const result = analyze(resolvedTarget);
  const outputDirectory = output ? path.resolve(output) : path.join(resolvedTarget, '.skill-sunset');
  const locale = resolveLocale(requestedLocale);
  const files = writeReports(result, outputDirectory, locale);
  if (format === 'json') {
    console.log(JSON.stringify({ locale, summary: result.summary, reports: files }));
  } else {
    const zh = locale === 'zh-CN';
    const displayStatus = zh ? ({ complete: '完整', partial: '部分完成', 'no-auditable-files': '没有可审计文件' }[result.summary.scanStatus] ?? result.summary.scanStatus) : result.summary.scanStatus;
    console.log('');
    console.log(`  Skill Sunset  ${result.summary.healthScore === null ? (zh ? '未评分' : 'not scored') : `${result.summary.healthScore}/100`}`);
    console.log(`  ${zh ? '状态          ' : 'Status        '}${displayStatus}`);
    console.log(zh
      ? `  扫描          ${result.summary.scannedFiles} 个文件（${result.summary.genericFiles} 个通用，${result.summary.domainExcluded} 个领域排除，${result.summary.manualReview} 个人工复核）`
      : `  Scanned       ${result.summary.scannedFiles} files (${result.summary.genericFiles} generic, ${result.summary.domainExcluded} domain-excluded, ${result.summary.manualReview} manual)`);
    console.log(zh
      ? `  跳过          ${result.summary.skippedSymlinks} 个符号链接，${result.summary.oversizedFiles} 个超大文件，${result.summary.readErrors} 个读取错误`
      : `  Skipped       ${result.summary.skippedSymlinks} symlinks, ${result.summary.oversizedFiles} oversized, ${result.summary.readErrors} read errors`);
    console.log(`  ${zh ? '发现          ' : 'Findings      '}${result.summary.findingCount}`);
    console.log(`  ${zh ? '报告          ' : 'Report        '}${files.html}`);
    console.log('');
  }
  if (shouldOpen) openFile(files.html);
  if (failOn) {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    if (result.findings.some((item) => rank[item.severity] <= rank[failOn])) process.exitCode = 2;
  }
}
