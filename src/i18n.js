export const SUPPORTED_LOCALES = ['en', 'zh-CN'];

export function resolveLocale(requested = 'auto') {
  if (requested === 'en' || requested === 'zh-CN') return requested;
  if (requested !== 'auto') throw new Error('--lang must be auto, en, or zh-CN');
  const detected = Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || '';
  return /^zh(?:-|_|$)/i.test(detected) ? 'zh-CN' : 'en';
}

export const UI = {
  en: {
    languageName: 'English', otherLanguage: '简体中文', otherFile: 'index.zh-CN.html',
    auditEyebrow: 'Agent configuration deprecation audit', heroLead: 'Your AI evolved.', heroAccent: 'Did your rules?',
    heroBody: 'Audits generic Agent instructions only. Domain knowledge, safety boundaries, and project invariants are excluded from automatic retirement by default.',
    healthScore: 'HEALTH SCORE', healthHelp: 'A normalized rule-risk indicator, not a model-quality score. No score is given when there are no auditable files.',
    metrics: ['Scanned files', 'Generic scope', 'Domain excluded', 'Estimated tokens', 'Audit findings'],
    coverage: ['STATUS', 'MANUAL REVIEW', 'SYMLINKS SKIPPED', 'OVERSIZED', 'READ ERRORS'],
    findingsHeading: 'Audit findings', findingsBody: 'Every recommendation includes evidence, confidence, and a recoverable action.',
    handleFindings: 'Handle findings →', empty: 'No findings from the current deterministic rule set.', action: 'Action', all: 'All',
    labels: { KEEP: 'Keep', MERGE: 'Merge', UPDATE: 'Update', DEMOTE: 'Demote', RETIRE: 'Retire', TEST: 'Needs validation' },
    severity: { critical: 'critical', high: 'high', medium: 'medium', low: 'low' }, confidence: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
    copied: 'Copied', promptNote: 'The prompt uses a verdict-specific workflow and wraps findings as untrusted JSON. Push or deployment still requires separate approval.',
    footer: 'Read-only input analysis · Report files were written', noScore: 'not scored',
    scanStatus: { complete: 'complete', partial: 'partial', 'no-auditable-files': 'no auditable files' }
  },
  'zh-CN': {
    languageName: '简体中文', otherLanguage: 'English', otherFile: 'index.en.html',
    auditEyebrow: 'Agent 配置过时检查', heroLead: 'AI 已经进化，', heroAccent: '你的规则呢？',
    heroBody: '只审查通用 Agent 指令。领域知识、安全边界和项目不变量默认不进入自动退役范围。',
    healthScore: '健康指标', healthHelp: '这是归一化规则风险指标，不是模型质量分；无可审计文件时不评分。',
    metrics: ['扫描文件', '通用范围', '领域排除', '估算 Token', '审查发现'],
    coverage: ['状态', '人工复核', '跳过符号链接', '超大文件', '读取错误'],
    findingsHeading: '审查发现', findingsBody: '每条建议都包含证据、置信度和可恢复动作。',
    handleFindings: '去处理建议 →', empty: '当前确定性规则没有发现问题。', action: '建议', all: '全部',
    labels: { KEEP: '保留', MERGE: '合并', UPDATE: '更新', DEMOTE: '下沉', RETIRE: '退役', TEST: '待验证' },
    severity: { critical: '严重', high: '高', medium: '中', low: '低' }, confidence: { high: '高置信度', medium: '中置信度', low: '低置信度' },
    copied: '已复制', promptNote: 'Prompt 按结果类型选择执行流程，并把发现项封装为不可信 JSON；任何推送或部署仍需单独授权。',
    footer: '只读输入分析 · 报告已写入本地', noScore: '未评分',
    scanStatus: { complete: '完整', partial: '部分完成', 'no-auditable-files': '没有可审计文件' }
  }
};

