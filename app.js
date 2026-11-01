const toast = document.querySelector('.toast');
let toastTimer;

function announce(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  input.remove();
  if (!ok) throw new Error('copy failed');
}

// 按平台选导入协议：Surge 用 surge:///install-module，Loon 用 loon://import
function importHref(kind, url) {
  return kind === 'loon'
    ? `loon://import?plugin=${encodeURIComponent(url)}`
    : `surge:///install-module?url=${encodeURIComponent(url)}`;
}

document.querySelectorAll('.import-link').forEach(link => {
  const url = link.dataset.moduleUrl;
  link.href = importHref(link.dataset.kind || 'surge', url);
});

// 首页 6 张精选卡片不属于扩展目录，单独归到 featured
document.querySelectorAll('.catalog-card:not(.imported-card)').forEach(card => {
  card.dataset.kind = card.dataset.kind || 'featured';
  card.dataset.category = card.dataset.category || 'featured';
});

const searchInput = document.querySelector('#moduleSearch');
const catalogGrid = document.querySelector('#catalogGrid');
const resultsCount = document.querySelector('#resultsCount');
const emptyState = document.querySelector('#emptyState');
const loadMore = document.querySelector('#loadMore');
const kindButtons = [...document.querySelectorAll('[data-kind-filter]')];
const categoryButtons = [...document.querySelectorAll('[data-category-filter]')];

let activeKind = 'all';
let activeCategory = 'all';
let displayLimit = 24;

const CATEGORY_LABEL = {
  '去广告': '去广告',
  '解锁': '解锁',
  '功能增强': '功能增强',
  '工具脚本': '工具脚本',
  '分流规则': '分流规则',
  '其他': '其他',
};

function importedCard(module) {
  const kind = module.kind === 'loon' ? 'loon' : 'surge';
  const category = CATEGORY_LABEL[module.category] || '其他';
  const card = document.createElement('article');
  card.className = 'catalog-card imported-card';
  card.dataset.kind = kind;
  card.dataset.category = category;
  card.dataset.search = `${module.name} ${module.ruleCount} ${kind === 'loon' ? 'Loon' : 'Surge'} ${category} 去广告 拦截 广告 ${module.desc || ''}`;

  const top = document.createElement('div');
  top.className = 'catalog-card-top';
  const icon = document.createElement('img');
  icon.className = 'app-icon';
  icon.src = module.icon?.startsWith('https://') ? module.icon : 'favicon.svg';
  icon.onerror = () => { icon.onerror = null; icon.src = 'favicon.svg'; };
  icon.alt = '';
  icon.width = icon.height = 53;
  icon.loading = 'lazy';
  const type = document.createElement('span');
  type.className = 'catalog-type';
  type.textContent = kind === 'loon' ? 'Loon 插件' : 'Surge 模块';
  top.append(icon, type);

  const title = document.createElement('h3');
  title.textContent = module.name;

  const description = document.createElement('p');
  description.className = 'catalog-description';
  description.textContent = module.ruleCount > 0
    ? `保留 ${module.ruleCount} 条广告请求拦截规则。`
    : '脚本 / 配置类模块，导入后按需启用。';

  const tags = document.createElement('div');
  tags.className = 'catalog-tags';
  for (const label of [category, kind === 'loon' ? 'Loon' : 'Surge']) {
    const tag = document.createElement('span');
    tag.textContent = label;
    tags.append(tag);
  }

  const actions = document.createElement('div');
  actions.className = 'catalog-actions';
  const install = document.createElement('a');
  install.className = 'button button-dark import-link';
  install.href = importHref(kind, module.url);
  install.textContent = kind === 'loon' ? '导入 Loon ↗' : '导入 Surge ↗';
  install.dataset.kind = kind;
  const copy = document.createElement('button');
  copy.className = 'text-button copy-link';
  copy.type = 'button';
  copy.dataset.moduleUrl = module.url;
  copy.textContent = '复制地址 ⧉';
  actions.append(install, copy);
  card.append(top, title, description, tags, actions);
  return card;
}

catalogGrid.addEventListener('click', async event => {
  const button = event.target.closest('.copy-link');
  if (!button) return;
  try {
    await copyText(button.dataset.moduleUrl);
    announce('模块地址已复制');
  } catch {
    announce('复制失败，请打开源码页面手动复制地址');
  }
});

function updateCatalog() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visible = 0;
  document.querySelectorAll('.catalog-card').forEach(card => {
    const kindOk = activeKind === 'all' || card.dataset.kind === activeKind;
    const catOk = activeCategory === 'all' || card.dataset.category === activeCategory;
    const searchOk = !query || (card.dataset.search || '').toLocaleLowerCase().includes(query);
    const matches = kindOk && catOk && searchOk;
    card.hidden = !matches || visible >= displayLimit;
    if (matches) visible += 1;
  });
  resultsCount.textContent = `共 ${visible} 个模块`;
  if (emptyState) emptyState.hidden = visible !== 0;
  if (loadMore) loadMore.hidden = visible <= displayLimit;
}

function bindFilterGroup(buttons, apply) {
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      apply(button);
      displayLimit = 24;
      buttons.forEach(item => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      updateCatalog();
    });
  });
}

bindFilterGroup(kindButtons, (btn) => { activeKind = btn.dataset.kindFilter; });
bindFilterGroup(categoryButtons, (btn) => { activeCategory = btn.dataset.categoryFilter; });

searchInput.addEventListener('input', () => { displayLimit = 24; updateCatalog(); });
loadMore.addEventListener('click', () => { displayLimit += 24; updateCatalog(); });

// 把各分类数量回填到筛选按钮上
function fillCounts(modules) {
  const kindCount = { surge: 0, loon: 0 };
  const catCount = {};
  for (const m of modules) {
    const k = m.kind === 'loon' ? 'loon' : 'surge';
    kindCount[k] += 1;
    const c = CATEGORY_LABEL[m.category] || '其他';
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const featured = document.querySelectorAll('.catalog-card:not(.imported-card)').length;

  const setCount = (key, value) => {
    const el = document.querySelector(`[data-count="${key}"]`);
    if (el) el.textContent = String(value);
  };
  setCount('all', modules.length + featured);
  setCount('featured', featured);
  setCount('surge', kindCount.surge);
  setCount('loon', kindCount.loon);
  setCount('cat-all', modules.length);
  for (const [name, n] of Object.entries(catCount)) {
    setCount('cat-' + name, n);
  }
}

fetch('catalog.json?v=DEV')
  .then(response => { if (!response.ok) throw new Error('catalog unavailable'); return response.json(); })
  .then(data => {
    const modules = Array.isArray(data.modules) ? data.modules.filter(module =>
      module.url?.startsWith('https://surge.loder.my/modules/imported/')) : [];
    catalogGrid.append(...modules.map(importedCard));
    document.querySelector('#importedCount').textContent = modules.length;
    // 只统计扩展目录条目，不再硬编码 +6（那 6 个是 index.html 里的精选卡片）
    document.querySelector('#totalModules').textContent = String(modules.length);
    fillCounts(modules);
    updateCatalog();
  })
  .catch(() => announce('扩展目录暂时无法加载'));

updateCatalog();
