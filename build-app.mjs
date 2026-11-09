// 组装 Capacitor 原生壳所需的 www 资产（从主仓库构建产物复制）
// 用法：node build-app.mjs（在 app/ 下也可用 npm run assets）
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const www = join(root, 'app', 'www');
const files = [
  'index.html', 'manifest.webmanifest', 'sw.js', 'install.html',
  'privacy.html', 'terms.html', 'support.html', 'exams.html',
  'sitemap.xml', 'robots.txt', '经济师刷题.html',
];
const dirs = ['icons', 'exams'];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

let n = 0;
for (const f of files) {
  const src = join(root, f);
  if (!existsSync(src)) { console.log('  ! 缺少（请先 node build.mjs）:', f); continue; }
  cpSync(src, join(www, f)); n++;
}
for (const d of dirs) {
  const src = join(root, d);
  if (!existsSync(src)) { console.log('  ! 缺少目录:', d); continue; }
  cpSync(src, join(www, d), { recursive: true });
  n += readdirSync(src).length;
}
// 离线单文件在 App 内不需要重复分发，保留即可（2.1 MB）
console.log(`✓ www 资产已组装：${n} 项 → ${www}`);
console.log('  下一步：cd app && npm install && npx cap add android && npm run sync');
