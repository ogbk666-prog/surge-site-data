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

function importHref(kind, url) {
  return kind === 'loon'
    ? `loon://import?plugin=${encodeURIComponent(url)}`
    : `surge:///install-module?url=${encodeURIComponent(url)}`;
}

document.querySelectorAll('.import-link').forEach(link => {
  const url = link.dataset.moduleUrl;
  link.href = importHref(link.dataset.kind || 'surge', url);
});

document.querySelector('#catalogGrid').addEventListener('click', async event => {
  const button = event.target.closest('.copy-link');
  if (!button) return;
  try {
    await copyText(button.dataset.moduleUrl);
    announce('模块地址已复制');
  } catch {
    announce('复制失败，请打开源码页面手动复制地址');
  }
});

const searchInput = document.querySelector('#moduleSearch');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const catalogGrid = document.querySelector('#catalogGrid');
const resultsCount = document.querySelector('#resultsCount');
const emptyState = document.querySelector('#emptyState');
const loadMore = document.querySelector('#loadMore');
let activeFilter = 'all';
let displayLimit = 24;

function importedCard(module) {
  const kind = module.kind === 'loon' ? 'loon' : 'surge';
  const card = document.createElement('article');
  card.className = 'catalog-card imported-card';
  card.dataset.category = 'imported';
  card.dataset.search = `${module.name} ${module.ruleCount} ${kind === 'loon' ? 'Loon' : 'Surge'} 去广告 拦截`;
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
  for (const label of [kind === 'loon' ? 'Loon' : 'Surge', '广告拦截']) {
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

function updateCatalog() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visible = 0;
  document.querySelectorAll('.catalog-card').forEach(card => {
    const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
    const matchesSearch = card.dataset.search.toLocaleLowerCase().includes(query);
    const matches = matchesCategory && matchesSearch;
    card.hidden = !matches || visible >= displayLimit;
    if (matches) visible += 1;
  });
  resultsCount.textContent = `共 ${visible} 个模块`;
  emptyState.hidden = visible !== 0;
  loadMore.hidden = visible <= displayLimit;
}

searchInput.addEventListener('input', () => { displayLimit = 24; updateCatalog(); });
loadMore.addEventListener('click', () => { displayLimit += 24; updateCatalog(); });
filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    displayLimit = 24;
    filterButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    updateCatalog();
  });
});

fetch('catalog.json?v=DEV')
  .then(response => { if (!response.ok) throw new Error('catalog unavailable'); return response.json(); })
  .then(data => {
    const modules = Array.isArray(data.modules) ? data.modules.filter(module =>
      module.url?.startsWith('https://surge.loder.my/modules/imported/')) : [];
    catalogGrid.append(...modules.map(importedCard));
    document.querySelector('#importedCount').textContent = modules.length;
// 只统计扩展目录条目，不再硬编码 +6（那 6 个是 index.html 里的精选卡片）
    document.querySelector('#totalModules').textContent = String(modules.length);
    updateCatalog();
  })
  .catch(() => announce('扩展目录暂时无法加载'));

updateCatalog();