const MESSAGES = {
  en: {
    'legacy-reasoning-scaffold': ['Possible legacy reasoning scaffold', 'Found a rule requiring explicit chain-of-thought or a fixed step-by-step reasoning format.', 'Run representative A/B tasks with and without the rule; do not remove it from wording alone.'],
    'role-play-scaffold': ['Possible low-information role prompt', 'Found a generic role or seniority claim without observable acceptance criteria.', 'Replace role adjectives with observable acceptance criteria, or remove them only after regression evaluation.'],
    'unconditional-tooling': ['Unconditional tool use may impose a context tax', 'The rule binds tool use to every or all tasks.', 'Use triggers based on version sensitivity, risk, or task type, then compare tool calls and task success.'],
    'mandatory-subagent': ['Mandatory subagent routing may be excessive', 'Found a broad or unconditional requirement to use subagents.', 'Enable subagents only for independently useful work packages; compare latency, tokens, and acceptance results.'],
    'context7-assumption': ['Recheck the Context7 dependency', 'The instruction references Context7; verify its availability and scope in the current runtime.', 'Inspect the current tool list. If unavailable, remove the mandate and consult first-party documentation only when version sensitivity requires it.'],
    'model-version-coupling': ['Instruction is coupled to a model version', 'Found a concrete model name that may drift as providers update.', 'Verify against current first-party documentation and prefer capability conditions over old model identifiers.'],
    'file-too-large': [d => 'Instruction file exceeds the safe scan limit', d => `${d.bytes} bytes exceeds the ${d.limit}-byte limit; the body was not loaded.`, 'Split the file or explicitly raise a controlled limit; do not count an unscanned file as healthy.'],
    'invalid-frontmatter': ['Skill frontmatter is missing or malformed', d => `Frontmatter status: ${d.status}.`, 'Add parseable YAML frontmatter with non-empty name and description fields.'],
    'progressive-disclosure': [d => `${d.kind === 'skill' ? 'Skill entry file' : 'Agent instruction file'} may need progressive disclosure`, d => `${d.lines} lines and about ${d.estimatedTokens} tokens; these counts are review signals only.`, 'Keep triggers, critical boundaries, and acceptance criteria in the entry file; move examples, long templates, and platform detail to on-demand references.'],
    'malformed-link-encoding': ['Invalid link encoding', 'A local Markdown link contains undecodable percent encoding.', 'Repair the link encoding; scanning continued for other files.'],
    'broken-reference': ['Referenced local file does not exist', 'A local Markdown reference cannot be resolved. The original target is not repeated to avoid leaking path parameters.', 'Update or remove the stale reference; do not let an Agent execute the affected workflow until repaired.'],
    'stale-absolute-path': ['Absolute path is no longer valid', 'The instruction contains an absolute path that does not exist on the current filesystem.', 'Use a project-relative path, Skill-root path, or another currently verifiable location.'],
    'possible-secret': ['Possible plaintext credential', 'Detected a credential-like structure. The report does not repeat the value and did not test whether it is valid.', 'Review manually. If real, rotate it first and remove it from Markdown; if it is an example, replace it with an obvious placeholder.'],
    'exact-bundle-duplicate-same-name': ['Complete, same-name generic Skill duplicate', d => `The entry and complete bundle manifest/hash match inside one scan root; canonical candidate: ${d.canonicalPath}.`, 'Confirm both discovery paths are in the actual loading scope, then move only the duplicate to a recoverable archive and retain the bundle hash and rollback manifest.'],
    'same-entry-different-bundle': ['Skill entry matches but complete bundles differ', 'SKILL.md matches, but scripts, references, assets, or other bundle files are not all identical.', 'Compare the bundle file by file. Do not retire either complete Skill as a duplicate.'],
    'duplicate-skill-name': ['Skill name is duplicated but content differs', d => `${d.count} Skills share the same name but contain different content.`, 'Inspect actual discovery and loading order, merge intentional overlap, or rename genuinely distinct capabilities.']
  },
  'zh-CN': {
    'legacy-reasoning-scaffold': ['可能是旧模型补偿型推理脚手架', '发现要求显式思维链或固定逐步推理的规则。', '用代表性任务做有/无该规则的 A/B 测试；不要仅凭措辞自动删除。'],
    'role-play-scaffold': ['可能是低信息量角色提示', '发现泛化角色或资历设定，但没有可验收的行为标准。', '将角色形容词改成可观察的验收标准，或在回归测试后移除。'],
    'unconditional-tooling': ['无条件工具调用可能产生上下文税', '规则把工具调用绑定到所有或每个任务。', '改成基于版本敏感性、风险或任务类型的触发条件，并比较工具调用数和任务成功率。'],
    'mandatory-subagent': ['强制子代理规则可能已经过度', '发现无条件或宽泛的子代理要求。', '只在存在可独立并行工作包时启用；比较延迟、token 与验收结果。'],
    'context7-assumption': ['Context7 依赖需要重新核对', '指令引用 Context7；工具可用性和适用范围需要按当前运行时核验。', '检查当前工具清单；若不可用则删除强制规则，改为版本敏感时查官方一手文档。'],
    'model-version-coupling': ['规则与具体模型版本耦合', '发现具体模型名称；该信息可能随提供商升级而漂移。', '对照当前官方文档核验，并优先用能力条件而不是旧型号名称表达。'],
    'file-too-large': ['指令文件超过安全扫描上限', d => `${d.bytes} bytes，超过 ${d.limit} bytes；正文未加载。`, '拆分文件或显式提高受控扫描上限；不要把未扫描文件计为健康。'],
    'invalid-frontmatter': ['Skill frontmatter 缺失或损坏', d => `frontmatter 状态：${d.status}。`, '补齐可解析的 YAML frontmatter，以及非空 name 和 description。'],
    'progressive-disclosure': [d => `${d.kind === 'skill' ? 'Skill 主文件' : 'Agent 指令文件'}可能需要下沉`, d => `${d.lines} 行，估算 ${d.estimatedTokens} token；行数和 token 仅为审查信号。`, '只保留触发条件、关键约束和验收；把案例、长模板和平台细节移到按需 references。'],
    'malformed-link-encoding': ['链接编码无效', 'Markdown 本地链接包含无法解码的百分号编码。', '修复链接编码；扫描已继续处理其他文件。'],
    'broken-reference': ['引用的本地文件不存在', 'Markdown 本地引用无法解析；为避免泄露路径参数，报告不复述原始目标。', '更新或移除失效引用；在修复前不要让 Agent 执行相关流程。'],
    'stale-absolute-path': ['绝对路径已经失效', '指令包含当前文件系统中不存在的绝对路径。', '改为项目相对路径、Skill 根路径或当前可验证路径。'],
    'possible-secret': ['可能包含明文凭据', '检测到疑似凭据结构；报告不会复述原值，也未验证它是否有效。', '人工确认；若是真实凭据，先轮换再移出 Markdown。若是示例，改用明显占位符。'],
    'exact-bundle-duplicate-same-name': ['完整内容相同且同名的通用 Skill 副本', d => `同一扫描根内入口、完整 bundle 清单与哈希均相同；正式候选为 ${d.canonicalPath}。`, '确认两个发现路径都在实际加载范围后，将此副本移入可恢复归档；保留 bundle 哈希和回滚清单。'],
    'same-entry-different-bundle': ['Skill 入口相同但完整 bundle 不同', 'SKILL.md 相同，但 scripts、references、assets 或其他 bundle 文件并非全部相同。', '逐文件比较 bundle 差异；不得把其中任一完整 Skill 当作重复副本直接退役。'],
    'duplicate-skill-name': ['Skill 名称重复但内容不同', d => `同名但内容不同的 Skill 共 ${d.count} 份。`, '检查实际发现与加载顺序，合并差异或为真正不同的能力重新命名。']
  }
};

function render(value, data) {
  return typeof value === 'function' ? value(data ?? {}) : value;
}

export function localizeFinding(item, locale) {
  const message = MESSAGES[locale]?.[item.ruleId];
  if (!message) return { ...item };
  return { ...item, title: render(message[0], item.data), evidence: render(message[1], item.data), action: render(message[2], item.data) };
}

export function localizeResult(result, locale) {
  const limitations = locale === 'zh-CN' ? [
    '静态发现不能证明移除指令会提高任务质量。',
    '模型与运行时是否已让规则过时，需要当前一手能力证据。',
    '领域 Skill、安全规则、授权门槛和项目不变量不进入自动退役。',
    'RETIRE 需要完整 Skill bundle 一致、通用 Skill 同名，且两个发现路径位于同一扫描根。',
    '任何发现都不授权删除；改动必须可恢复、经复核并通过测试。'
  ] : result.limitations;
  return { ...result, locale, findings: result.findings.map((item) => localizeFinding(item, locale)), limitations };
}
