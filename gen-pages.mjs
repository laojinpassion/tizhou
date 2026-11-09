// 生成静态可索引入口页：总览 + 每场考试一页 + sitemap + robots
// 全部内容由 src/exam.*.json 与 src/bank_*.json 自动推导，题量与章节不会随扩容过时。
// 主应用 index.html 不做任何改动，静态页只作为「招牌与菜单」。
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://laojinpassion.github.io/tizhou/';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonld = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

const CSS = `:root{--bg:#f4f6f9;--card:#fff;--ink:#1c2330;--mut:#5b6678;--acc:#2563eb;--line:#e3e8ef;--okbg:#ecf7f0;--ok:#2e8b57}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:28px 18px 64px}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
header{background:linear-gradient(135deg,#2f6fb2,#173d61);color:#fff;border-radius:18px;padding:28px 24px;margin-bottom:20px}
header h1{margin:0 0 8px;font-size:28px;letter-spacing:1px}header p{margin:0;opacity:.9;font-size:15px}
.crumb{font-size:13px;color:var(--mut);margin-bottom:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:16px}
h2{font-size:20px;margin:0 0 12px}h3{font-size:16px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;font-size:14.5px}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600}td.n{text-align:right;white-space:nowrap}
.badge{display:inline-block;background:var(--okbg);color:var(--ok);border-radius:8px;padding:1px 9px;font-size:12px;margin-left:6px}
.stats{display:flex;flex-wrap:wrap;gap:10px}.stat{flex:1;min-width:120px;background:var(--bg);border-radius:12px;padding:12px;text-align:center}
.stat b{display:block;font-size:22px;color:var(--acc)}.stat span{font-size:12px;color:var(--mut)}
.btn{display:inline-block;background:var(--acc);color:#fff;border-radius:12px;padding:13px 26px;font-weight:700;margin:6px 10px 6px 0}
.btn.ghost{background:#fff;color:var(--acc);border:1.5px solid var(--acc)}
ul{padding-left:20px}li{margin:5px 0}.mut{color:var(--mut);font-size:13.5px}
footer{margin-top:28px;color:var(--mut);font-size:13px;line-height:1.9}
@media(max-width:600px){.wrap{padding:16px 12px 48px}header h1{font-size:22px}table{font-size:13px}}`;

