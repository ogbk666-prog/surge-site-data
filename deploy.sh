#!/usr/bin/env bash
# surge.loder.my 模块目录部署脚本
# 用法：把本目录整个上传到服务器，然后
#   bash deploy.sh            # 自动探测 Caddy 站点根目录
#   bash deploy.sh /var/www/surge.loder.my   # 或手动指定
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="${1:-}"

if [ -z "$SITE" ]; then
  echo "[*] 自动探测 Caddy 站点根目录…"
  if [ -f /etc/caddy/Caddyfile ]; then
    # 取第一个 root 指令
    SITE=$(grep -hoP '^\s*root\s+\K[^\s;]+' /etc/caddy/Caddyfile | head -1 || true)
  fi
  if [ -z "$SITE" ] && [ -f /etc/nginx/sites-enabled/default ]; then
    SITE=$(grep -hoP '^\s*root\s+\K[^\s;]+' /etc/nginx/sites-enabled/* 2>/dev/null | head -1 || true)
  fi
  if [ -z "$SITE" ]; then
    echo "!! 没探测到站点根目录，请手动指定：bash deploy.sh /path/to/site"; exit 1
  fi
fi

echo "[*] 站点根目录: $SITE"
if [ ! -d "$SITE" ]; then echo "!! 目录不存在: $SITE"; exit 1; fi
[ "$(id -u)" = "0" ] || { echo "!! 需要 root"; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$SITE/modules"
if [ -d "$SITE/modules/imported" ]; then
  echo "[*] 备份旧模块目录 -> /root/imported-$STAMP.tar.gz"
  tar -czf "/root/imported-$STAMP.tar.gz" -C "$SITE/modules" imported || true
fi
if [ -f "$SITE/catalog.json" ]; then
  cp "$SITE/catalog.json" "/root/catalog-$STAMP.json" || true
fi

echo "[*] 安装模块文件"
rm -rf "$SITE/modules/imported"
mkdir -p "$SITE/modules/imported"
cp -a "$HERE/modules/imported/." "$SITE/modules/imported/"

echo "[*] 安装 catalog.json"
cp "$HERE/catalog.json" "$SITE/catalog.json"

echo "[*] 修权限"
chown -R "$(stat -c %U "$SITE"):$(stat -c %G "$SITE")" "$SITE/modules" "$SITE/catalog.json" || true
chmod -R a+r "$SITE/modules"

COUNT=$(find "$SITE/modules/imported" -type f | wc -l)
echo "[*] 完成：$COUNT 个模块文件"
echo
echo "验证："
echo "  curl -sI https://surge.loder.my/catalog.json | head -1"
echo "  curl -s  https://surge.loder.my/catalog.json | head -c 200"
echo
echo "回滚："
echo "  tar -xzf /root/imported-$STAMP.tar.gz -C $SITE/modules"
echo "  cp /root/catalog-$STAMP.json $SITE/catalog.json"
