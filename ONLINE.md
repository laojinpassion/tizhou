# 题舟 TiZhou · 上线与应急交接

## 线上信息

| 项 | 值 |
|---|---|
| 线上地址 | https://laojinpassion.github.io/tizhou/ |
| 仓库 | https://github.com/laojinpassion/tizhou （公开，MIT） |
| 本地代码 | `D:\JARVIS\jingjishi` |
| Pages 分支 | `main` / 根目录 |
| 当前版本 tag | `v1.1.0`（引擎修复）、`v1.2.0`（上线物料与静态页）、`v1.2.1`（PWA）、`v1.3.0`（安卓 APK）、`v1.4.0`（体验重构） |
| 安卓安装包 | `https://laojinpassion.github.io/tizhou/download/tizhou-1.4.0.apk`（4.5 MB，versionCode 2，签名版） |
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

## 原生壳工程（APK / IPA）

- `app/` 为 Capacitor 工程：`package.json`、`capacitor.config.json`（appId `com.laojinpassion.tizhou`）、`android/` 原生工程；`www/` 由 `build-app.mjs` 从主仓库产物自动组装，不纳入版本控制。
- 本机工具链放在工作区 `toolchain/`（**JDK 21**、Android SDK、Gradle 发行版），`app/android/local.properties` 指向该 SDK。
  注意：`@capacitor/android` 的 `build.gradle` 写死 `sourceCompatibility JavaVersion.VERSION_21`，用 JDK 17 编译会在 `:capacitor-android:compileDebugJavaWithJavac` 报「无效的源发行版:21」，必须用 JDK 21。
- 编译调试包：`cd app/android && ./gradlew assembleDebug --no-daemon`。首次构建需让 Gradle 走代理：`GRADLE_OPTS="-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=<端口> ..."`。
- 发布签名：密钥库 `app/android/keystore/tizhou-release.keystore`，别名 `tizhou`，有效期至 2056-11-01；口令写在 `app/android/keystore.properties`（与 keystore、`*.jks` 一起已加入 `.gitignore`，**不会随发布上线**）。`app/build.gradle` 在该文件存在时自动启用 release 签名，不存在时 `assembleRelease` 产出未签名包。
- 完整出包顺序（缺一步 APK 里就是旧题库）：
  ```bash
  cd /d/JARVIS/jingjishi
  node build.mjs            # 题库校验 + 冒烟 + 生成 index.html / 静态页 / sw.js
  node build-app.mjs        # 组装 app/www
  cd app && npx cap copy android && cd android
  ./gradlew assembleRelease --no-daemon
  # 产物 app/android/app/build/outputs/apk/release/app-release.apk
  cp app/build/outputs/apk/release/app-release.apk ../../download/tizhou-<版本>.apk
  ```
- 安装包对外地址：`https://laojinpassion.github.io/tizhou/download/tizhou-<版本>.apk`，由 `install.html` 的「下载安卓版 APK」按钮引用。发布新版本时**同时改五处**，漏一处就会「版本号变了但用户还在下旧包」：
  1. `app/android/app/build.gradle` 的 `versionCode`（必须 +1，否则装不上覆盖不了）与 `versionName`
  2. `src/app.html`「我的 → 关于题舟」里的版本号文案
  3. `download/` 下的 APK 与 `.sha256` 文件名
  4. `install.html` 的下载链接、版本号、大小
  5. `README.md` 的下载链接
- APK 里 `assets/public/` 是 `www` 的副本，**改完网页必须 `cap copy` 再打包**，否则 App 内还是老内容。
- `.github/workflows/build-android.yml` 为云端构建流水线（本地保留，未上传）：当前 `gh` token 的 scopes 为 `repo, gist, read:org`，缺 `workflow`，通过 Git Data API / Contents API 写入 `.github/workflows/` 会返回 404。需要先执行 `gh auth refresh -h github.com -s workflow` 重新授权，之后才能随发布上传并触发 Actions。
- 正式上架需要 release 签名（keystore 由开发者本人保管）、软著与开发者账号，见工作区「上架材料包」。

## 内容纠错

用户通过 GitHub Issue（题目纠错模板）反馈；核对后只修改对应题库文件的 `q/o/a/e/k`，**不要删除或重排已有题目**，题目 id 由数组顺序决定，重排会导致用户做题记录错位。修正后必须重跑 `node build.mjs` 并发布。
