# 4 个真实、脱敏、可重复的案例

这些案例来自 2026-09-01 对维护者当前安装的两个 Skill 目录进行的本地只读扫描。原始路径、Skill 名称和指令正文没有公开；保留的是数量、工具给出的判断和脱敏后的公开样本。[查看机器可读快照](cases/2026-09-01-owner-scan.json)。

这只是维护者环境中的真实问题，不代表其他用户一定遇到，也不证明修改后效果一定变好。

## 案例 1：Mac 上的 Skill 写了 Windows 专用路径

**实际发现：** 在 Mac 上扫描时，一个已安装 Skill 中出现了 5 个 Windows 绝对路径。当前系统无法直接使用这些路径。

**工具判断：** `UPDATE / stale-absolute-path`。

**解决什么：** 提前找出“这条指令在当前系统不能运行”的地方，避免 Agent 执行到一半才找不到程序、资料或输出目录。

**建议处理：** 先确认这个 Skill 是否本来就只给 Windows 使用。如果是，就补上系统条件；如果不是，再改成跨平台路径或项目相对路径。不能只看到 `UPDATE` 就直接改。

**公开复现：**

```bash
node ./bin/skill-sunset.js audit ./examples/cases/platform-specific-paths --out /tmp/skill-sunset-platform --lang zh-CN
```

## 案例 2：入口文件塞了 2,517 行内容

**实际发现：** 一个会常驻读取的 Agent 指令文件有 2,517 行，估算约 17,984 token。

**工具判断：** `DEMOTE / progressive-disclosure`。

**解决什么：** 找出“每次都带着走、但大多数任务用不到”的内容，减少上下文负担。

**建议处理：** 入口只保留什么时候启用、关键安全边界和验收标准；长案例和低频说明移到按需读取的 references。移动后还要验证 Agent 能找到这些资料。

**公开复现：** 仓库测试样本用 414 行触发同一条规则。

```bash
node ./bin/skill-sunset.js audit ./test/fixtures/sample-setup/.agents/skills/large-skill --out /tmp/skill-sunset-large --lang zh-CN
```

## 案例 3：规定“每个任务都必须先调用某个工具”

**实际发现：** 两个目录合计发现 4 条把工具调用绑定到每个任务的规则。

**工具判断：** `TEST / unconditional-tooling`，不是删除建议。

**解决什么：** 让维护者注意可能存在的多余工具调用、等待时间和上下文开销，同时避免未经验证就删掉仍然有用的规则。

**建议处理：** 准备几项有代表性的任务，分别用原规则和“只在需要时调用”的规则运行，先比较任务是否完成，再比较调用次数与耗时。结果不明确就保留原规则。

**公开复现：**

```bash
node ./bin/skill-sunset.js audit ./examples/cases/always-use-tool --out /tmp/skill-sunset-tool --lang zh-CN
```

## 案例 4：工具提醒复核，但人工确认后保留

**实际发现：** 一个现有说明提到了具体模型家族名称，工具因此提示检查版本关联。

**工具判断：** `UPDATE / model-version-coupling`。

**人工复核结果：** 这段话用于说明当前特定迁移任务，内容仍然有效，因此没有修改。

**解决什么：** 既能提醒维护者检查可能过时的型号说明，又不会把“出现具体模型名”直接当成错误。这说明报告是复核清单，不是自动改写命令。

**公开复现：**

```bash
node ./bin/skill-sunset.js audit ./examples/cases/model-pinned --out /tmp/skill-sunset-model --lang zh-CN
```

## 一眼看懂结果

| 原问题 | 工具给出的结果 | 能不能直接删除 |
| --- | --- | --- |
| 当前 Mac 无法使用 Windows 路径 | `UPDATE` | 不能；先确认它是否只给 Windows 使用 |
| 入口文件太长 | `DEMOTE` | 不能；先拆分并验证还能找到资料 |
| 每个任务都调用工具 | `TEST` | 不能；必须先做对照测试 |
| 出现具体模型名称 | `UPDATE` | 不能；本次人工确认仍有效，所以保留 |

这些案例展示的是“发现问题并缩小下一步”，不是让工具替人删除规则。
