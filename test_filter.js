// 真实筛选模拟：构造 12 个筛选按钮，加载线上 app.js，模拟点击验证过滤结果
const https = require('https');
const vm = require('vm');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'verify/3.0' } }, (r) => {
      if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode));
      let d = ''; r.setEncoding('utf8');
      r.on('data', (c) => (d += c)); r.on('end', () => res(d));
    }).on('error', rej);
  });
}

function makeEl(tag) {
  const el = {
    tagName: tag, className: '', id: '', textContent: '', hidden: false, value: '',
    dataset: {}, style: {}, children: [], href: '', src: '', alt: '', type: '',
    width: 0, height: 0, loading: '', _l: {}, _classes: new Set(),
    classList: {
      add(c) { el._classes.add(c); },
      remove(c) { el._classes.delete(c); },
      toggle(c, on) { on ? el._classes.add(c) : el._classes.delete(c); },
      contains(c) { return el._classes.has(c); },
    },
    append(...k) { el.children.push(...k); },
    appendChild(k) { el.children.push(k); },
    setAttribute(k, v) { el[k] = v; },
    getAttribute(k) { return el[k]; },
    addEventListener(ev, fn) { (el._l[ev] = el._l[ev] || []).push(fn); },
    removeEventListener() {},
    click() { (el._l.click || []).forEach((fn) => fn({ target: el, closest: () => null })); },
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    onerror: null, select() {},
  };
  return el;
}

(async () => {
  const BASE = 'https://surge.loder.my';
  const indexHtml = await get(BASE + '/');
  const ver = (indexHtml.match(/app\.js\?v=([^"']+)/) || [])[1] || '';
  const appJs = await get(BASE + '/app.js' + (ver ? '?v=' + ver : ''));
  const catalog = JSON.parse(await get(BASE + '/catalog.json' + (ver ? '?v=' + ver : '')));
  console.log(`版本 ${ver}   catalog ${catalog.modules.length} 条\n`);
  const exp = (kind, cat) => catalog.modules.filter(m =>
    (kind === 'all' || m.kind === kind) && (cat === 'all' || m.category === cat)).length;

  const EXISTING = new Set(['#catalogGrid', '#emptyState', '#loadMore', '#moduleSearch',
                            '#resultsCount', '#totalModules', '.toast']);
  const store = {};
  const grid = makeEl('div'); store['#catalogGrid'] = grid;

  // 模拟 index.html 里 6 张精选卡
  const featuredCats = ['去广告', '去广告', '去广告', '去广告', '去广告', '分流规则'];
  for (const c of featuredCats) {
    const el = makeEl('article');
    el.className = 'catalog-card';
    el.dataset.category = c;
    el.dataset.kind = 'featured';
    el.dataset.search = '精选';
    grid.children.push(el);
  }

  // 构造筛选按钮
  const kindDefs = [['all', '全部'], ['featured', '精选'], ['surge', 'Surge 模块'], ['loon', 'Loon 插件']];
  const catDefs = [['all', '全部用途'], ['去广告', '去广告'], ['解锁', '解锁'],
                   ['功能增强', '功能增强'], ['工具脚本', '工具脚本'], ['分流规则', '分流规则'], ['其他', '其他']];
  const kindBtns = kindDefs.map(([v]) => { const b = makeEl('button'); b.dataset.kindFilter = v; b.className = v === 'all' ? 'active' : ''; return b; });
  const catBtns = catDefs.map(([v]) => { const b = makeEl('button'); b.dataset.categoryFilter = v; b.className = v === 'all' ? 'active' : ''; return b; });

  const document = {
    createElement: (t) => makeEl(t),
    querySelector: (sel) => EXISTING.has(sel) ? (store[sel] ||= makeEl('div')) : null,
    querySelectorAll: (sel) => {
      if (sel === '.catalog-card') return grid.children.slice();
      if (sel === '.catalog-card:not(.imported-card)') return grid.children.filter((c) => !c.className.includes('imported-card'));
      if (sel === '.import-link') return [];
      if (sel === '[data-kind-filter]') return kindBtns;
      if (sel === '[data-category-filter]') return catBtns;
      return [];
    },
    body: makeEl('body'), execCommand: () => true,
  };

  const sandbox = {
    document,
    window: { isSecureContext: true, location: { href: BASE + '/' } },
    navigator: { clipboard: null },
    console: { log() {}, error: console.error, warn() {} },
    setTimeout: () => 0, clearTimeout: () => {},
    encodeURIComponent, Promise, Math, JSON, Number, Array, Object, String,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(catalog) }),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(appJs, sandbox, { filename: 'app.js' });

  await new Promise((r) => setTimeout(r, 400));

  const results = store['#resultsCount'];
  const visibleCards = () => grid.children.filter((c) => !c.hidden);
  const countMatching = () => grid.children.filter((c) => c.dataset.match === '1').length;
  const countVisible = () => grid.children.filter((c) => !c.hidden).length;

  let pass = 0, fail = 0;
  const check = (label, cond, extra) => {
    if (cond) { pass++; console.log('  ✔ ' + label); }
    else { fail++; console.log('  ✘ ' + label + (extra ? '   ' + extra : '')); }
  };

  console.log('初始状态:');
  check(`全部 + 全部用途 = ${catalog.modules.length + 6}`, countMatching() === catalog.modules.length + 6, `实际 ${countMatching()}`);
  console.log(`   resultsCount: ${results.textContent}`);

  console.log('\n点击「去广告」:');
  catBtns.find((b) => b.dataset.categoryFilter === '去广告').click();
  const ad = countMatching();
  check('去广告 > 0', ad > 0, `实际 ${ad}`);
  check(`去广告 = ${exp('all','去广告')} 导入 + 5 精选`, ad === exp('all','去广告') + 5, `实际 ${ad}`);
  console.log(`   resultsCount: ${results.textContent}`);

  console.log('\n再点「Surge 模块」（与去广告叠加）:');
  kindBtns.find((b) => b.dataset.kindFilter === 'surge').click();
  const adSurge = countMatching();
  check(`Surge + 去广告 = ${exp('surge','去广告')}`, adSurge === exp('surge','去广告'), `实际 ${adSurge}`);

  console.log('\n再点「Loon 插件」:');
  kindBtns.find((b) => b.dataset.kindFilter === 'loon').click();
  const adLoon = countMatching();
  check(`Loon + 去广告 = ${exp('loon','去广告')}`, adLoon === exp('loon','去广告'), `实际 ${adLoon}`);

  console.log('\n切回「全部」平台，点「解锁」:');
  kindBtns.find((b) => b.dataset.kindFilter === 'all').click();
  catBtns.find((b) => b.dataset.categoryFilter === '解锁').click();
  const unlock = countMatching();
  check(`解锁 = ${exp('all','解锁')}`, unlock === exp('all','解锁'), `实际 ${unlock}`);

  console.log('\n点「精选」+「全部用途」:');
  catBtns.find((b) => b.dataset.categoryFilter === 'all').click();
  kindBtns.find((b) => b.dataset.kindFilter === 'featured').click();
  const feat = countMatching();
  check('精选 = 6', feat === 6, `实际 ${feat}`);

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('✘', e.message); process.exit(1); });
