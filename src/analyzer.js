import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_DIRECTORIES = new Set([
  '.git', '.skill-sunset', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.cache', 'vendor', 'target', '__pycache__',
  'test', 'tests', 'fixtures', 'examples'
]);

const DOMAIN_MARKERS = [
  'medical', 'medicine', 'health', 'legal', 'finance', 'astrology', 'parenting',
  'seo', 'marketing', 'fengshui', 'ziwei', 'xiaohongshu', '中医', '医疗',
  '育儿', '紫微', '风水', '命理', '母婴', '法律', '金融'
];

const GENERIC_MARKERS = [
  'agent', 'browser', 'code', 'coding', 'debug', 'deploy', 'document', 'file',
  'git', 'image', 'markdown', 'mcp', 'memory', 'note', 'pdf', 'plan', 'plugin',
  'postgres', 'presentation', 'react', 'skill', 'spreadsheet', 'test', 'ui',
  'vercel', 'video', 'web', 'workflow', '写代码', '调试', '浏览器', '文档'
];

const SEMANTIC_RULES = [
  {
    id: 'legacy-reasoning-scaffold',
    pattern: /chain[ -]of[ -]thought|show your reasoning|step-by-step reasoning|思维链|逐步思考|展示.*推理/i,
    verdict: 'TEST', severity: 'medium', confidence: 'medium',
    title: '可能是旧模型补偿型推理脚手架',
    evidence: '发现要求显式思维链或固定逐步推理的规则。',
    action: '用代表性任务做有/无该规则的 A/B 测试；不要仅凭措辞自动删除。'
  },
  {
    id: 'role-play-scaffold',
    pattern: /act as (?:a|an)|you are a \d+[- ]year|\d+\s*年.*(?:工程师|专家)/i,
    verdict: 'TEST', severity: 'low', confidence: 'medium',
    title: '可能是低信息量角色提示',
    evidence: '发现泛化角色或资历设定，但没有可验收的行为标准。',
    action: '将角色形容词改成可观察的验收标准，或在回归测试后移除。'
  },
  {
    id: 'unconditional-tooling',
    pattern: /(?:always|for every task).{0,50}\b(?:use|run|search|call)\b|(?:每个|所有|任何).{0,18}(?:任务|请求).{0,18}(?:必须|都要|先).{0,30}(?:调用|使用|搜索|运行)/i,
    verdict: 'TEST', severity: 'medium', confidence: 'medium',
    title: '无条件工具调用可能产生上下文税',
    evidence: '规则把工具调用绑定到所有或每个任务。',
    action: '改成基于版本敏感性、风险或任务类型的触发条件，并比较工具调用数和任务成功率。'
  },
  {
    id: 'mandatory-subagent',
    pattern: /(?:always|must).{0,35}sub-?agents?|(?:必须|一律|专业).{0,25}子代理/i,
    verdict: 'TEST', severity: 'medium', confidence: 'medium',
    title: '强制子代理规则可能已经过度',
    evidence: '发现无条件或宽泛的子代理要求。',
    action: '只在存在可独立并行工作包时启用；比较延迟、token 与验收结果。'
  },
  {
    id: 'context7-assumption',
    pattern: /context7/i,
    verdict: 'UPDATE', severity: 'medium', confidence: 'medium',
    title: 'Context7 依赖需要重新核对',
    evidence: '指令引用 Context7；工具可用性和适用范围需要按当前运行时核验。',
    action: '检查当前工具清单；若不可用则删除强制规则，改为版本敏感时查官方一手文档。'
  },
  {
    id: 'model-version-coupling',
    pattern: /\b(?:gpt-[345](?:\.\d+)?(?:-[a-z0-9-]+)?|claude-(?:2|3|3\.5|sonnet|opus)-?[a-z0-9.-]*)\b/i,
    verdict: 'UPDATE', severity: 'low', confidence: 'medium',
    title: '规则与具体模型版本耦合',
    evidence: '发现具体模型名称；该信息可能随提供商升级而漂移。',
    action: '对照当前官方文档核验，并优先用能力条件而不是旧型号名称表达。'
  }
];

function isInstructionFile(name) {
  return name === 'AGENTS.md' || name === 'CLAUDE.md' || name === 'SKILL.md';
}

