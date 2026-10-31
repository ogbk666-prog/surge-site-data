# surge-site-data

surge.loder.my 的自托管模块数据。

- `catalog.json` —— 网站读取的模块目录（243 条）
- `modules/imported/` —— 508 个模块文件（506 个来自 0x0021/ClashModule 全量镜像 + 2 个心悦模块）
- `deploy.sh` —— 服务器一键部署脚本

## 部署到服务器

```bash
# 上传后
bash deploy.sh                      # 自动探测 Caddy 站点根目录
bash deploy.sh /var/www/surge.loder.my   # 或手动指定
```

脚本会先备份旧的 `modules/imported` 和 `catalog.json` 到 `/root/`，再安装新数据。

## 数据来源

- 模块：`https://0x0021.github.io/ClashModule/` 的 `qingr.json` 快照（buildDate 2026-10-30 09:19，506 个）
- 心悦俱乐部增强版：本仓库作者自制

模块版权归原作者所有（CC BY-NC-SA 4.0）。
