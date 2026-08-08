/**
 * 一键打包脚本
 * 用法: npm run package
 *
 * 产物 dist/
 * ├── index.html          自包含静态站（引擎独立成文件，可部署/局域网访问）
 * ├── game-standalone.html 单文件版（引擎全部内联，双击即玩，纯本地无服务器）
 * ├── js/bundle.js        游戏代码
 * └── engine/*.js         引擎库
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BIN = path.join(ROOT, 'bin');
const ENGINE_LIBS = path.join(ROOT, 'engine', 'LayaAir', 'build', 'libs');

const LIBS = ['laya.core.js', 'laya.webgl_2D.js', 'laya.ui.js'];

function rmDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** 生成普通版 index.html（引擎独立文件） */
function makeIndexHtml() {
    return [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<head>',
        '    <meta charset="utf-8" />',
        '    <meta name="viewport" content="width=device-width,initial-scale=1" />',
        '    <title>武侠文字游戏</title>',
        '    <style>',
        '        body { margin: 0; background: #000; }',
        '    </style>',
        '</head>',
        '<body>',
        '    <script src="engine/laya.core.js"></script>',
        '    <script src="engine/laya.webgl_2D.js"></script>',
        '    <script src="engine/laya.ui.js"></script>',
        '    <script src="js/bundle.js"></script>',
        '</body>',
        '</html>',
        ''
    ].join('\n');
}

/** 生成单文件版（所有 JS 内联，file:// 双击即可运行） */
function makeStandaloneHtml() {
    const head = [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<head>',
        '    <meta charset="utf-8" />',
        '    <meta name="viewport" content="width=device-width,initial-scale=1" />',
        '    <title>武侠文字游戏（单文件版）</title>',
        '    <style>',
        '        body { margin: 0; background: #000; }',
        '    </style>',
        '</head>',
        '<body>',
        ''
    ].join('\n');
    const foot = '</body>\n</html>\n';
    const inline = LIBS.map((lib) => {
        const code = fs.readFileSync(path.join(ENGINE_LIBS, lib), 'utf8');
        return '<script>\n' + code + '\n</script>';
    }).join('\n');
    const game = '<script>\n' + fs.readFileSync(path.join(BIN, 'js', 'bundle.js'), 'utf8') + '\n</script>';
    return head + inline + '\n' + game + '\n' + foot;
}

function main() {
    // 1. 先编译 TypeScript
    console.log('> 编译 TypeScript ...');
    execSync('npx tsc', { cwd: ROOT, stdio: 'inherit' });

    // 2. 重建 dist/
    rmDir(DIST);
    fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
    fs.mkdirSync(path.join(DIST, 'engine'), { recursive: true });

    // 3. 复制游戏代码
    fs.copyFileSync(path.join(BIN, 'js', 'bundle.js'), path.join(DIST, 'js', 'bundle.js'));

    // 4. 复制引擎库
    let engineTotal = 0;
    for (const lib of LIBS) {
        const src = path.join(ENGINE_LIBS, lib);
        if (!fs.existsSync(src)) {
            console.error('缺少引擎库: ' + src);
            process.exit(1);
        }
        const stat = fs.statSync(src);
        engineTotal += stat.size;
        fs.copyFileSync(src, path.join(DIST, 'engine', lib));
    }

    // 5. 生成两个入口
    fs.writeFileSync(path.join(DIST, 'index.html'), makeIndexHtml());
    const standalone = makeStandaloneHtml();
    fs.writeFileSync(path.join(DIST, 'game-standalone.html'), standalone);

    console.log('✔ 打包完成: ' + DIST);
    console.log('  index.html          静态站入口（部署/局域网用）');
    console.log('  game-standalone.html 单文件版（双击即玩，纯本地）');
    console.log('  体积: 引擎 ' + (engineTotal / 1024).toFixed(0) + ' KB + 游戏 ' +
        (fs.statSync(path.join(DIST, 'js', 'bundle.js')).size / 1024).toFixed(1) + ' KB' +
        (standalone.length > 0 ? ' (单文件 ' + (standalone.length / 1024).toFixed(0) + ' KB)' : ''));
}

main();
