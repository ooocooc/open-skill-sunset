# Skill Sunset

[English](README.md) | [简体中文](README.zh-CN.md)

> AI 已经进化，你的规则呢？

Skill Sunset 对通用 `AGENTS.md`、`CLAUDE.md` 和 `SKILL.md` 做只读分析，发现确定性的配置漂移、重复 bundle、过多常驻上下文，以及可能属于旧模型补偿方案、需要重新验证的规则。

它**不会**自动退役领域知识、安全规则、授权门槛或项目不变量。

审计核心是确定性的、零依赖的 Node.js 程序。它不会调用 AI API，不会消耗安装者的模型额度，也不会读取模型提供商凭据。`--codex` 和 `--claude` 只用于选择本地配置目录。`TEST` 代表“疑似过时、需要验证”，不代表已经证明新模型让该指令失去作用。

## 下载后直接运行，无需安装

要求：Node.js 20 或更高版本。

在下载后的项目目录打开终端，选择一条命令：

```bash
npm run scan:codex
npm run scan:claude
```

这些命令不会全局安装 Skill Sunset。它会扫描对应的本地配置并自动打开可视化报告。

等价的直接命令是：

```bash
node ./bin/skill-sunset.js audit --codex --open
node ./bin/skill-sunset.js audit --claude --open
```

扫描过程只读。报告保存在对应配置目录的 `.skill-sunset` 中，终端也会输出准确路径。

## 语言

CLI 默认使用 `--lang auto`，也可以明确指定：

```bash
node ./bin/skill-sunset.js audit --codex --lang en --open
node ./bin/skill-sunset.js audit --codex --lang zh-CN --open
```

每份报告都会生成可离线打开的英文和简体中文 HTML，并提供页面内语言切换。所选语言也会应用到 `audit.json`、Markdown、Agent Prompt 和评测计划。

## npm 发布以后

无需永久全局安装，直接运行最新版：

```bash
npx skill-sunset@latest audit --codex --open
npx skill-sunset@latest audit --claude --open
```

这是正式发布后的计划入口；npm 包实际发布前不会宣称该命令已经可用。全局安装只作为可选高级用法。

## 报告内容

```text
.skill-sunset/
├── index.html
├── index.en.html
├── index.zh-CN.html
├── audit-report.md
├── audit.json
├── execution-prompt-codex.md
├── execution-prompt-claude.md
├── eval-plan.md
├── experiment-template.json
└── rollback-manifest.json
```

报告内容会把用户主目录下的目标路径脱敏为 `$HOME/...`，其他绝对目标显示为 `$ABSOLUTE/<名称>`。终端仍会输出真实的本地报告位置，便于打开文件。

## 行为实验

填写生成的 `experiment-template.json`，先只验证清单，不执行命令：

```bash
node ./bin/skill-sunset.js test .skill-sunset/experiment-template.json --root /path/to/setup
```

执行命令必须额外添加 `--run`。命令不会经过 shell，并且默认只继承一小组不含凭据的基础环境变量。若确实需要完整环境（其中可能包含模型提供商凭据），还必须显式添加 `--inherit-env`，并且只能对可信命令使用。

预检和结果文件只保留命令哈希、可执行文件名、参数数量、输出大小及输出哈希，不保存命令参数或输出正文。不要在实验清单中填写凭据。

## 结果标签

- `MERGE`：内容重复或同名冲突，需要比较后合并。
- `UPDATE`：路径、引用、工具或模型版本信息已经失效或可能漂移。
- `DEMOTE`：内容仍然有用，但适合从常驻入口下沉到按需引用。
- `RETIRE`：只有完整 Skill bundle 字节一致、通用 Skill 同名且位于同一扫描根时，才建议可恢复归档。
- `TEST`：怀疑规则已经过时，但证据不足；必须先做新旧配置对照评测，不能直接修改。

任何发现都不授权删除。执行 Prompt 会把发现封装为不可信 JSON，并要求检查、可恢复备份、验证，以及对推送、发布和部署分别取得授权。

## 开发与 CI

```bash
npm test
node ./bin/skill-sunset.js audit /path/to/setup --open
node ./bin/skill-sunset.js audit /path/to/setup --format json --fail-on high
```

GitHub Actions 会运行测试矩阵和 Gitleaks 秘密扫描。Gitleaks 是发布防线，但不能保证识别世界上所有可能的凭据格式。

当前是 MVP：已经实现静态检查、文件边界、保守重复退役、双语报告、带显式执行门槛的命令实验框架、CI 严重度退出码和对抗性 Prompt 输出测试。当前提供商能力快照、使用量适配器和任务质量适配器是后续证据层。
