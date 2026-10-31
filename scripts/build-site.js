const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'site-dist');
const buildId = (() => { try { return cp.execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch (_) { return 'local'; } })();
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const { transform } = require('lightningcss');

const tracked = cp.execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const excluded = /^(?:\.github\/|\.git\/|scripts\/|android-app\/|dist\/|site-dist\/|tmp-|qa-|finalqa-|valid-|sync-|walkthrough-|guide-)/i;
const binary = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.mp4', '.ico', '.woff', '.woff2', '.webmanifest']);
const htmlOptions = { collapseWhitespace: true, conservativeCollapse: true, removeComments: true, removeRedundantAttributes: true, useShortDoctype: true, keepClosingSlash: true, minifyCSS: true, minifyJS: false };

async function copyFile(rel) {
  if (excluded.test(rel)) return false;
  const source = path.join(root, rel);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return false;
  const ext = path.extname(rel).toLowerCase();
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (binary.has(ext)) fs.copyFileSync(source, dest);
  else if (ext === '.html') fs.writeFileSync(dest, await minifyHtml(fs.readFileSync(source, 'utf8'), htmlOptions));
  else if (ext === '.js') {
    const result = require('child_process').execFileSync(process.execPath, ['-e', `const {minify}=require('terser');minify(require('fs').readFileSync(${JSON.stringify(source)},'utf8'),{compress:{passes:2},mangle:false,format:{comments:false}}).then(r=>process.stdout.write(r.code||''))`], { cwd: root });
    fs.writeFileSync(dest, result);
    if (rel === 'sw.js') {
      const worker = fs.readFileSync(dest, 'utf8').replace(/(CACHE_VERSION\s*=\s*['"][^'"]+)(['"])/, `$1-${buildId}$2`);
      fs.writeFileSync(dest, worker);
    }
  } else if (ext === '.css') {
    const result = transform({ filename: rel, code: Buffer.from(fs.readFileSync(source)), minify: true });
    fs.writeFileSync(dest, result.code);
  } else fs.copyFileSync(source, dest);
  return true;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
async function main() {
  let copied = 0;
  for (const rel of tracked) if (await copyFile(rel)) copied += 1;
  const version = `mawahib-site-build=${new Date().toISOString()}\nsource-files=${copied}\n`;
  fs.writeFileSync(path.join(outDir, 'version.txt'), version);
  console.log(JSON.stringify({ output: 'site-dist', files: copied }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
