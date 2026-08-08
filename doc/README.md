# 武侠文字游戏 —— 技术文档索引

本目录沉淀该项目的技术设计、构建部署与扩展方案，供后续开发与交接查阅。

## 文档列表

| 文档 | 内容 |
|------|------|
| [架构设计](./ARCHITECTURE.md) | 四大框架（主角/剧情/战斗/养成）、目录结构、模块解耦、交互设计 |
| [构建与打包](./PACKAGING.md) | 编译、静态站、单文件版、Android APK、纯本地模式说明 |
| [后端通信](./BACKEND.md) | 从纯本地改造成后端通信的方案、网络层代码、服务端示例 |
| [美术资源接入](./ART.md) | 后续引入美术资源的三种路径与落地顺序 |

## 快速上手

```bash
npm install          # 安装依赖
npm run build        # 编译 TypeScript 到 bin/js/bundle.js
npx serve -l 8000    # 启动静态服务器（必须以项目根目录为站点根）
# 浏览器打开 http://localhost:8000/bin/
```

> 注意：`bin/index.html` 通过 `../engine/...` 相对路径引用引擎库，
> 服务器必须以**项目根目录**为站点根，并通过 `/bin/` 访问游戏。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run build` | 编译 TS |
| `npm run package` | 打包到 `dist/`（静态站 + 单文件版） |
| `npm run apk:sync` | 打包并同步到 Android 工程 |
| `npm run apk:build` | 编译出 APK |
| `npm run server` | 启动后端服务（含剧情 API + 静态托管） |
| `npm start` | 启动静态服务器 |
