# 构建与打包部署

## 1. 开发期运行

```bash
npm run build        # 编译 TS → bin/js/bundle.js
npx serve -l 8000    # 以项目根目录为站点根
# 访问 http://localhost:8000/bin/
```

## 2. 一键打包（`npm run package`）

产物目录 `dist/`：

```
dist/
├── index.html            静态站入口（引擎独立文件，可部署/局域网访问）
├── game-standalone.html  单文件版（引擎全部内联，双击即玩）
├── js/bundle.js          游戏代码
└── engine/*.js           引擎库（laya.core / webgl_2D / ui）
```

> 单文件版通过 `file://` 协议直接双击即可运行，**纯本地、零服务器**。
> 打包脚本见 `tools/package.js`。

## 3. 纯本地模式说明

游戏本身**无任何网络请求**：

- 逻辑全部在浏览器内（LayaAir 引擎 + 游戏代码）
- 存档用 `localStorage`（本地持久化）
- 美术资源为代码绘制（后续图片也是本地文件）

之前需要服务器的**唯一原因**是 `bin/index.html` 用 `../engine/...` 跨目录相对路径，
`file://` 协议下加载受限。打包脚本已解决：`game-standalone.html` 将引擎内联，
双击即可游玩。

## 4. 手机端运行方式

| 方式 | 操作 | 场景 |
|------|------|------|
| 局域网直连 | 同 WiFi，`npx serve -l 8000 dist`，手机访问 `http://电脑IP:8000` | 开发调试 |
| 静态托管 | `dist/` 上传 GitHub Pages / CloudBase / EdgeOne Pages | 发给朋友试玩 |
| Android APK | Capacitor 打包（见下） | 正式安装 |

## 5. Android APK 打包

使用 Capacitor 把 `dist/` 包成原生 Android WebView 应用（纯本地加载，无服务器）。

### 5.1 环境要求

- Node.js（已有）
- **Java JDK 17+**（需安装）
- **Android SDK**（安装 Android Studio 会一并提供）

### 5.2 工程结构

```
android/                      Capacitor 原生工程
├── app/src/main/assets/public/  游戏资源（cap sync 自动同步）
└── app/src/main/AndroidManifest.xml
capacitor.config.ts          appId=com.wuxia.textgame, webDir=dist
```

### 5.3 打包流程

```bash
npm run apk:sync     # 打包 Web → 同步进 Android 工程
npm run apk:build    # gradlew assembleDebug 编译出 APK
```

产出：`android/app/build/outputs/apk/debug/app-debug.apk`，
传到手机安装（需开启"允许安装未知来源"）。

### 5.4 分发合规说明

| 途径 | 版号要求 | 可行性 |
|------|---------|--------|
| 安卓侧载 APK（直接发文件） | 不需要 | ✅ 可行 |
| 国内安卓应用商店上架 | 需要版号+软著 | ❌ |
| App Store（中国区） | 需要版号 | ❌ |
| Google Play | 不需要中国版号（$25 开发者账号） | ✅ 但国内访问受限 |

**结论**：无版号时，安卓侧载 APK 是唯一可"正式安装游玩"的免费路径。
