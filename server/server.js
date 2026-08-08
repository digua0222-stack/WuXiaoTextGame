/**
 * 文字武侠游戏 —— 后端服务示例（Node 原生 http，零第三方依赖）
 *
 * 启动: node server/server.js          (默认 3000 端口)
 *       PORT=8080 node server/server.js (自定义端口)
 *
 * 功能:
 *   GET /api/story            -> 返回全部剧情节点
 *   GET /api/story/:id        -> 返回单个剧情节点 (JSON, 符合 StoryNode 结构)
 *   POST /api/save            -> 接收前端存档 (示例：仅打印，可接数据库)
 *   GET /api/hero/:name       -> 读取远端存档 (示例：返回 404 表示无)
 *   其他路径                   -> 静态托管 dist/ 目录（前端页面）
 *
 * 前端启用方式: 在 Main.ts 中设置 WuXia.ApiClient.baseUrl = "http://localhost:3000/api";
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ---------------------------------------------------------------
// 远端故事线数据（演示用，生产环境可换成数据库/其他服务）
// 字段与前端 src/wuxia/model/Hero.ts 的 StoryNode 接口一一对应
// ---------------------------------------------------------------
const REMOTE_STORIES = {
    story_start: {
        id: 'story_start',
        text: '青州·云来镇，破旧客栈。你从昏睡中醒来，窗外晨光熹微。\n【远端数据】此节点由服务器下发。',
        choices: [
            { text: '出门采买', next: 'story_street' },
            { text: '先在床上躺一会儿', next: 'story_lazy' }
        ]
    },
    story_street: {
        id: 'story_street',
        text: '镇口大街上，一个地痞正在欺负卖菜老翁，围观者敢怒不敢言。',
        choices: [
            { text: '出手制止', effect: [{ type: 'battle', enemy: 'gangster', win: 'story_win', lose: 'story_street' }] },
            { text: '绕道而行', next: 'story_avoid' }
        ]
    },
    story_win: {
        id: 'story_win',
        text: '你三拳两脚打跑了地痞，老翁感激不尽，赠你一包卤牛肉。',
        effect: [{ type: 'item', item: 'beef', count: 1 }, { type: 'exp', value: 12 }],
        choices: [
            { text: '继续向前', next: 'story_avoid' }
        ]
    },
    story_avoid: {
        id: 'story_avoid',
        text: '你继续在镇上闲逛，忽见前方山道上人影晃动，似有山贼出没。',
        choices: [
            { text: '上前探查', next: 'story_forest' },
            { text: '返回客栈休息', next: 'story_lazy' }
        ]
    },
    story_forest: {
        id: 'story_forest',
        text: '山道旁树林中，一名山贼持刀拦住去路。',
        choices: [
            { text: '与之交手', effect: [{ type: 'battle', enemy: 'bandit', win: 'story_forest_win', lose: 'story_avoid' }] },
            { text: '交银两求饶', effect: [{ type: 'money', value: -20 }], next: 'story_avoid' }
        ]
    },
    story_forest_win: {
        id: 'story_forest_win',
        text: '山贼被你击败，丢下银两仓皇逃窜。',
        effect: [{ type: 'exp', value: 40 }, { type: 'money', value: 25 }],
        choices: [
            { text: '继续探索', next: 'story_lazy' }
        ]
    },
    story_lazy: {
        id: 'story_lazy',
        text: '你回到客栈躺下，回想起这半日的际遇，心中暗下决心：这江湖，要走上一走。',
        choices: [
            { text: '明天再说（结束示例流程）' }
        ]
    }
};

// ---------------------------------------------------------------
// 简易 JSON 响应
// ---------------------------------------------------------------
function sendJson(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(body);
}

// ---------------------------------------------------------------
// 静态文件托管（dist/）
// ---------------------------------------------------------------
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.map': 'application/json'
};

function serveStatic(req, res, pathname) {
    let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
    // 防目录穿越
    if (!filePath.startsWith(DIST)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404); res.end('Not Found'); return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream'
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

// ---------------------------------------------------------------
// 路由
// ---------------------------------------------------------------
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
        res.end(); return;
    }

    // ---- API 路由 ----
    if (pathname === '/api/story' && req.method === 'GET') {
        sendJson(res, 200, { code: 0, data: REMOTE_STORIES });
        return;
    }
    const storyMatch = pathname.match(/^\/api\/story\/([\w-]+)$/);
    if (storyMatch && req.method === 'GET') {
        const id = storyMatch[1];
        const node = REMOTE_STORIES[id];
        if (!node) {
            sendJson(res, 404, { code: 404, msg: `剧情节点不存在: ${id}` });
            return;
        }
        // 模拟网络延迟，方便观察异步加载效果
        setTimeout(() => sendJson(res, 200, { code: 0, data: node }), 100);
        return;
    }
    if (pathname === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            console.log('[api/save] 收到存档:', body);
            // TODO: 接入数据库/文件持久化，绑定玩家账号
            sendJson(res, 200, { code: 0, msg: 'saved' });
        });
        return;
    }
    if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { code: 404, msg: '接口不存在' });
        return;
    }

    // ---- 静态资源 ----
    serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
    console.log(`✔ 后端服务已启动: http://localhost:${PORT}`);
    console.log(`  剧情接口: http://localhost:${PORT}/api/story/story_start`);
    console.log(`  前端页面: http://localhost:${PORT}/`);
});
