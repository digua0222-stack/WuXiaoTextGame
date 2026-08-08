/**
 * 武侠文字游戏 —— 入口
 * 搭建：主角 / 剧情 / 战斗 / 养成 四大框架
 */
async function main(): Promise<void> {
    await Laya.init(960, 640);
    Laya.stage.bgColor = "#17171e";
    Laya.stage.scaleMode = Laya.Stage.SCALE_FIXED_AUTO;
    Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
    Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;

    // 启动游戏
    new WuXia.Game();

    // 启用后端通信模式（默认离线，仅读本地 GameData）
    // 放开下面一行即可改为：剧情数据从服务器 /api/story/:id 拉取，失败自动回退本地
    // WuXia.ApiClient.baseUrl = "http://localhost:3000/api";
}

main();
