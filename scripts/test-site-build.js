const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'site-dist');
const required = ['index.html', 'login.html', 'dashboard.html', 'dashboard_prof.html', 'admin.html', 'sw.js', 'auth.js', 'registry.js'];
const missing = required.filter(file => !fs.existsSync(path.join(dist, file)));
if (missing.length) throw new Error(`Missing build files: ${missing.join(', ')}`);
const html = fs.readdirSync(dist).filter(file => file.endsWith('.html'));
const broken = [];
for (const file of html) {
  const source = fs.readFileSync(path.join(dist, file), 'utf8');
  for (const match of source.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)) {
    const target = match[1];
    if (target.includes('${') || /^(?:https?:|data:|mailto:|tel:|javascript:|\/)/i.test(target)) continue;
    if (!fs.existsSync(path.join(dist, target))) broken.push(`${file}:${target}`);
  }
}
if (broken.length) throw new Error(`Broken build references: ${broken.slice(0, 20).join(', ')}`);
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
if (!/CACHE_VERSION/.test(sw)) throw new Error('Service worker lost CACHE_VERSION');
if (!/CACHE_VERSION\s*=\s*['"][^'"]+-[0-9a-f]+['"]/.test(sw)) throw new Error('Service worker cache version was not build-stamped');
console.log(JSON.stringify({ ok: true, html: html.length, brokenReferences: 0, cacheVersionStamped: true }));
