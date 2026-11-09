// 构建：校验题库 → 组装数据 → 注入 app.html 模板 → 产出单文件应用（本地版 + Pages 版 index.html）
// 结构：src/exam.*.json（考试数据包）+ src/bank_*.json（题库）+ src/figs.js（配图）+ src/fig_map.json（题图映射）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

const template = readFileSync(join(src, 'app.html'), 'utf8');
const errors = [];
const stems = new Set();
const counts = {};

// 考试数据包：exam.*.json 提供科目白名单与考试结构
const examFiles = readdirSync(src).filter(f => /^exam\..+\.json$/.test(f)).sort();
const exams = examFiles.map(f => JSON.parse(readFileSync(join(src, f), 'utf8'))).sort((a, b) => (a.sort || 99) - (b.sort || 99));
const subjectKeys = new Set(exams.flatMap(e => (e.subjects || []).map(s => s.key)));

// 题库发现与校验（按文件名排序追加，保证已有题目 id 不变）
const files = readdirSync(src).filter(f => /^bank_.*\.json$/.test(f)).sort();
const allQuestions = [];
for (const f of files) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(join(src, f), 'utf8'));
  } catch (e) {
    errors.push(`${f}: JSON 解析失败 —— ${e.message}`);
    continue;
  }
  arr.forEach((q, i) => {
    const at = `${f}[${i}]`;
    if (!subjectKeys.has(q.s)) errors.push(`${at}: 科目 s="${q.s}" 未在任何 exam.*.json 数据包中声明`);
    if (!['single', 'multi'].includes(q.t)) errors.push(`${at}: 题型 t 必须是 single 或 multi`);
    if (!q.q || !q.o || !q.a || !q.e || !q.cn || !q.p) errors.push(`${at}: 缺少必填字段(q/o/a/e/cn/p)`);
    if (q.o && (q.o.length < 4 || q.o.length > 5)) errors.push(`${at}: 选项数量应为 4 或 5`);
    if (q.a && (!Array.isArray(q.a) || q.a.length === 0)) errors.push(`${at}: 答案 a 不能为空`);
    if (q.t === 'single' && q.a && q.a.length !== 1) errors.push(`${at}: 单选题答案只能有一个`);
    if (q.a && q.o && q.a.some(x => x >= q.o.length)) errors.push(`${at}: 答案索引越界`);
    if (q.t === 'multi' && q.a && q.a.length < 2) errors.push(`${at}: 多选题答案应不少于 2 个`);
    if (q.q && stems.has(q.q)) errors.push(`${at}: 题干重复`);
    if (q.q) stems.add(q.q);
    if (q.s) counts[q.s] = (counts[q.s] || 0) + 1;
  });
  allQuestions.push(...arr);
}

if (errors.length) {
  console.error('题库校验未通过：');
  errors.forEach(e => console.error('  ✗ ' + e));
  process.exit(1);
}

// 配图：按题干关键词映射挂接（首个命中的键生效），并校验图键存在
const figsJs = readFileSync(join(src, 'figs.js'), 'utf8');
const figKeys = new Set([...figsJs.matchAll(/'([a-z0-9-]+)'\s*:/g)].map(m => m[1]));
const figMap = JSON.parse(readFileSync(join(src, 'fig_map.json'), 'utf8'));
let figCount = 0;
for (const q of allQuestions) {
  for (const [kw, key] of Object.entries(figMap)) {
    if (q.q && q.q.includes(kw)) {
      if (!figKeys.has(key)) { errors.push(`fig_map: 图 "${key}" 不存在于 figs.js`); break; }
      q.fig = key; figCount++;
      break;
    }
  }
}

// 题库按科目 key 归组；校验每个数据包声明的科目都有题库
const banks = {};
allQuestions.forEach(q => { (banks[q.s] = banks[q.s] || []).push(q); });
for (const ex of exams) {
  (ex.subjects || []).forEach(s => {
    if (!banks[s.key]) errors.push(`数据包 ${ex.id}: 科目 ${s.key} 没有对应题库（bank_*.json 中 s="${s.key}"）`);
  });
}
if (errors.length) {
  console.error('校验未通过：');
  errors.forEach(e => console.error('  ✗ ' + e));
  process.exit(1);
}

const DATA = { exams, banks };
// 渲染层冒烟门禁：任何页面崩溃都阻断构建与发布
const { runSmoke } = await import('./smoke.mjs');
const smoke = runSmoke({ template, DATA });
if (!smoke.ok) {
  console.error(`冒烟测试未通过（${smoke.checks} 项 / 失败 ${smoke.failures.length} 项）：`);
  smoke.failures.slice(0, 30).forEach(f => console.error('  ✗ ' + f));
  process.exit(1);
}
const out = template
  .replace('/*__FIGS__*/', figsJs)
  .replace('/*__DATA__*/', JSON.stringify(DATA));
if (out === template) {
  console.error('未找到 /*__FIGS__*/ 或 /*__DATA__*/ 占位符，注入失败');
  process.exit(1);
}

const outFile = join(root, '经济师刷题.html');
writeFileSync(outFile, out, 'utf8');
writeFileSync(join(root, 'index.html'), out, 'utf8');
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`✓ 构建成功：${outFile}（同步输出 index.html 供 GitHub Pages 使用）`);
console.log(`  题库总量：${total} 题（${Object.keys(counts).map(k => `${k}:${counts[k]}`).join(' ')}）`);
console.log(`  配图题目：${figCount} 题（图库 ${figKeys.size} 张）`);
console.log(`  考试数据包：${exams.map(e => e.name).join('、') || '无'}`);
const { genPages } = await import('./gen-pages.mjs');
const pages = genPages({ exams, banks, root });
console.log(`  静态入口页：${pages.count} 个（总览 + ${pages.count - 1} 场考试）· sitemap ${pages.urls} 条 URL`);
// PWA：Service Worker 缓存版本由题库内容决定，题库一变缓存自动失效
const swVer = createHash('sha1').update(JSON.stringify(DATA)).update(template).update(readFileSync(join(root, 'install.html'))).digest('hex').slice(0, 8);
const sw = [
  `const CACHE='tizhou-${swVer}';`,
  `const CORE=['./','./index.html','./manifest.webmanifest','./install.html','./icons/icon-192.png','./icons/icon-512.png'];`,
  `self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});`,
  `self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});`,
  `self.addEventListener('fetch',e=>{`,
  `  const r=e.request; if(r.method!=='GET')return;`,
  `  // 安装包等大文件不进缓存，直接交给浏览器下载`,
  `  if(/\\.(apk|zip|exe|dmg|ipa)$/i.test(new URL(r.url).pathname))return;`,
  `  if(r.mode==='navigate'){`,
  `    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res;})`,
  `      .catch(()=>caches.match(r).then(h=>h||caches.match('./index.html'))));`,
  `    return;`,
  `  }`,
  `  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{`,
  `    if(res.ok&&new URL(r.url).origin===self.location.origin){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));}`,
  `    return res;})));`,
  `});`,
].join('\n') + '\n';
writeFileSync(join(root, 'sw.js'), sw, 'utf8');
console.log(`  PWA：sw.js 已生成（缓存版本 ${swVer}）`);
