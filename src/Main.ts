/**
 * 武侠文字游戏 —— 入口
 */
async function main(): Promise<void> {
    await Laya.init(960, 640);
    Laya.stage.bgColor = "#1a1a2e";

    const title = new Laya.Text();
    title.text = "武侠文字游戏";
    title.fontSize = 48;
    title.bold = true;
    title.color = "#e0c070";
    title.pos(40, 40);
    Laya.stage.addChild(title);

    const body = new Laya.Text();
    body.text = "引擎已就绪。江湖路远,少侠请启程。";
    body.fontSize = 24;
    body.color = "#cccccc";
    body.pos(40, 130);
    Laya.stage.addChild(body);
}

main();
