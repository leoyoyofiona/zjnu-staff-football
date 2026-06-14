# 浙师大教工约球

一个轻量的教工约球系统。它保留 macOS 桌面 App，同时增加了可部署到公网的 Web 模式：访客只能查看数据，管理员登录后才能编辑。

## 功能

- 活动管理：日期、地点、2队/3队、球衣颜色、备注。
- 接龙导入：粘贴“1. 张三 / 2、李四 守门”格式文本，自动解析姓名、备注和重复报名。
- 名册匹配：维护标准姓名和微信别名，未匹配报名可自动加入名册。
- 随机分队：2队/3队人数均衡，三队赛支持指定队长后随机分配其他队员。
- 赛后录入：按场录入比分、进球、助攻、扑救、黄牌、红牌、裁判、边裁。
- 统计导出：生成活动战报 PNG 和自然年年度统计 PNG。
- 权限控制：公网 Web 访客只读，管理员账号可编辑。
- 数据保存：Tauri 环境使用 SQLite；公网 Web 使用服务端数据文件；纯 Vite 预览降级使用 localStorage。

## 开发

```bash
npm install --ignore-scripts
npm run dev
```

开发预览地址：

```text
http://127.0.0.1:1420/
```

## Web 服务本地运行

```bash
cp .env.example .env
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 npm run dev:web
```

本地 Web 服务地址：

```text
http://127.0.0.1:3000/
```

本地未设置 `ADMIN_PASSWORD` 时，开发模式默认密码是 `admin123`。生产环境必须设置 `ADMIN_PASSWORD`。

## Render 部署

仓库根目录已包含 `render.yaml`。推荐用 Render Blueprint 部署：

- Build Command: `npm ci --ignore-scripts && npm run build`
- Start Command: `npm run start`
- `ADMIN_USERNAME`: 默认 `admin`
- `ADMIN_PASSWORD`: 在 Render 后台设置，不要写进代码仓库
- `DATA_FILE`: `/var/data/football-state.json`
- Disk: 挂载到 `/var/data`，至少 1GB

注意：如果不挂 Render persistent disk，服务重启后服务器文件可能丢失。当前实现适合单实例部署；一个管理员写入、所有队员只读访问。

## 校验

```bash
npm test
npm run lint
npm run build
```

## macOS 打包

```bash
npm run tauri:build
```

构建产物：

- `src-tauri/target/release/bundle/macos/浙师大教工约球.app`
- `src-tauri/target/release/bundle/dmg/浙师大教工约球_0.1.0_aarch64.dmg`
