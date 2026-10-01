import { defineContentScript } from "#imports";
import { bookmarkMutation, graphqlOperation, isBookmarkListOp } from "../x/graphql";
import { createHookCore } from "../x/hook-core";
import { HOOK_SOURCE, type HookMessage } from "../x/messages";
import { patchFetch, patchXhr, type NetworkHandler } from "../x/network-patch";

/**
 * 取り込み係（MAIN world）。X の画面が受け取った GraphQL の返事を横で読み、
 * 橋渡し係へ window.postMessage で渡す。拡張 API は使えない。
 */
export default defineContentScript({
  matches: ["https://x.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const core = createHookCore();
    const post = (messages: HookMessage[]) => {
      for (const m of messages) window.postMessage(m, window.location.origin);
    };

    const handle: NetworkHandler = (url, requestBody, ok, readJson) => {
      const op = graphqlOperation(url);
      if (!op || !ok) return;
      if (bookmarkMutation(op)) {
        post(core.onMutation(op, requestBody));
        return;
      }
      readJson().then(
        (json) => {
          // 開発版だけ：localStorage に twittana:dump=1 があれば、ブクマ一覧の生データをコンソールに出す
          if (import.meta.env.DEV && isBookmarkListOp(op) && window.localStorage.getItem("twittana:dump") === "1") {
            console.debug("[twittana:raw]", op, JSON.stringify(json));
          }
          post(core.onResponse(op, json));
        },
        () => post([{ source: HOOK_SOURCE, type: "parse-error", op }]),
      );
    };

    patchFetch(window, handle, (url) => graphqlOperation(url) !== null);
    patchXhr(window, handle, (url) => graphqlOperation(url) !== null);
  },
});
