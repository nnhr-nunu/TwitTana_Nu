/**
 * 通信を受け取ったときに呼ぶ関数。
 * readJson は呼ばれたその場で返事を複製するので、handle の中で同期的に呼ぶこと。
 */
export type NetworkHandler = (url: string, requestBody: unknown, ok: boolean, readJson: () => Promise<unknown>) => void;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** fetch を包む。X の画面に渡す返事には手を加えない */
export function patchFetch(target: { fetch: typeof fetch }, handle: NetworkHandler): void {
  const original = target.fetch;
  target.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await original.call(target, input, init);
    try {
      const copy = res.clone();
      handle(urlOf(input), init?.body, res.ok, () => copy.json());
    } catch {
      // X の画面は壊さない
    }
    return res;
  };
}

/** XMLHttpRequest を包む。shouldWatch が true の URL だけ見る */
export function patchXhr(
  target: { XMLHttpRequest: typeof XMLHttpRequest },
  handle: NetworkHandler,
  shouldWatch: (url: string) => boolean,
): void {
  const proto = target.XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const urls = new WeakMap<XMLHttpRequest, string>();

  proto.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]) {
    try {
      urls.set(this, String(args[1]));
    } catch {
      // X の画面は壊さない
    }
    return (originalOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.open;

  proto.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = urls.get(this);
    if (url && shouldWatch(url)) {
      this.addEventListener("load", () => {
        try {
          const ok = this.status >= 200 && this.status < 300;
          handle(url, body, ok, async () => {
            if (this.responseType === "json") return this.response;
            if (this.responseType === "" || this.responseType === "text") return JSON.parse(this.responseText);
            throw new Error(`unsupported responseType: ${this.responseType}`);
          });
        } catch {
          // X の画面は壊さない
        }
      });
    }
    return originalSend.call(this, body);
  };
}
