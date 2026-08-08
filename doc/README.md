# 武侠文字游戏 —— 技术文档索引

本目录沉淀该项目的技术设计、构建部署与扩展方案，供后续开发与交接查阅。

## 文档列表

| 文档 | 内容 |
|------|------|
| [逐文件说明（开发手册）](./FILE_GUIDE.md) | ★ 每个源码/配置文件的作用、关键 API、修改入口；人工介入开发先看这篇 |
| [美术资源接入教程](./ART_TUTORIAL.md) | ★ 黑底换背景图、加立绘/形象图、按钮换图的具体改法 |
| [架构设计](./ARCHITECTURE.md) | 四大框架（主角/剧情/战斗/养成）、目录结构、模块解耦、交互设计 |
| [构建与打包](./PACKAGING.md) | 编译、静态站、单文件版、Android APK、纯本地模式说明 |
| [后端通信](./BACKEND.md) | 从纯本地改造成后端通信的方案、网络层代码、服务端示例 |
| [美术资源接入（旧版方案）](./ART.md) | 早期美术接入路径规划（实现细节以 ART_TUTORIAL.md 为准） |

## 快速上手（当前运行方式）

本项目通过 **LayaAir IDE** 编译运行（不再依赖 tsc 直出 bundle）：

1. 用 LayaAir IDE 打开工程（`WuXiaoTextGame.laya`）。
2. 确认 `settings/CompilerSettings.json` 的 `entries` 已包含 `src/` 下全部 11 个 ts 文件（首次克隆后 IDE 会自动生成 `.meta`，若缺失需重启 IDE 重新生成）。
3. 点“运行”：IDE 用 esbuild 把 `src/` 编译为 `bin/js/bundles/bundle.js`，调试服务器 `http://localhost:18090/`（根目录 = `bin/`）对外提供页面。
4. 浏览器打开 `http://localhost:18090/` 即可游玩。

> 说明：
> - 引擎库经 `bin/libs` 符号链接（→ `../engine/LayaAir/build/libs`）引用，`bin/index.html` 里写的是 `libs/...`。Windows 克隆后需手动 `mklink`。
> - `npm run build` 仅做 tsc 类型检查（输出到 `bin/js/modules/`），IDE 运行不读它。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run build` | tsc 类型检查（本地验证，IDE 运行不读其结果） |
| `npm run server` | 启动后端服务（含剧情 API + 静态托管） |
| `npm start` | 启动静态服务器（传统方式，非 IDE 链路） |
| `npm run package` | 打包到 `dist/`（⚠️ 脚本仍假设旧 bundle 路径，需按 FILE_GUIDE §5 适配） |
| `npm run apk:sync` / `apk:build` | Android 打包（Capacitor，需先适配 bundle 路径） |
