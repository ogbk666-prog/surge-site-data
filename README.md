# surge-site-data

surge.loder.my 的自托管数据（Surge 模块 + Loon 插件）。

## 内容

| 目录/文件 | 说明 |
| --- | --- |
| `catalog.json` | 站点读取的目录，**1105 条**（每条带 `kind`: `surge` / `loon`） |
| `modules/imported/` | **1106 个文件**，9.4 MB |
| `deploy.sh` | 服务器一键部署 |
| `one-shot.sh` | 部署 + 开 SSH 密码登录 + 自检 |
| `app.js` | 前端逻辑（支持双协议导入） |

## 数据来源

| 来源 | 数量 | 类型 |
| --- | --- | --- |
| 某封闭xx（qingr.json） | 506 | `.sgmodule` |
| 重写库（deezertidal/QuantumultX-Rewrite） | 266 | `.conf` |
| 墨鱼手记（ddgksf2013/Rewrite） | 45 | `.conf` |
| 毒奶特供（limbopro/Adblock4limbo） | 10 | `.conf` / `.list` |
| iKeLee Loon（fkikelee 镜像） | 275 | `.lpx` |
| 红果广告过滤 | 2 | `.sgmodule` |
| 心悦俱乐部去广告（自研） | 1 | `.sgmodule` |
| **合计** | **1105** | |

## 双协议导入

`app.js` 按 `catalog.json` 里每条记录的 `kind` 自动选择：

```js
function importHref(kind, url) {
  return kind === 'loon'
    ? `loon://import?plugin=${encodeURIComponent(url)}`
    : `surge:///install-module?url=${encodeURIComponent(url)}`;
}
```

- `kind: "surge"` → 卡片标「Surge 模块」，按钮 `导入 Surge ↗`
- `kind: "loon"` → 卡片标「Loon 插件」，按钮 `导入 Loon ↗`

`ruleCount = 0` 的是纯脚本模块（没有域名拦截规则的 `[Script]` 类），卡片显示「脚本 / 配置类模块，导入后按需启用。」而不是「保留 0 条」。

## 部署

```bash
git clone https://github.com/ogbk666-prog/surge-site-data.git /root/site
bash /root/site/deploy.sh                 # 自动探测 Caddy 根目录
bash /root/site/deploy.sh /srv/surge-module-site   # 或手动指定
```

脚本会备份旧的 `modules/imported` 和 `catalog.json` 到 `/root/`，装完刷新 `app.js` 里 catalog 的缓存版本号。

## 版权

各模块版权归原作者所有（CC BY-NC-SA 4.0）。
