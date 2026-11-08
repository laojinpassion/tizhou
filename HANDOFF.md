# 题舟（TiZhou）题库扩容交接说明

> 本文档面向接手继续开发的 AI 助手或开发者。读完本文即可独立继续工作，无需其他上下文。

## 一、项目是什么

题舟 TiZhou：单文件 HTML 通用刷题引擎，支持多考试数据包。

- **线上地址**：https://laojinpassion.github.io/tizhou/
- **GitHub 仓库**：https://github.com/laojinpassion/tizhou（公开，MIT，账号 laojinpassion）
- **本地代码**：`D:\JARVIS\jingjishi`
- 面向公众免费使用，免登录、离线可用。参考竞品：驾考宝典、考试宝、粉笔、万题库。

## 二、当前状态（截至 2026-11-08）

- 25 场考试全部上线可刷，总题库 **1527 题**
- 三个旗舰包已完成深度扩容（不要再动）：
  - 中级经济师·工商管理：547 题（jc 382 + gs 165，含 8 个案例分析）
  - CPA·会计：90 题
  - 中级会计实务：89 题
- 科目一 jk1：117 题（已够，不用动）
- **待扩容的 20 个薄包**（见第五节清单），目标是每包扩到 80 题以上

## 三、目录结构与核心命令

```
D:\JARVIS\jingjishi\
├── src\app.html          # 引擎模板（界面+逻辑），不要动
├── src\exam.*.json       # 考试数据包（考试名/科目/模考规则/及格线）
├── src\bank_*.json       # 题库文件（本任务主要产出）
├── src\figs.js           # 配图库（SVG，不用动）
├── src\fig_map.json      # 题目-配图映射（不用动）
├── build.mjs             # 构建脚本：校验题库 → 生成 经济师刷题.html 和 index.html
├── publish-api.mjs       # 发布脚本：走 GitHub API 上传（git push 不可用！）
├── serve.mjs             # 本地预览服务器
├── index.html            # 构建产物（GitHub Pages 入口）
├── 经济师刷题.html        # 构建产物（本地版）
└── HANDOFF.md            # 本文档
```

常用命令（Windows Git Bash，先 `cd /d/JARVIS/jingjishi`）：

```bash
node build.mjs              # 构建（会强制校验题库，报错就修）
node serve.mjs 8046         # 本地预览 http://127.0.0.1:8046
node publish-api.mjs laojinpassion tizhou main "提交说明"   # 发布上线
```

**发布注意**：`git push` 对 github.com 不可用（443 超时是常态），**发布一律用 publish-api.mjs**（走 GitHub API，gh CLI 已登录账号 laojinpassion）。

## 四、题库文件格式（严格遵守）

新建题库文件命名：`src/bank_<科目key>_<序号>.json`（序号接着现有文件递增），内容为 JSON 数组：

```json
[
  {
    "s": "科目key（必须与 exam.*.json 中 subjects[].key 一致）",
    "p": "部/章组名（如：会计概述）",
    "c": 1,
    "cn": "章名（如：会计职能与会计基础）",
    "t": "single 或 multi",
    "q": "题干",
    "o": ["选项A", "选项B", "选项C", "选项D"],
    "a": [0],
    "e": "解析：讲清为什么对/为什么错，附【易错点】或【记忆钩子】",
    "k": "考点标签"
  }
]
```

**硬性校验规则**（build.mjs 强制，违反即构建失败）：
- single 题：`a` 数组恰好 1 个索引；multi 题：`a` 数组 ≥2 个索引
- 选项数量 4~5 个；`a` 索引必须从 0 开始且 < 选项数
- multi 题答案 ≥2 个；**题干全文不得与任何现有题重复**（全局查重）
- 新增题的 `c`（章号）不要与该科目现有题的章号冲突，新章节用下一个可用序号

**质量要求**：
- 按该考试的真实考纲和主流教材出题，答案必须准确；不确定的法条/数字宁可绕开
- 解析讲透"为什么"，带【记忆钩子】【易错点】（参考现有题目风格）
- 优先补齐该科目缺失/薄弱的章节，而不是在同一章堆题

## 五、待扩容清单（按此顺序处理，最薄优先）

