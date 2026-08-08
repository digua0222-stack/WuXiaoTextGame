namespace WuXia {
    /**
     * 剧情数据源：远程优先，本地兜底，带内存缓存
     * - 后端开启时：GET /api/story/:id 拉取节点 JSON
     * - 后端失败/离线时：回退 GameData 本地静态数据
     * 类型契约：远端返回的 JSON 必须符合 StoryNode 结构
     */
    export class StorySource {
        private static cache: { [id: string]: StoryNode } = {};
        private static loading: { [id: string]: Promise<StoryNode | null> } = {};

        /** 获取剧情节点（并发去重） */
        static get(id: string): Promise<StoryNode | null> {
            if (this.cache[id]) return Promise.resolve(this.cache[id]);
            if (this.loading[id]) return this.loading[id];

            const p = ApiClient.online
                ? this.fromRemote(id)
                : Promise.resolve(this.fromLocal(id));

            this.loading[id] = p;
            // target=ES2017，用 then 做清理而非 finally
            p.then(() => { delete this.loading[id]; }, () => { delete this.loading[id]; });
            return p;
        }

        private static fromRemote(id: string): Promise<StoryNode | null> {
            return ApiClient.get<StoryNode>("/api/story/" + encodeURIComponent(id))
                .then((node) => {
                    this.cache[id] = node;
                    return node;
                })
                .catch((err) => {
                    console.warn("[StorySource] 远端剧情拉取失败，回退本地:", id, err);
                    return this.fromLocal(id);
                });
        }

        private static fromLocal(id: string): StoryNode | null {
            const node = GameData.getStory(id) || null;
            if (node) this.cache[id] = node;
            return node;
        }

        /** 清空缓存（切换账号/刷新远端版本时调用） */
        static clearCache(): void {
            this.cache = {};
        }
    }
}
