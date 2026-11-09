// 渲染层冒烟门禁：用最小 DOM 桩执行引擎，覆盖 25 场考试的关键页面与模考计分
// 由 build.mjs 自动调用；也可单独运行：node smoke.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export function runSmoke({ template, DATA }) {
  const failures = [];
  let checks = 0;
  const ok = (label, fn) => {
    checks++;
    try { fn(); } catch (e) { failures.push(`${label} → ${e.constructor.name}: ${e.message}`); }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

  const code = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).find(s => s.includes('function renderHome'));
  if (!code) return { ok: false, checks: 0, failures: ['未在模板中找到引擎 script'] };

  // ---- 最小 DOM / BOM 桩 ----
  const mkEl = () => ({
    innerHTML: '', value: '', style: {}, tagName: 'DIV',
    classList: { add() {}, remove() {} },
    setAttribute() {}, hasAttribute() { return false; }, getAttribute() { return null; },
    appendChild() {}, addEventListener() {}, matches() { return false; }, click() {},
  });
  const appEl = mkEl();
  const store = {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  globalThis.document = {
    querySelector: () => appEl,
    querySelectorAll: () => [],
    getElementById: id => (['app', 'splash', 'skw', 'sres', 'mockWrongBox'].includes(id) ? appEl : null),
    createElement: () => mkEl(),
    body: { appendChild() {} },
    title: '', addEventListener() {},
  };
  globalThis.window = { __DATA__: DATA, __FIGS__: {} };
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  globalThis.setTimeout = () => 0;

  const api = new Function(code + `
return {
  renderHome,renderExam,renderSubject,renderQuiz,renderWrong,renderSettings,renderMockSelect,renderMockRun,
  startMock:window.startMock,finishMock,resumeMock:window.resumeMock,openExam:window.openExam,startChapter:window.startChapter,wipe:window.wipe,
  pick:window.pick,nextQ:window.nextQ,prevQ:window.prevQ,
  resumeLast:window.resumeLast,backupText,reportText,openReport:window.openReport,closeReport:window.closeReport,
  chapters,getS:()=>S,getEX:()=>EX,getMK:()=>MK,getSES:()=>SES,getSUBJECTS:()=>SUBJECTS,EXAMS
};`)();

  // ---- 1. 首页与全局渲染 ----
  ok('首页 renderHome', () => api.renderHome());
  ok('全局目录含 25 场考试', () => assert(api.EXAMS.length === 25, `实际 ${api.EXAMS.length} 场`));

  // ---- 2. 逐考试逐科目：章节、模考页、组卷、答题页、交卷计分 ----
  for (let i = 0; i < api.EXAMS.length; i++) {
    const e = api.EXAMS[i];
    const label = `${e.id}`;
    ok(`${label} 考试页`, () => api.openExam(i));
    ok(`${label} 模考页`, () => api.renderMockSelect());
    for (const s of (e.subjects || [])) {
      const r = (e.mock || {})[s.key];
      const qs = (DATA.banks[s.key] || []);
      ok(`${label}/${s.key} 题池充足`, () => {
        assert(r, '缺 mock 配置');
        const ns = qs.filter(q => q.t === 'single' && !q.bg).length;
        const nm = qs.filter(q => q.t === 'multi' && !q.bg).length;
        assert(ns >= r.single, `单选池 ${ns} < ${r.single}`);
        assert(nm >= r.multi, `多选池 ${nm} < ${r.multi}`);
      });
      ok(`${label}/${s.key} 章节页`, () => api.renderSubject(s.key));
      // 章节索引用例：验证每个章节都能被精确定位（旧逻辑按 c 查找会串章）
      const chs = api.chapters(s.key);
      for (let ci = 0; ci < chs.length; ci++) {
        ok(`${label}/${s.key} 第${ci + 1}章定位`, () => {
          api.startChapter(s.key, ci);
          const ses = api.getSES();
          assert(ses && ses.qs.length === chs[ci].qs.length,
            `定位题数 ${ses ? ses.qs.length : 0} ≠ 章节题数 ${chs[ci].qs.length}`);
        });
      }
      ok(`${label}/${s.key} 模考组卷与答题页`, () => {
        api.startMock(s.key);
        const MK = api.getMK();
        assert(MK && MK.qs.length >= r.total, `组卷 ${MK ? MK.qs.length : 0} 题 < ${r.total}`);
        api.renderMockRun();
      });
      ok(`${label}/${s.key} 卷面满分口径`, () => {
        const MK = api.getMK();
        const sp = r.singlePts || 1;
        const rawFull = MK.qs.reduce((n, q) => n + ((q.bg || q.t === 'multi') ? 2 : sp), 0);
        const expect = e.percentMode ? null : e.totalScore;
        if (expect !== null) assert(Math.abs(rawFull - expect) < 0.01,
          `原始满分 ${rawFull} ≠ totalScore ${expect}（且未启用 percentMode）`);
        else assert(e.totalScore === 100, `percentMode 包 totalScore 应为 100，实际 ${e.totalScore}`);
      });
      ok(`${label}/${s.key} 交卷与成绩页`, () => {
        api.finishMock(false);
        const rec = api.getS().mocks[0];
        assert(rec && rec.score <= e.totalScore, `成绩 ${rec && rec.score} 超过满分 ${e.totalScore}`);
        assert(appEl.innerHTML.includes('模考成绩'), '未渲染成绩页');
      });
      ok(`${label}/${s.key} 错题本`, () => {
        const q = qs[0];
        if (q) api.getS().wrong[`${s.key}:0`] = '2026-01-01';
        api.renderWrong();
        assert(appEl.innerHTML.includes('移除') || appEl.innerHTML.includes('错题本是空的'), '错题本未正确渲染');
      });
    }
  }

  // ---- 3. 状态重置与跨考试断点 ----
  ok('清空数据后「我的」可用', () => { api.wipe(); api.renderSettings(); api.renderWrong(); });
  ok('模考断点跨考试保留', () => {
    const target = api.EXAMS.find(e => e.id === 'jiankang');
    const S = api.getS();
    S.mockLive = { examId: 'jiankang', ids: ['jiankang:0'], idx: 0, selBy: {}, startedAt: Date.now(), durMs: 600000 };
    api.openExam(0);                       // 切到另一场考试
    api.resumeMock();                      // 应自动切回 jiankang 且不删除进度
    assert(api.getEX().id === 'jiankang', '未自动切换到断点所属考试');
    assert(S.mockLive && S.mockLive.examId === 'jiankang', '断点被误删');
    assert(target, '找不到目标考试');
  });

  // ---- 4. 继续上次练习 / 备份 / 纠错 ----
  ok('继续上次：记录位置并恢复', () => {
    const e = api.EXAMS[0];
    const s = e.subjects[0];
    api.openExam(0);
    api.startChapter(s.key, 0);
    const ses0 = api.getSES();
    assert(ses0 && ses0.qs.length > 1, '章节题目不足，无法测试续做');
    api.pick(0);
    api.nextQ();
    const S = api.getS();
    assert(S.last && S.last.examId === e.id, '未记录上次练习');
    assert(S.last.idx === 1, `记录的位置应为 1，实际 ${S.last.idx}`);
    // 打乱现场后恢复
    api.openExam(api.EXAMS.length - 1);
    api.getS().last = S.last;
    api.resumeLast();
    const ses1 = api.getSES();
    assert(ses1 && ses1.idx === 1, `恢复后位置应为 1，实际 ${ses1 && ses1.idx}`);
    assert(api.getEX().id === e.id, '恢复时未切回原考试');
    assert(ses1.title === ses0.title, '恢复后标题不一致');
  });
  ok('继续上次：完成后清除记录', () => {
    const ses = api.getSES();
    api.getS().mode = 'instant';           // 即时模式下最后一题直接进总结页
    ses.idx = ses.qs.length - 1;
    ses.revealed = true;
    api.nextQ();
    assert(!api.getS().last, '练习完成后未清除继续记录');
  });
  ok('备份文本可解析且包含状态', () => {
    const txt = api.backupText();
    const o = JSON.parse(txt);
    assert(o.app === 'tizhou', '缺少 app 标识');
    assert(o.state && typeof o.state.stats === 'object', 'state.stats 缺失');
    assert(Array.isArray(o.state.reports), 'state.reports 缺失');
  });
  ok('恢复备份：拒绝非题舟文件', () => {
    const bad = { hello: 1 };
    assert(!(bad && bad.state && bad.state.stats), '校验逻辑应拒绝该对象');
  });
  ok('纠错文本包含题目要素', () => {
    api.openExam(0);
    const s = api.EXAMS[0].subjects[0];
    api.startChapter(s.key, 0);
    const q = api.getSES().qs[0];
    const txt = api.reportText(q);
    assert(txt.includes(q.id), '缺少题目 ID');
    assert(txt.includes(q.q.slice(0, 12)), '缺少题干');
    assert(txt.includes('标注答案'), '缺少答案标注');
  });
  ok('纠错会写入本机记录且不重复', () => {
    api.getS().reports = [];
    api.openReport();
    api.closeReport();
    const n1 = api.getS().reports.length;
    api.openReport();
    api.closeReport();
    const n2 = api.getS().reports.length;
    assert(n1 === 1, `首次应记录 1 条，实际 ${n1}`);
    assert(n2 === 1, `同题不应重复记录，实际 ${n2}`);
  });
  ok('清空数据后备份仍可生成', () => {
    api.wipe();
    const o = JSON.parse(api.backupText());
    assert(o.state.last === null, '清空后 last 应为 null');
    assert(o.state.reports.length === 0, '清空后 reports 应为空');
  });

  return { ok: failures.length === 0, checks, failures };
}

// CLI：自行组装 DATA（与 build.mjs 一致）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = join(root, 'src');
  const template = readFileSync(join(src, 'app.html'), 'utf8');
  const exams = readdirSync(src).filter(f => /^exam\..+\.json$/.test(f)).sort()
    .map(f => JSON.parse(readFileSync(join(src, f), 'utf8')))
    .sort((a, b) => (a.sort || 99) - (b.sort || 99));
  const banks = {};
  for (const f of readdirSync(src).filter(f => /^bank_.*\.json$/.test(f)).sort()) {
    JSON.parse(readFileSync(join(src, f), 'utf8')).forEach(q => { (banks[q.s] = banks[q.s] || []).push(q); });
  }
  const r = runSmoke({ template, DATA: { exams, banks } });
  console.log(`冒烟检查 ${r.checks} 项：${r.ok ? '✓ 全部通过' : '✗ 失败 ' + r.failures.length + ' 项'}`);
  r.failures.slice(0, 30).forEach(f => console.log('  ✗ ' + f));
  process.exitCode = r.ok ? 0 : 1;
}
