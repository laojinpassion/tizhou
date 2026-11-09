# 题舟 TiZhou · 上线与应急交接

## 线上信息

| 项 | 值 |
|---|---|
| 线上地址 | https://laojinpassion.github.io/tizhou/ |
| 仓库 | https://github.com/laojinpassion/tizhou （公开，MIT） |
| 本地代码 | `D:\JARVIS\jingjishi` |
| Pages 分支 | `main` / 根目录 |
| 当前版本 tag | `v1.1.0`（引擎修复）、`v1.2.0`（上线物料与静态页） |
| 题库规模 | 25 场考试 / 26 个科目 / 2653 题 |

## 日常发布（唯一通道）

```bash
cd /d/JARVIS/jingjishi
node build.mjs      # 题库校验 + 572 项冒烟门禁 + 生成 index.html / 静态页 / sitemap
git add -A
node publish-api.mjs laojinpassion tizhou main "提交说明"
```

**约束**：`git push` 对 github.com 不可用（443 超时），发布一律走 `publish-api.mjs`（GitHub API）。该脚本用 `git ls-files` 组装 tree，**新文件必须先 `git add`**，否则不会上线。

发布后建议打 tag：
```bash
SHA=$(gh api repos/laojinpassion/tizhou/git/ref/heads/main --jq '.object.sha')
gh api -X POST repos/laojinpassion/tizhou/git/refs -f ref=refs/tags/v1.x.x -f sha="$SHA"
```

## 回滚

```bash
# 把 main 指回任一历史提交（本地 git 历史与远端不连续，不能用 git reset/push 回滚）
gh api -X PATCH repos/laojinpassion/tizhou/git/refs/heads/main -f sha=<目标提交SHA> -F force=true
```

已知可回滚点：`9c8abbe4c3172683924f16f47e989b4fbbf7cb56`（扩容完成、引擎修复前）、`08d676934e62c0e4949e95c81a462e2ca821d9f2`（v1.1.0 引擎修复后）。

## 校验与门禁

- `node smoke.mjs`：572 项渲染层冒烟（25 场考试的章节定位、组卷、答题、交卷、错题本、状态重置、跨考试断点）。
- `node build.mjs`：自动调用冒烟，任一失败即退出且不发布。
- 修改前备份：`D:/巴蒂工作区/2026-11-08-15-59-21/backup-20261108/`。

## 静态入口页

- 由 `gen-pages.mjs` 在每次构建时自动生成：`exams.html`（总览）、`exams/<考试id>.html`（25 页）、`sitemap.xml`、`robots.txt`。
- 内容取自 `src/exam.*.json` 与 `src/bank_*.json`，题量与章节自动同步，禁止手工编辑这些页面。
- 主应用 `index.html` 仍是单文件、含全部题库数据；静态页只提供可被搜索引擎与 AI 读取的文字入口，不承担刷题功能。

## 内容纠错

用户通过 GitHub Issue（题目纠错模板）反馈；核对后只修改对应题库文件的 `q/o/a/e/k`，**不要删除或重排已有题目**，题目 id 由数组顺序决定，重排会导致用户做题记录错位。修正后必须重跑 `node build.mjs` 并发布。
