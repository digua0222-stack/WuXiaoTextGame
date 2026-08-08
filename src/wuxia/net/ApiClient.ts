namespace WuXia {
    /**
     * 网络通信层：基于 Laya.HttpRequest 的 Promise 封装
     * - baseUrl 为空串 = 纯离线模式（只读本地 GameData）
     * - baseUrl 赋值后 = 后端通信模式（远程数据优先，失败回退本地）
     */
    export class ApiClient {
        /** 后端地址，例如 "http://localhost:3000/api"。留空表示离线 */
        static baseUrl = "";

        static get online(): boolean {
            return this.baseUrl.length > 0;
        }

        /** GET 请求，responseType="json" 时自动解析为对象 */
        static get<T>(path: string, timeout = 8000): Promise<T> {
            return this.request<T>("get", path, null, timeout);
        }

        /** POST 请求，body 自动 JSON 序列化 */
        static post<T>(path: string, data: unknown, timeout = 8000): Promise<T> {
            return this.request<T>("post", path, data, timeout);
        }

        private static request<T>(
            method: "get" | "post",
            path: string,
            data: unknown,
            timeout: number
        ): Promise<T> {
            return new Promise<T>((resolve, reject) => {
                const http = new Laya.HttpRequest();
                let settled = false;

                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        reject(new Error(`请求超时: ${path}`));
                    }
                }, timeout);

                http.once(Laya.Event.COMPLETE, this, (res: unknown) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    resolve(res as T);
                });

                http.once(Laya.Event.ERROR, this, (msg: unknown) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error(String(msg) || `请求失败: ${path}`));
                });

                const body = data != null ? JSON.stringify(data) : null;
                http.send(
                    this.baseUrl + path,
                    body,
                    method,
                    "json",
                    ["Content-Type", "application/json"]
                );
            });
        }
    }
}
