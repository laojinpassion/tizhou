// 构建：把题库 JSON 校验后注入 app.html 模板，产出单文件 经济师刷题.html（含配图库与题图映射）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const BANK_ORDER = [
  'bank_jc_1.json', 'bank_jc_2.json', 'bank_jc_3.json',
  'bank_gs_1.json', 'bank_gs_2.json', 'bank_gs_3.json',
];

const template = readFileSync(join(src, 'app.html'), 'utf8');
const bankFiles = [];
const allQuestions = [];
const errors = [];
const stems = new Set();
const counts = { jc: 0, gs: 0 };

// 自动发现未列入顺序的新题库文件（按文件名排序追加，保证已有题目 id 不变）
const files = readdirSync(src).filter(f => /^bank_.*\.json$/.test(f)).sort();
for (const f of files) {
  if (!BANK_ORDER.includes(f)) BANK_ORDER.push(f);
}

for (const f of BANK_ORDER) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(join(src, f), 'utf8'));
  } catch (e) {
    errors.push(`${f}: JSON 解析失败 —— ${e.message}`);
    continue;
  }
  arr.forEach((q, i) => {
    const at = `${f}[${i}]`;
    if (!['jc', 'gs'].includes(q.s)) errors.push(`${at}: 科目 s 必须是 jc 或 gs`);
    if (!['single', 'multi'].includes(q.t)) errors.push(`${at}: 题型 t 必须是 single 或 multi`);
    if (!q.q || !q.o || !q.a || !q.e || !q.cn || !q.p) errors.push(`${at}: 缺少必填字段(q/o/a/e/cn/p)`);
    if (q.o && (q.o.length < 4 || q.o.length > 5)) errors.push(`${at}: 选项数量应为 4 或 5`);
    if (q.a && (!Array.isArray(q.a) || q.a.length === 0)) errors.push(`${at}: 答案 a 不能为空`);
    if (q.t === 'single' && q.a && q.a.length !== 1) errors.push(`${at}: 单选题答案只能有一个`);
    if (q.a && q.o && q.a.some(x => x >= q.o.length)) errors.push(`${at}: 答案索引越界`);
    if (q.t === 'multi' && q.a && q.a.length < 2) errors.push(`${at}: 多选题答案应不少于 2 个`);
    if (q.q && stems.has(q.q)) errors.push(`${at}: 题干重复`);
    if (q.q) stems.add(q.q);
    if (q.s) counts[q.s]++;
  });
  allQuestions.push(...arr);
  bankFiles.push(f);
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

// 考试数据包：exam.*.json 描述考试结构，题库按科目 key 归组
const examFiles = readdirSync(src).filter(f => /^exam\..+\.json$/.test(f)).sort();
const exams = examFiles.map(f => JSON.parse(readFileSync(join(src, f), 'utf8')));
const banks = {};
allQuestions.forEach(q => { (banks[q.s] = banks[q.s] || []).push(q); });
for (const ex of exams) {
  (ex.subjects || []).forEach(s => {
    if (!banks[s.key]) errors.push(`数据包 ${ex.id}: 科目 ${s.key} 没有对应题库（bank_*.json 中 s="${s.key}"）`);
  });
}
const DATA = { exams, banks };

const bankJs = JSON.stringify(allQuestions);
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
console.log(`✓ 构建成功：${outFile}（同步输出 index.html 供 GitHub Pages 使用）`);
console.log(`  经济基础 ${counts.jc} 题 · 工商管理 ${counts.gs} 题 · 合计 ${counts.jc + counts.gs} 题`);
console.log(`  配图题目：${figCount} 题（图库 ${figKeys.size} 张）`);
console.log(`  考试数据包：${exams.map(e => e.name).join('、') || '无'}`);
console.log(`  题库文件：${files.join(', ')}`);