| 顺序 | 科目key | 考试 | exam 文件 | 现有题量 | 目标 |
|---|---|---|---|---|---|
| 1 | jiankang | 健康管理师 | exam.jiankang.json | 20 | ≥80 |
| 2 | yaoshi | 执业药师（药学类） | exam.yaoshi.json | 20 | ≥80 |
| 3 | rl | 中级经济师·人力资源方向 | exam.jjjsrl.json | 21 | ≥80 |
| 4 | xingce | 公务员考试（行测） | exam.xingce.json | 22 | ≥80 |
| 5 | ruankao | 软考（系统集成项目管理工程师） | exam.ruankao.json | 23 | ≥80 |
| 6 | zhuanan | 注册安全工程师 | exam.zhuanan.json | 24 | ≥80 |
| 7 | sws | 税务师 | exam.sws.json | 26 | ≥80 |
| 8 | yhjr | 银行/证券/基金从业 | exam.yhjr.json | 25 | ≥80 |
| 9 | zaojia | 一级造价工程师 | exam.zaojia.json | 25 | ≥80 |
| 10 | jianli | 监理工程师 | exam.jianli.json | 25 | ≥80 |
| 11 | xiaofang | 注册消防工程师 | exam.xiaofang.json | 25 | ≥80 |
| 12 | ncre | 计算机二级（MS Office） | exam.ncre.json | 25 | ≥80 |
| 13 | shiye | 事业单位联考（公基） | exam.shiye.json | 25 | ≥80 |
| 14 | fakao | 法律职业资格（客观题） | exam.fakao.json | 27 | ≥80 |
| 15 | jiaozhao | 教师招聘（教招） | exam.jiaozhao.json | 27 | ≥80 |
| 16 | ej | 二级建造师 | exam.ejjz.json | 31 | ≥80 |
| 17 | cjj | 初级经济师 | exam.cjjs.json | 33 | ≥80 |
| 18 | yj | 一级建造师 | exam.yjjz.json | 36 | ≥80 |
| 19 | kj | 初级会计实务 | exam.cjk2026.json | 80 | ≥100 |
| 20 | jz1 | 教资综合素质 | exam.jz2026.json | 87 | ≥100 |
| 21 | jk4 | 驾考科目四（纯单选） | exam.jiakao4.json | 57 | ≥80 |

## 六、每个包的标准操作流程

1. **统计现状**：
   ```bash
   node -e "const fs=require('fs');const {readdirSync}=fs;const files=readdirSync('./src').filter(f=>/^bank_.*\.json$/.test(f));const b={};files.forEach(f=>JSON.parse(fs.readFileSync('./src/'+f,'utf8')).forEach(q=>{(b[q.s]=b[q.s]||[]).push(q)}));console.log(JSON.stringify(Object.fromEntries(Object.entries(b).map(([k,v])=>[k,{total:v.length,single:v.filter(q=>q.t==='single').length,multi:v.filter(q=>q.t==='multi').length,chs:[...new Set(v.map(q=>q.p+'|'+q.c))]}])),null,1))"
   ```
2. **确定新文件名**：`ls src/bank_<科目key>*.json`，取最大序号+1。
3. **编写新题**：约 55~65 道（目标总题量 ≥80），按第四节格式；优先补缺失章节，新章节 c 用下一个可用序号。
4. **更新模考配置**：编辑对应 `src/exam.*.json` 的 mock 字段，让 single/multi 不超过题池实际数量。建议 professional 考试设 `{"single":60,"multi":20,"case":0,"total":80,"dur":90}`（科目 key 以 subjects[0].key 为准，注意 exam 文件里的 mock 键就是它）。
5. **构建**：`node build.mjs` 必须通过。报错就修（通常是题干重复或答案索引越界），**不许跳过校验**。
6. **发布**：`node publish-api.mjs laojinpassion tizhou main "<考试名>扩容至 N 题"`。失败等 30 秒重试一次；再失败跳过继续下一包（本地题库已保存），最后统一再发。
7. **记录**：本清单标记该包完成，进入下一个包。

**每完成一个包就发布一次**——即使中途停止，已完成的包都已上线。

## 七、全部完成后的收尾

1. 更新 `README.md` 的数据包表格（各包新题量）。
2. `node publish-api.mjs laojinpassion tizhou main "题库扩容完成：总题量 N 题"` 最后发布一次。
3. 输出总结：每个包扩容前后题量对照、总题库规模、有无未完成项及原因。

## 八、禁止事项

- 不要动引擎代码：`src/app.html`、`build.mjs`、`publish-api.mjs`、`serve.mjs`、`src/figs.js`、`src/fig_map.json`
- 不要动旗舰包：gs/jc（中级经济师·工商管理）、cpa（CPA·会计 90 题）、zj（中级会计实务 89 题）、jk1（科目一 117 题）
- 不要删除或修改任何**现有题目**（只新增文件/追加题目；改动会导致用户已有做题记录错位）
- 不要用 `git push`（会超时失败）；只用 publish-api.mjs
- src/app.html 里的 CATALOG 目录已全部是 ready 状态，不要碰

## 九、技术备忘（踩过的坑）

- 占位符注入：`/*__DATA__*/` 替换后**后面不能跟字面量**（曾因残留 `{};` 导致语法错误、整站白屏）
- 校验渲染内容用 `document.getElementById('app').textContent`，不要用 `document.body.textContent`（body 会把 script 源码算进去导致误报）
- 浏览器自动化测试前先 stub `window.alert / window.confirm`（alert 会阻塞 evaluate 导致超时）
- 多考试数据包环境下调用模考前，先 `openExam(索引)` 切换考试上下文
- 本地 .git 历史与 GitHub 远端不连续（远端由 API 提交创建）；如需对齐：`git fetch origin && git reset --soft origin/main && git commit -m sync && git push`
