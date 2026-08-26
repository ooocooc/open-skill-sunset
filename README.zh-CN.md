# Skill Sunset

[![CI](https://github.com/ooocooc/open-skill-sunset/actions/workflows/ci.yml/badge.svg)](https://github.com/ooocooc/open-skill-sunset/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/skill-sunset.svg)](https://www.npmjs.com/package/skill-sunset)
[![npm downloads](https://img.shields.io/npm/dm/skill-sunset.svg)](https://www.npmjs.com/package/skill-sunset)
[![license](https://img.shields.io/github/license/ooocooc/open-skill-sunset.svg)](LICENSE)

[English](README.md) | [简体中文](README.zh-CN.md)

> AI 已经进化，你的规则呢？

审计长期积累的 `AGENTS.md`、`CLAUDE.md` 和通用 `SKILL.md`，避免旧时代补偿规则继续占用上下文。

```bash
npx skill-sunset@latest audit --codex --open
```

无需全局安装。审计在本地只读运行；核心不会调用 AI API、消耗模型额度或读取模型提供商凭据。

![由仓库测试样本真实生成的 Skill Sunset 报告](https://raw.githubusercontent.com/ooocooc/open-skill-sunset/main/docs/assets/skill-sunset-report.png)

截图由当前 CLI 扫描 `test/fixtures/sample-setup` 真实生成：扫描 5 个文件、得到 11 条发现，并把重复退役、失效引用更新、渐进披露和行为假设分开显示。

## 能做什么

Skill Sunset 把确定性检查与保守的待验证假设分开：

- 发现失效本地引用、陈旧绝对路径、损坏的 Skill frontmatter、过大的常驻文件和疑似明文凭据；
- 检查同名 Skill，并在建议可恢复退役前核对完整 bundle；
- 将模型时代的补偿规则标记为 `TEST`，而不是直接宣称已经过时；
- 生成双语 HTML、Markdown、JSON、Codex/Claude 交接 Prompt、实验模板和回滚清单；
- 自动退役范围排除领域知识、安全规则、授权门槛和项目不变量。

任何发现都不授权删除。`TEST` 表示“验证这个假设”，不表示“新模型已经让规则失效”。

## 支持范围

| 范围 | 已支持并验证 |
| --- | --- |
| 操作系统 | GitHub Actions 中的 Ubuntu、macOS 和 Windows |
| Node.js | 20、22、24 |
| 预设目标 | Codex（`~/.codex`）和 Claude Code（`~/.claude`） |
| 指令文件 | `AGENTS.md`、`CLAUDE.md`、`SKILL.md` |
| Agent 交接 | Codex 和 Claude Code Prompt 文件 |
| 其他配置 | 显式传给 `audit` 的任意有边界目录 |

其他 Linux 发行版在 Node.js 20+ 下预期可用，但尚未进入当前 CI 矩阵。

## 快速开始

扫描 Codex 配置：

```bash
npx skill-sunset@latest audit --codex --open
```

扫描 Claude Code 配置：

```bash
npx skill-sunset@latest audit --claude --open
```

扫描任意有边界目录，并输出适合 CI 的 JSON：

```bash
npx skill-sunset@latest audit /path/to/setup --format json --fail-on high
```

CLI 默认使用 `--lang auto`。使用 `--lang en` 或 `--lang zh-CN` 可指定主要报告语言；每个报告包仍会同时包含英文和简体中文 HTML。

## 完整案例：输入 → 发现 → 验证 → 回滚

假设 `AGENTS.md` 包含：

```md
Always use Context7 for every task.
[Deployment runbook](docs/deploy.md)
```

并且 `docs/deploy.md` 实际不存在。

1. **输入与快照。** 先保留可恢复副本，再审计目录。

   ```bash
   cp AGENTS.md AGENTS.md.skill-sunset.bak
   npx skill-sunset@latest audit . --out .skill-sunset --open
   ```

2. **发现。** 报告可能产生：

   - `UPDATE / broken-reference`：部署文档目标无法解析；
   - `UPDATE / context7-assumption`：需要核验当前运行时是否存在该工具；
   - `TEST / unconditional-tooling`：“每个任务都调用”需要做旧配置与新配置对照验证。

3. **修改与验证。** 先核验真实文档路径和当前工具列表。只修改已确认失效的引用；把无条件工具规则作为独立候选。重新运行审计和项目测试：

   ```bash
   npx skill-sunset@latest audit . --out .skill-sunset --format json
   npm test
   ```

   对 `TEST` 项填写 `.skill-sunset/experiment-template.json`。下面的验证不会执行命令：

   ```bash
   npx skill-sunset@latest test .skill-sunset/experiment-template.json --root .
   ```

   实际执行还需要单独添加 `--run`。实验通过只证明清单中编码的验收条件通过。

4. **回滚。** 如果引用、测试或任务行为退化，恢复备份并重新审计：

   ```bash
   cp AGENTS.md.skill-sunset.bak AGENTS.md
   npx skill-sunset@latest audit . --out .skill-sunset
   ```

   生成的 `rollback-manifest.json` 默认留空，只有取得授权的执行 Agent 才应写入真实改动和哈希。

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

报告会把用户主目录下的目标路径脱敏为 `$HOME/...`，其他绝对目标显示为 `$ABSOLUTE/<名称>`。终端仍输出真实的本地报告位置，便于所有者打开文件。

## 结果标签

- `MERGE`：完整重复或同名冲突的 Skill。
- `UPDATE`：失效路径、引用、工具或与版本耦合的指令。
- `DEMOTE`：仍然有用，但应下沉到渐进披露引用的常驻细节。
- `RETIRE`：同一扫描根中名称相同、完整 bundle 字节一致的通用 Skill；只建议可恢复归档。
- `TEST`：过时假设，必须先做新旧行为对照，不能直接清理。

## 行为实验安全

实验清单默认只验证；实际执行必须明确添加 `--run`。命令不经过 shell，并且默认只继承最小的不含凭据环境变量。若确实需要完整环境（其中可能包含提供商凭据），必须再显式添加 `--inherit-env`，且只能运行可信命令。

预检和结果文件只保留可执行文件名、参数数量、命令哈希、输出大小与输出哈希，不保存命令参数或输出正文。不要把凭据写进实验清单。

## 本地开发

```bash
npm test
npm pack --dry-run
node ./bin/skill-sunset.js audit ./test/fixtures/sample-setup --out ./demo-report --open
```

GitHub Actions 会运行 Gitleaks 和完整的操作系统、Node.js 版本矩阵。Gitleaks 是发布防线，但不能证明世界上所有凭据格式都能被识别。

参阅 [CHANGELOG.md](CHANGELOG.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和 [SECURITY.md](SECURITY.md)。

## 当前边界

0.2.0 已实现静态检查、保守重复退役、双语报告、路径脱敏、带执行门槛的命令实验框架、CI 严重度退出码和对抗性输出测试。当前提供商能力快照、使用量适配器和任务质量适配器仍属于后续证据层。
