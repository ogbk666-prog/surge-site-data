#!/usr/bin/env bash
# surge.loder.my 模块目录部署脚本
#
# 用法（把本目录整个放到服务器上，或在服务器上 git clone 后跑）：
#   bash deploy.sh                             # 自动探测站点根目录
#   bash deploy.sh /var/www/surge.loder.my     # 手动指定
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="${1:-}"

detect_site() {
  local f
  # Caddy：root 指令，兼容 "root * /path" 和 "root /path" 两种写法
  for f in /etc/caddy/Caddyfile /etc/caddy/Caddyfile.d/*.caddy; do
    [ -f "$f" ] || continue
    grep -hoP '^\s*root\s+(?:\*\s+)?\K[^\s;{]+' "$f" 2>/dev/null | head -1 && return 0
  done
  # Caddy 的 JSON 配置
  for f in /etc/caddy/caddy.json /etc/caddy/autosave.json; do
    [ -f "$f" ] || continue
    grep -oP '"root"\s*:\s*"\K[^"]+' "$f" 2>/dev/null | head -1 && return 0
  done
  # nginx
  grep -rhoP '^\s*root\s+\K[^\s;]+' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | head -1 && return 0
  # 常见目录兜底
  for f in /var/www/surge.loder.my /var/www/surge /var/www/html /srv/surge /data/surge; do
    [ -f "$f/catalog.json" ] && echo "$f" && return 0
  done
  return 1
}

if [ -z "$SITE" ]; then
  echo "[*] 自动探测站点根目录…"
  if ! SITE="$(detect_site)"; then
    echo "!! 探测不到站点根目录。请手动指定：bash deploy.sh /path/to/site"
    echo "   找的方法：grep -rn 'surge.loder.my' /etc/caddy/ /etc/nginx/ 2>/dev/null"
    exit 1
  fi
fi

echo "[*] 站点根目录: $SITE"
[ -d "$SITE" ] || { echo "!! 目录不存在: $SITE"; exit 1; }
[ "$(id -u)" = "0" ] || { echo "!! 需要 root 权限"; exit 1; }

# 备份
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SITE/modules"
if [ -d "$SITE/modules/imported" ]; then
  echo "[*] 备份旧模块目录 -> /root/imported-$STAMP.tar.gz"
  tar -czf "/root/imported-$STAMP.tar.gz" -C "$SITE/modules" imported || true
fi
if [ -f "$SITE/catalog.json" ]; then
  cp "$SITE/catalog.json" "/root/catalog-$STAMP.json" || true
  echo "[*] 备份旧 catalog -> /root/catalog-$STAMP.json"
fi

# 安装
echo "[*] 安装模块文件"
rm -rf "$SITE/modules/imported"
mkdir -p "$SITE/modules/imported"
cp -a "$HERE/modules/imported/." "$SITE/modules/imported/"

echo "[*] 安装 catalog.json"
cp "$HERE/catalog.json" "$SITE/catalog.json"

# 若包内自带 app.js（放宽了 ruleCount 过滤），一并覆盖
if [ -f "$HERE/app.js" ]; then
  echo "[*] 覆盖 app.js（包内自带）"
  cp "$HERE/app.js" "$SITE/app.js"
fi

# 刷新版本号，避免浏览器 / Cloudflare 命中旧缓存
TS=$(date +%Y%m%d%H%M)
if [ -f "$SITE/app.js" ]; then
  sed -i -E "s#catalog\.json\?v=[A-Za-z0-9._%-]+#catalog.json?v=$TS#g" "$SITE/app.js" || true
fi
if [ -f "$SITE/index.html" ]; then
  sed -i -E "s#(app\.js|style\.css)\?v=[A-Za-z0-9._%-]+#\1?v=$TS#g" "$SITE/index.html" || true
fi
echo "[*] 缓存版本号 -> $TS"

# 权限
chown -R "$(stat -c %U "$SITE"):$(stat -c %G "$SITE")" "$SITE/modules" "$SITE/catalog.json" 2>/dev/null || true
chmod -R a+r "$SITE/modules" "$SITE/catalog.json" 2>/dev/null || true

COUNT=$(find "$SITE/modules/imported" -type f | wc -l)
echo
echo "[+] 完成：$COUNT 个模块文件，catalog 已更新"
echo
echo "验证："
echo "  curl -sI https://surge.loder.my/catalog.json | head -1"
echo "  curl -s  https://surge.loder.my/catalog.json | grep -o '\"name\"' | wc -l"
echo "  curl -sI 'https://surge.loder.my/modules/imported/%E5%A4%B8%E5%85%8B%E5%8E%BB%E5%B9%BF%E5%91%8A.sgmodule' | head -1"
echo
echo "回滚："
echo "  tar -xzf /root/imported-$STAMP.tar.gz -C $SITE/modules"
echo "  cp /root/catalog-$STAMP.json $SITE/catalog.json"