function walk(directory, inventory) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    inventory.readErrors.push({ path: directory, error: error.code ?? 'READ_ERROR' });
    return;
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      inventory.skippedSymlinks += 1;
      continue;
    }
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) inventory.skippedDirectories += 1;
      else walk(absolute, inventory);
    } else if (isInstructionFile(entry.name)) {
      inventory.paths.push(absolute);
    }
  }
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { metadata: {}, status: 'missing' };
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:[ \t]*\r?\n|$)/);
  if (!match) return { metadata: {}, status: 'malformed' };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.*?)\s*$/);
    if (!field) continue;
    metadata[field[1]] = field[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  if (!metadata.name || !metadata.description) return { metadata, status: 'incomplete' };
  return { metadata, status: 'valid' };
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function maskMarkdownCode(content) {
  const chars = [...content];
  const maskRange = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
    }
  };
  for (const match of content.matchAll(/(^|\n)[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(?:\n[ \t]*\2(?:\n|$)|$)/g)) {
    maskRange(match.index, match.index + match[0].length);
  }
  const fencedMasked = chars.join('');
  for (const match of fencedMasked.matchAll(/`[^`\n]*`/g)) maskRange(match.index, match.index + match[0].length);
  return chars.join('');
}

function skillScope(metadata, relativePath, frontmatterStatus) {
  if (!relativePath.endsWith('SKILL.md')) return 'generic';
  if (frontmatterStatus !== 'valid') return 'manual-review';
  const haystack = `${metadata.name ?? ''} ${metadata.description ?? ''}`.toLowerCase();
  if (DOMAIN_MARKERS.some((marker) => haystack.includes(marker))) return 'domain-excluded';
  if (GENERIC_MARKERS.some((marker) => haystack.includes(marker))) return 'generic';
  return 'manual-review';
}

function finding(file, details) {
  return {
    file: file.relativePath,
    line: details.line ?? 1,
    verdict: details.verdict,
    severity: details.severity,
    confidence: details.confidence,
    ruleId: details.ruleId,
    title: details.title,
    evidence: details.evidence,
    action: details.action,
    data: details.data ?? {},
    scope: file.scope
  };
}

function structureFindings(file) {
  const findings = [];
  if (file.oversized) {
    findings.push(finding(file, {
      verdict: 'UPDATE', severity: 'high', confidence: 'high', ruleId: 'file-too-large',
      title: '指令文件超过安全扫描上限',
      evidence: `${file.bytes} bytes，超过 ${MAX_FILE_BYTES} bytes；正文未加载。`,
      data: { bytes: file.bytes, limit: MAX_FILE_BYTES },
      action: '拆分文件或显式提高受控扫描上限；不要把未扫描文件计为健康。'
    }));
  }
  if (file.kind === 'skill' && file.frontmatterStatus !== 'valid') {
    findings.push(finding(file, {
      verdict: 'UPDATE', severity: 'high', confidence: 'high', ruleId: 'invalid-frontmatter',
      title: 'Skill frontmatter 缺失或损坏',
      evidence: `frontmatter 状态：${file.frontmatterStatus}。`,
      data: { status: file.frontmatterStatus },
      action: '补齐可解析的 YAML frontmatter，以及非空 name 和 description。'
    }));
  }
  return findings;
}

function staticFindings(file, root) {
  const findings = structureFindings(file);
  if (file.scope !== 'generic' || file.oversized || file.readError) return findings;
  const { content } = file;
  const inspectable = maskMarkdownCode(content);

  const lineLimit = file.kind === 'skill' ? 400 : 220;
  const tokenLimit = file.kind === 'skill' ? 8000 : 6000;
  if (file.lines > lineLimit || file.estimatedTokens > tokenLimit) {
    findings.push(finding(file, {
      verdict: 'DEMOTE', severity: 'medium', confidence: 'high', ruleId: 'progressive-disclosure',
      title: `${file.kind === 'skill' ? 'Skill 主文件' : 'Agent 指令文件'}可能需要下沉`,
      evidence: `${file.lines} 行，估算 ${file.estimatedTokens} token；行数和 token 仅为审查信号。`,
      data: { lines: file.lines, estimatedTokens: file.estimatedTokens, kind: file.kind },
      action: '只保留触发条件、关键约束和验收；把案例、长模板和平台细节移到按需 references。'
    }));
  }

  for (const rule of SEMANTIC_RULES) {
    const match = inspectable.match(rule.pattern);
    if (!match) continue;
    findings.push(finding(file, { ...rule, ruleId: rule.id, line: lineOf(content, match.index) }));
  }

  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of inspectable.matchAll(linkPattern)) {
    const rawTarget = match[1].trim();
    if (!rawTarget || rawTarget.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(rawTarget.split('#')[0]);
    } catch {
      findings.push(finding(file, {
        verdict: 'UPDATE', severity: 'medium', confidence: 'high', ruleId: 'malformed-link-encoding',
        line: lineOf(content, match.index), title: '链接编码无效',
        evidence: 'Markdown 本地链接包含无法解码的百分号编码。',
        action: '修复链接编码；扫描已继续处理其他文件。'
      }));
      continue;
    }
    const resolved = path.resolve(path.dirname(file.absolutePath), decoded);
    const relativeToRoot = path.relative(root, resolved);
    const insideRoot = relativeToRoot === '' || (!relativeToRoot.startsWith(`..${path.sep}`) && relativeToRoot !== '..' && !path.isAbsolute(relativeToRoot));
    if (!insideRoot) continue;
    if (!fs.existsSync(resolved)) {
      findings.push(finding(file, {
        verdict: 'UPDATE', severity: 'high', confidence: 'high', ruleId: 'broken-reference',
        line: lineOf(content, match.index), title: '引用的本地文件不存在',
        evidence: 'Markdown 本地引用无法解析；为避免泄露路径参数，报告不复述原始目标。',
        action: '更新或移除失效引用；在修复前不要让 Agent 执行相关流程。'
      }));
    }
  }

  const absolutePathPattern = /`((?:\/Users\/|\/home\/|[A-Za-z]:\\)[^`\n]+)`/g;
  for (const match of content.matchAll(absolutePathPattern)) {
    const target = match[1];
    if (!fs.existsSync(target)) {
      findings.push(finding(file, {
        verdict: 'UPDATE', severity: 'high', confidence: 'high', ruleId: 'stale-absolute-path',
        line: lineOf(content, match.index), title: '绝对路径已经失效',
        evidence: '指令包含当前文件系统中不存在的绝对路径。',
        action: '改为项目相对路径、Skill 根路径或当前可验证路径。'
      }));
    }
  }

  const secretPatterns = [
    /(?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i,
    /https?:\/\/[^\s/:]+:[^\s/@]+@/i
  ];
  for (const pattern of secretPatterns) {
    const match = inspectable.match(pattern);
    if (!match) continue;
    findings.push(finding(file, {
      verdict: 'UPDATE', severity: 'critical', confidence: 'medium', ruleId: 'possible-secret',
      line: lineOf(content, match.index), title: '可能包含明文凭据',
      evidence: '检测到疑似凭据结构；报告不会复述原值，也未验证它是否有效。',
      action: '人工确认；若是真实凭据，先轮换再移出 Markdown。若是示例，改用明显占位符。'
    }));
    break;
  }
  return findings;
}

function addDuplicateFindings(files, findings) {
  const skills = files.filter((item) => item.kind === 'skill' && item.scope === 'generic' && !item.oversized && !item.readError);
  const byEntryHash = new Map();
  const byName = new Map();
  for (const file of skills) {
    const hashList = byEntryHash.get(file.hash) ?? [];
    hashList.push(file);
    byEntryHash.set(file.hash, hashList);
    if (file.metadata.name) {
      const nameList = byName.get(file.metadata.name) ?? [];
      nameList.push(file);
      byName.set(file.metadata.name, nameList);
    }
  }
  for (const group of byEntryHash.values()) {
    if (group.length < 2) continue;
    const canonical = group[0];
    const sameName = group.every((item) => item.metadata.name === canonical.metadata.name);
    const completeBundleMatch = group.every((item) => item.bundleHash && item.bundleHash === canonical.bundleHash);
    if (sameName && completeBundleMatch) {
      for (const file of group.slice(1)) {
        findings.push(finding(file, {
          verdict: 'RETIRE', severity: 'high', confidence: 'high', ruleId: 'exact-bundle-duplicate-same-name',
          title: '完整内容相同且同名的通用 Skill 副本',
          evidence: `同一扫描根内入口、完整 bundle 清单与哈希均相同；正式候选为 ${canonical.relativePath}。`,
          data: { canonicalPath: canonical.relativePath },
          action: '确认两个发现路径都在实际加载范围后，将此副本移入可恢复归档；保留 bundle 哈希和回滚清单。'
        }));
      }
    } else {
      for (const file of group) {
        findings.push(finding(file, {
          verdict: 'MERGE', severity: 'medium', confidence: 'high', ruleId: 'same-entry-different-bundle',
          title: 'Skill 入口相同但完整 bundle 不同',
          evidence: 'SKILL.md 相同，但 scripts、references、assets 或其他 bundle 文件并非全部相同。',
          action: '逐文件比较 bundle 差异；不得把其中任一完整 Skill 当作重复副本直接退役。'
        }));
      }
    }
  }
  for (const [name, group] of byName.entries()) {
    if (group.length < 2 || new Set(group.map((item) => item.hash)).size === 1) continue;
    for (const file of group) {
      findings.push(finding(file, {
        verdict: 'MERGE', severity: 'medium', confidence: 'high', ruleId: 'duplicate-skill-name',
        title: 'Skill 名称重复但内容不同',
        evidence: `同名但内容不同的 Skill 共 ${group.length} 份。`,
        data: { count: group.length },
        action: '检查实际发现与加载顺序，合并差异或为真正不同的能力重新命名。'
      }));
    }
  }
}

function fingerprintSkillBundle(skillFile) {
  const root = path.dirname(skillFile);
  const entries = [];
  let totalBytes = 0;
  let complete = true;
  const visit = (directory) => {
    let children;
    try {
      children = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      complete = false;
      return;
    }
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (child.name === '.git' || child.name === '.skill-sunset') continue;
      const absolute = path.join(directory, child.name);
      if (child.isSymbolicLink()) {
        complete = false;
        continue;
      }
      if (child.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!child.isFile()) continue;
      try {
        const stat = fs.statSync(absolute);
        totalBytes += stat.size;
        if (totalBytes > 20 * 1024 * 1024) {
          complete = false;
          return;
        }
        const buffer = fs.readFileSync(absolute);
        entries.push(`${path.relative(root, absolute).split(path.sep).join('/')}\0${crypto.createHash('sha256').update(buffer).digest('hex')}`);
      } catch {
        complete = false;
      }
    }
  };
  visit(root);
  if (!complete) return { bundleHash: null, bundleFiles: entries.length, bundleBytes: totalBytes };
  return {
    bundleHash: crypto.createHash('sha256').update(entries.join('\n')).digest('hex'),
    bundleFiles: entries.length,
    bundleBytes: totalBytes
  };
}

function score(findings, genericFiles) {
  if (genericFiles === 0) return null;
  const weights = { critical: 35, high: 22, medium: 10, low: 4 };
  const perFile = new Map();
  for (const item of findings) {
    const current = perFile.get(item.file) ?? 0;
    perFile.set(item.file, Math.min(45, current + (weights[item.severity] ?? 0)));
  }
  const averagePenalty = [...perFile.values()].reduce((sum, value) => sum + value, 0) / genericFiles;
  let health = Math.max(0, Math.round(100 - averagePenalty));
  if (findings.some((item) => item.severity === 'critical')) health = Math.min(health, 55);
  else if (findings.some((item) => item.severity === 'high')) health = Math.min(health, 75);
  else if (findings.some((item) => item.severity === 'medium')) health = Math.min(health, 88);
  else if (findings.some((item) => item.severity === 'low')) health = Math.min(health, 95);
  return health;
}

function loadFile(root, absolutePath) {
  const relativePath = path.relative(root, absolutePath) || path.basename(absolutePath);
  const kind = path.basename(absolutePath) === 'SKILL.md' ? 'skill' : 'agent-instructions';
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch (error) {
    return { absolutePath, relativePath, kind, bytes: 0, lines: 0, estimatedTokens: 0, content: '', metadata: {}, frontmatterStatus: 'unreadable', scope: kind === 'skill' ? 'manual-review' : 'generic', readError: error.code ?? 'READ_ERROR' };
  }
  if (stat.size > MAX_FILE_BYTES) {
    return { absolutePath, relativePath, kind, bytes: stat.size, lines: 0, estimatedTokens: Math.ceil(stat.size / 4), content: '', metadata: {}, frontmatterStatus: 'not-read', scope: kind === 'skill' ? 'manual-review' : 'generic', oversized: true };
  }
  let content;
  try {
    content = fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    return { absolutePath, relativePath, kind, bytes: stat.size, lines: 0, estimatedTokens: Math.ceil(stat.size / 4), content: '', metadata: {}, frontmatterStatus: 'unreadable', scope: kind === 'skill' ? 'manual-review' : 'generic', readError: error.code ?? 'READ_ERROR' };
  }
  const parsed = kind === 'skill' ? parseFrontmatter(content) : { metadata: {}, status: 'not-applicable' };
  const scope = skillScope(parsed.metadata, relativePath, parsed.status);
  const bundle = kind === 'skill' && scope === 'generic' ? fingerprintSkillBundle(absolutePath) : {};
  return {
    absolutePath, relativePath, kind, content, metadata: parsed.metadata, frontmatterStatus: parsed.status,
    lines: content.split(/\r?\n/).length, bytes: Buffer.byteLength(content),
    estimatedTokens: Math.ceil(content.length / 4),
    hash: crypto.createHash('sha256').update(content).digest('hex'),
    scope,
    ...bundle
  };
}

export function analyze(target) {
  const root = path.resolve(target);
  if (!fs.existsSync(root)) throw new Error(`target does not exist: ${root}`);
  if (!fs.statSync(root).isDirectory()) throw new Error(`target must be a directory: ${root}`);
  const inventory = { paths: [], skippedSymlinks: 0, skippedDirectories: 0, readErrors: [] };
  walk(root, inventory);
  const files = inventory.paths.map((absolutePath) => loadFile(root, absolutePath));
  const findings = files.flatMap((file) => staticFindings(file, root));
  addDuplicateFindings(files, findings);
  findings.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return (rank[a.severity] - rank[b.severity]) || a.file.localeCompare(b.file) || a.line - b.line;
  });
  const genericFiles = files.filter((file) => file.scope === 'generic').length;
  const verdicts = Object.fromEntries(['KEEP', 'MERGE', 'UPDATE', 'DEMOTE', 'RETIRE', 'TEST'].map((key) => [key, 0]));
  for (const item of findings) verdicts[item.verdict] = (verdicts[item.verdict] ?? 0) + 1;
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    target: root,
    summary: {
      healthScore: score(findings, genericFiles),
      scanStatus: files.length === 0
        ? 'no-auditable-files'
        : (inventory.readErrors.length || inventory.skippedSymlinks || files.some((file) => file.oversized || file.readError)) ? 'partial' : 'complete',
      scannedFiles: files.length,
      genericFiles,
      domainExcluded: files.filter((file) => file.scope === 'domain-excluded').length,
      manualReview: files.filter((file) => file.scope === 'manual-review').length,
      oversizedFiles: files.filter((file) => file.oversized).length,
      skippedSymlinks: inventory.skippedSymlinks,
      skippedDirectories: inventory.skippedDirectories,
      readErrors: inventory.readErrors.length + files.filter((file) => file.readError).length,
      estimatedTokens: files.reduce((sum, file) => sum + file.estimatedTokens, 0),
      findingCount: findings.length,
      verdicts
    },
    files: files.map(({ content, absolutePath, metadata, ...file }) => file),
    findings,
    limitations: [
      'Static findings do not prove that removing an instruction improves task quality.',
      'Model and runtime obsolescence requires current first-party capability evidence.',
      'Domain Skills, safety rules, authorization gates, and project invariants are excluded from automatic retirement.',
      'RETIRE requires a complete identical Skill bundle, the same generic Skill name, and both discovery paths inside the same scan root.',
      'No finding authorizes deletion; changes should be archived, reviewed, tested, and reversible.'
    ]
  };
}
