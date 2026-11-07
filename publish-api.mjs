// 通过 GitHub Git Data API 一次性上传 git ls-files 列出的所有文件（git push 不通时的备用发布通道）
// 用法：node publish-api.mjs <owner> <repo> <branch> <commitMessage>
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [owner, repo, branch, message] = process.argv.slice(2);
if (!owner || !repo || !branch || !message) {
  console.error('用法: node publish-api.mjs <owner> <repo> <branch> <message>');
  process.exit(1);
}
const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
const api = 'https://api.github.com';
const H = {
  Authorization: `Bearer ${token}`,
  'User-Agent': 'tizhou-publish',
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github+json',
};
async function call(method, path, body) {
  const r = await fetch(api + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const files = execSync('git -c core.quotepath=false ls-files', { encoding: 'utf8' })
  .trim().split('\n').map(f => f.trim()).filter(Boolean);
console.log(`上传 ${files.length} 个文件到 ${owner}/${repo}@${branch} ...`);

const tree = [];
for (const f of files) {
  const b64 = readFileSync(f).toString('base64');
  const j = await call('POST', `/repos/${owner}/${repo}/git/blobs`, { content: b64, encoding: 'base64' });
  tree.push({ path: f, mode: '100644', type: 'blob', sha: j.sha });
  console.log('  ✓', f);
}

const t = await call('POST', `/repos/${owner}/${repo}/git/trees`, { tree });

let refExists = true, parentSha = null;
try {
  const ref = await call('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  parentSha = ref.object.sha;
} catch (e) { refExists = false; }

const c = await call('POST', `/repos/${owner}/${repo}/git/commits`, {
  message, tree: t.sha, parents: parentSha ? [parentSha] : [],
});
if (refExists) {
  await call('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: c.sha, force: true });
} else {
  await call('POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: c.sha });
}
console.log(`✓ ${branch} 已更新到提交 ${c.sha.slice(0, 7)}（${files.length} 个文件）`);