function layout({ title, desc, canonical, body, structured, prefix = '' }) {
  const ld = `<script type="application/ld+json">${jsonld(structured)}<\/script>`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%232f6fb2'/%3E%3Cpath%20d='M32%2010L32%2040L14%2040Z'%20fill='white'/%3E%3C/svg%3E">
<style>${CSS}</style>
${ld}
</head>
<body>
<div class="wrap">
${body}
<footer>
题舟 TiZhou · 免费、免登录、无广告的单文件刷题应用。所有题目为依据公开考试大纲与通用教材知识体系生成的<b>模拟题</b>，非官方真题；法条、数字、政策类考点以当年官方教材为准。<br>
做题进度仅保存在本机浏览器，清除浏览器数据会丢失。本项目与任何官方机构、出版社无关。
</footer>
</div>
</body>
</html>
`;
}

const FAQ = [
  ['题舟是什么？', '一个单文件、免注册、免费的在线刷题应用。电脑双击打开或手机浏览器打开都能用，进度存在本机浏览器，不需要账号。'],
  ['收录哪些考试？', '目前收录 25 场考试，覆盖驾驶驾考、经济职称、财会金融、建筑工程、教师资格、公职编制、医药健康、计算机软考与法律职业资格等类目。'],
  ['题目是官方真题吗？', '不是。题目为依据公开考试大纲与通用教材生成的模拟题，官方不公布真题；请以当年官方教材与考纲为准。'],
  ['做题进度存在哪里？', '仅保存在当前设备当前浏览器的本地存储中，不上传服务器。清除浏览器数据或更换设备会丢失进度。'],
  ['手机上能用吗？能离线吗？', '手机浏览器可直接使用。把 HTML 文件保存到本地后可不联网刷题；在线访问时断网则无法加载页面。'],
  ['有模考功能吗？', '有。按每个数据包配置的题型结构随机组卷、计时、到时自动交卷，并记录成绩；多数考试为 80 题卷，部分为 95 或 100 题卷。'],
  ['发现答案有误怎么办？', '可到 GitHub 仓库 laojinpassion/tizhou 提交 Issue，按题目纠错模板写明题干、选项、答案与依据，我们会核对修正。'],
];

export function genPages({ exams, banks, root }) {
  const dir = join(root, 'exams');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const totalQ = Object.values(banks).reduce((n, arr) => n + arr.length, 0);
  const catMap = new Map();
  exams.forEach(e => { if (!catMap.has(e.cat)) catMap.set(e.cat, []); catMap.get(e.cat).push(e); });

  // ---- 总览页 ----
  const catHTML = [...catMap.entries()].map(([cat, list]) => `
<h3>${esc(cat)}</h3>
<table><thead><tr><th>考试</th><th>题库内容</th><th class="n">题量</th></tr></thead><tbody>
${list.map(e => {
    const n = (e.subjects || []).reduce((m, s) => m + ((banks[s.key] || []).length), 0);
    return `<tr><td><a href="exams/${esc(e.id)}.html">${esc(e.name)}</a></td><td class="mut">${(e.subjects || []).map(s => esc(s.short || s.name)).join(' · ')}</td><td class="n">${n} 题</td></tr>`;
  }).join('')}
</tbody></table>`).join('');

  const overviewBody = `
<header><h1>题舟 TiZhou · 考试目录</h1><p>${exams.length} 场考试 · ${totalQ} 道免费模拟题 · 章节练习 / 错题本 / 全真模考 · 免登录</p></header>
<div class="card">
  <h2>可以刷什么</h2>
  <div class="stats">
    <div class="stat"><b>${exams.length}</b><span>场考试</span></div>
    <div class="stat"><b>${totalQ}</b><span>道题目</span></div>
    <div class="stat"><b>0</b><span>元 / 无广告</span></div>
    <div class="stat"><b>本地</b><span>进度存储</span></div>
  </div>
  <p style="margin:14px 0 0"><a class="btn" href="index.html">开始刷题 →</a><a class="btn ghost" href="https://github.com/laojinpassion/tizhou" target="_blank">GitHub 源码</a></p>
</div>
<div class="card"><h2>全部考试与题库</h2>${catHTML}</div>
<div class="card"><h2>功能说明</h2><ul>
<li><b>章节练习</b>：按章节逐题刷，支持本科全部乱序刷；每章显示进度与正确率。</li>
<li><b>错题本</b>：做错自动收进来，重做全对自动移出，记录错误日期。</li>
<li><b>全真模考</b>：按数据包配置的题型结构组卷、计时、自动交卷、成绩历史与断点续考。</li>
<li><b>两种揭晓模式</b>：批量揭晓（5 题一组）与即时揭晓（做一题看一题）。</li>
<li><b>理解配图</b>：部分题目自动挂接内嵌 SVG 示意图。</li>
</ul></div>
<div class="card"><h2>常见问题</h2>${FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div>
`;
  const overviewStructured = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: '题舟 TiZhou', url: BASE, inLanguage: 'zh-CN', description: '25 场考试免费在线刷题与全真模考' },
      { '@type': 'ItemList', name: '题舟考试数据包目录', numberOfItems: exams.length,
        itemListElement: exams.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, url: `${BASE}exams/${e.id}.html` })) },
      { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
  writeFileSync(join(root, 'exams.html'), layout({
    title: '题舟 TiZhou · 25 场考试题库目录', desc: `题舟收录 ${exams.length} 场考试、${totalQ} 道免费模拟题，支持章节练习、错题本与全真模考。查看全部考试与题量。`,
    canonical: BASE + 'exams.html', body: overviewBody, structured: overviewStructured,
  }), 'utf8');

  // ---- 分场页 ----
  let count = 1;
  for (const e of exams) {
    const qs = [];
    (e.subjects || []).forEach(s => qs.push(...(banks[s.key] || [])));
    const nSingle = qs.filter(q => q.t === 'single').length;
    const nMulti = qs.filter(q => q.t === 'multi').length;
    const chMap = new Map();
    qs.forEach(q => { const k = `${q.p}|${q.c}`; if (!chMap.has(k)) chMap.set(k, { cn: q.cn, p: q.p, c: q.c, n: 0 }); chMap.get(k).n++; });
    const chs = [...chMap.values()];
    const mockLine = (e.subjects || []).map(s => {
      const r = (e.mock || {})[s.key];
      if (!r) return '';
      return `<li>${esc(s.short || s.name)}：${r.single} 单选 + ${r.multi} 多选${r.case ? ' + ' + r.case + ' 组案例分析' : ''}，共 ${r.total} 题，${r.dur} 分钟，满分 ${e.totalScore} 分、${e.passScore} 分及格。</li>`;
    }).join('');
    const chHTML = chs.map(ch => `<tr><td>${esc(ch.p)}</td><td>第 ${esc(ch.c)} 章 ${esc(ch.cn)}</td><td class="n">${ch.n} 题</td></tr>`).join('');
    const body = `
<div class="crumb"><a href="../exams.html">考试目录</a> › ${esc(e.cat)} › ${esc(e.name)}</div>
<header><h1>${esc(e.icon || '📘')} ${esc(e.name)}</h1><p>${qs.length} 道免费模拟题 · ${chs.length} 个章节 · 章节练习 / 错题本 / 全真模考</p></header>
<div class="card">
  <div class="stats">
    <div class="stat"><b>${qs.length}</b><span>总题量</span></div>
    <div class="stat"><b>${nSingle}</b><span>单选题</span></div>
    <div class="stat"><b>${nMulti}</b><span>多选题</span></div>
    <div class="stat"><b>${chs.length}</b><span>章节</span></div>
  </div>
  <p style="margin:16px 0 0"><a class="btn" href="../index.html">开始刷「${esc(e.name)}」→</a><a class="btn ghost" href="../exams.html">返回目录</a></p>
</div>
<div class="card"><h2>考试与题库说明</h2><p>${esc(e.notice || '')}</p>
<p class="mut">考试时间：${esc(e.dateLabel || '以当年官方通知为准')}　|　科目：${(e.subjects || []).map(s => esc(s.name)).join('、')}</p></div>
<div class="card"><h2>章节目录（${chs.length} 章）</h2>
<table><thead><tr><th>章组</th><th>章节</th><th class="n">题量</th></tr></thead><tbody>${chHTML}</tbody></table></div>
<div class="card"><h2>全真模考规则</h2><ul>${mockLine || '<li>本包未配置模考</li>'}</ul>
<p class="mut">模考按题库随机组卷并计时，交卷后统一出分；答案不即时揭晓。</p></div>
<div class="card"><h2>怎么用</h2><ul>
<li>点上方「开始刷题」进入应用，在首页类目中选择本场考试。</li>
<li>可按章节顺序刷，也可一键乱序刷本科全部题目。</li>
<li>做错的题自动进入错题本，重做全对后移出。</li>
<li>进度保存在本机浏览器，换设备或清缓存会丢失。</li>
</ul></div>
`;
    const structured = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Course', name: `${e.name} 免费题库与模考`, description: `题舟 TiZhou 收录 ${e.name} 模拟题 ${qs.length} 道，含 ${chs.length} 个章节、章节练习、错题本与全真模考。`,
          url: `${BASE}exams/${e.id}.html`, inLanguage: 'zh-CN', isAccessibleForFree: true,
          provider: { '@type': 'Organization', name: '题舟 TiZhou', url: BASE } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: '考试目录', item: BASE + 'exams.html' },
          { '@type': 'ListItem', position: 2, name: e.name, item: `${BASE}exams/${e.id}.html` },
        ] },
      ],
    };
    writeFileSync(join(dir, `${e.id}.html`), layout({
      title: `${e.name} 题库 · ${qs.length} 题 · 题舟 TiZhou`,
      desc: `${e.name} 免费在线刷题：${qs.length} 道模拟题、${chs.length} 个章节，支持章节练习、错题本与全真模考，免登录。`,
      canonical: `${BASE}exams/${e.id}.html`, body, structured, prefix: '../',
    }), 'utf8');
    count++;
  }

  // ---- sitemap / robots ----
  const urls = ['', 'install.html', 'exams.html', ...exams.map(e => `exams/${e.id}.html`)];
  writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${BASE}${u}</loc><changefreq>weekly</changefreq><priority>${u === '' ? '1.0' : u === 'exams.html' ? '0.9' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`, 'utf8');
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`, 'utf8');

  return { count, totalQ, urls: urls.length };
}

// 单独运行：node gen-pages.mjs
if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, '/').endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const root = dirname(fileURLToPath(import.meta.url));
  const src = join(root, 'src');
  const exams = readdirSync(src).filter(f => /^exam\..+\.json$/.test(f)).sort()
    .map(f => JSON.parse(readFileSync(join(src, f), 'utf8'))).sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const banks = {};
  readdirSync(src).filter(f => /^bank_.*\.json$/.test(f)).sort().forEach(f => {
    JSON.parse(readFileSync(join(src, f), 'utf8')).forEach(q => { (banks[q.s] = banks[q.s] || []).push(q); });
  });
  const r = genPages({ exams, banks, root });
  console.log(`✓ 生成静态入口页 ${r.count} 个（含总览）· sitemap ${r.urls} 条 URL · 题库 ${r.totalQ} 题`);
}
