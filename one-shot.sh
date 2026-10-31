#!/usr/bin/env bash
# surge.loder.my 一次性部署 + 打开密码登录
#
# 用法（在服务器上用 root 跑）：
#   curl -fsSL https://raw.githubusercontent.com/ogbk666-prog/surge-site-data/main/one-shot.sh | bash
#
# 做的事：
#   1) 拉取 surge-site-data 到 /root/site
#   2) 部署模块文件与 catalog.json（自动备份旧的）
#   3) 打开 sshd 密码登录
#   4) 自检并打印结果
#
# 回滚密码登录：
#   sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
#   systemctl restart sshd
set -uo pipefail

REPO="https://github.com/ogbk666-prog/surge-site-data.git"
WORK="/root/site"

echo "=============================================="
echo " surge.loder.my 部署 + 开启 SSH 密码登录"
echo "=============================================="
[ "$(id -u)" = "0" ] || { echo "!! 必须用 root 跑"; exit 1; }

# ---------- 1. 取数据 ----------
echo
echo "[1/4] 拉取部署数据"
if [ -d "$WORK/.git" ]; then
  cd "$WORK" && git pull --ff-only 2>/dev/null || { rm -rf "$WORK"; git clone --depth 1 "$REPO" "$WORK"; }
else
  rm -rf "$WORK"
  git clone --depth 1 "$REPO" "$WORK" || { echo "!! 克隆失败，检查网络或改用 tar 包上传"; exit 1; }
fi
cd "$WORK" || exit 1
echo "     $(git log --oneline -1)"

# ---------- 2. 部署 ----------
echo
echo "[2/4] 部署模块目录"
if bash "$WORK/deploy.sh"; then
  echo "     部署成功"
else
  echo "!! deploy.sh 失败。手动找站点根目录："
  echo "   grep -rn 'surge.loder.my' /etc/caddy/ /etc/nginx/ 2>/dev/null"
  echo "   然后：bash $WORK/deploy.sh /正确的/站点根目录"
fi

# ---------- 3. 开密码登录 ----------
echo
echo "[3/4] 打开 sshd 密码登录"
SSHD_CONF=/etc/ssh/sshd_config
[ -f "$SSHD_CONF" ] || { echo "!! 找不到 $SSHD_CONF"; exit 1; }
cp "$SSHD_CONF" "$SSHD_CONF.bak.$(date +%Y%m%d%H%M%S)"

# 去掉已有行的注释并改值；没有则追加
if grep -qiE '^\s*#?\s*PasswordAuthentication' "$SSHD_CONF"; then
  sed -i -E 's/^\s*#?\s*PasswordAuthentication.*/PasswordAuthentication yes/I' "$SSHD_CONF"
else
  echo 'PasswordAuthentication yes' >> "$SSHD_CONF"
fi
if grep -qiE '^\s*#?\s*PermitRootLogin' "$SSHD_CONF"; then
  sed -i -E 's/^\s*#?\s*PermitRootLogin.*/PermitRootLogin yes/I' "$SSHD_CONF"
else
  echo 'PermitRootLogin yes' >> "$SSHD_CONF"
fi

# 有些发行版把配置拆到 sshd_config.d/
if [ -d /etc/ssh/sshd_config.d ]; then
  printf 'PasswordAuthentication yes\nPermitRootLogin yes\n' > /etc/ssh/sshd_config.d/99-password-login.conf
fi

# 重载
if systemctl list-units --type=service --all 2>/dev/null | grep -q 'sshd\.service'; then
  systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null || true
else
  systemctl restart ssh 2>/dev/null || service ssh restart 2>/dev/null || true
fi
sleep 1

# 实际生效值
EFF_PW=$(sshd -T 2>/dev/null | awk '/^passwordauthentication/{print $2}')
EFF_ROOT=$(sshd -T 2>/dev/null | awk '/^permitrootlogin/{print $2}')
echo "     PasswordAuthentication = ${EFF_PW:-未知}"
echo "     PermitRootLogin        = ${EFF_ROOT:-未知}"

# ---------- 4. 自检 ----------
echo
echo "[4/4] 自检"
SITE_HINT=$(grep -hoP '^\s*root\s+(?:\*\s+)?\K[^\s;{]+' /etc/caddy/Caddyfile 2>/dev/null | head -1 || true)
CAT=$(curl -s --max-time 10 https://surge.loder.my/catalog.json | grep -o '"name"' | wc -l)
echo "     catalog.json 条目数 = $CAT   （预期 243）"
echo "     本机模块文件数       = $(find /var/www -maxdepth 4 -type d -name imported 2>/dev/null | head -1 | xargs -r -I{} find {} -type f 2>/dev/null | wc -l)"
echo
echo "=============================================="
echo " 完成了。把上面这些输出发回来。"
echo
echo " 关掉密码登录（等对方接手后再跑）:"
echo "   sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config"
echo "   systemctl restart sshd"
echo "=============================================="
