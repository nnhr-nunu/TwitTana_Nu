import "../ui/picker/picker.css";
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi, defineContentScript } from "#imports";
import { savePostsQueued, sendToBackground } from "../bridge/bg-client";
import { BridgeApp, type BridgeActions } from "../bridge/BridgeApp";
import { anchorFromRect, createStore } from "../bridge/store";
import { hasParseWarning } from "../core/health";
import { findBookmarkButton, partialPost, postIdFromArticle, readPostFromArticle } from "../x/dom-read";
import { setLanguage } from "../i18n";
import { isHookMessage, type HookMessage } from "../x/messages";

const BOOKMARKS_PATH = /^\/i\/bookmarks(\/|$)/;
const CLICK_MEMORY_MS = 5000;

type LastClick = { postId: string | null; article: Element | null; rect: DOMRect; at: number };

function waitForBody(): Promise<void> {
  if (document.body) return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

/**
 * 橋渡し係。取り込み係からのメッセージを検査して裏方に保存させ、
 * ブクマした瞬間のメニューと、ブクマ画面の取り込み件数を出す。
 */
export default defineContentScript({
  matches: ["https://x.com/*"],
  runAt: "document_start",
  cssInjectionMode: "ui",
  async main(ctx) {
    const store = createStore();
    let lastClick: LastClick | null = null;
    let sessionCount = 0;

    ctx.addEventListener(
      document,
      "click",
      (e) => {
        const button = findBookmarkButton(e.target);
        if (!button) return;
        const article = button.closest("article");
        lastClick = { postId: article ? postIdFromArticle(article) : null, article, rect: button.getBoundingClientRect(), at: Date.now() };
      },
      { capture: true },
    );

    const refreshCounter = async () => {
      if (!BOOKMARKS_PATH.test(location.pathname)) {
        store.set((s) => ({ ...s, counter: null }));
        return;
      }
      try {
        const stats = await sendToBackground<"get-stats">({ type: "get-stats" });
        setLanguage(stats.language);
        store.set((s) => ({ ...s, counter: { sessionCount, total: stats.total, warning: hasParseWarning(stats.health) } }));
      } catch {
        store.set((s) => ({ ...s, counter: { sessionCount, total: null, warning: false } }));
      }
    };

    const recentClickFor = (postId: string): LastClick | null => {
      const c = lastClick;
      if (!c || Date.now() - c.at > CLICK_MEMORY_MS) return null;
      return c.postId === null || c.postId === postId ? c : null;
    };

    const onHook = async (m: HookMessage) => {
      switch (m.type) {
        case "bookmarks-seen": {
          const res = await savePostsQueued(m.posts);
          if (res) sessionCount += m.posts.length;
          await refreshCounter();
          return;
        }
        case "bookmark-added": {
          const click = recentClickFor(m.postId);
          const post = m.post ?? (click?.article ? readPostFromArticle(click.article, m.postId) : partialPost(m.postId));
          await savePostsQueued([post]);
          const picker = await sendToBackground<"get-picker-state">({ type: "get-picker-state", postId: m.postId });
          setLanguage(picker.language);
          if (!picker.enabled) return;
          const anchor = click ? anchorFromRect(click.rect, { width: window.innerWidth, height: window.innerHeight }) : null;
          store.set((s) => ({ ...s, picker: { postId: m.postId, anchor, folders: picker.folders, selected: picker.selected } }));
          return;
        }
        case "bookmark-removed":
          await sendToBackground<"mark-removed">({ type: "mark-removed", postId: m.postId });
          return;
        case "parse-error":
          await sendToBackground<"report-parse-error">({ type: "report-parse-error", op: m.op });
          await refreshCounter();
          return;
      }
    };

    ctx.addEventListener(window, "message", (e) => {
      if (e.source !== window || e.origin !== location.origin || !isHookMessage(e.data)) return;
      onHook(e.data).catch(() => {
        // 保存に失敗しても X の画面は壊さない
      });
    });

    ctx.addEventListener(window, "wxt:locationchange", () => {
      sessionCount = 0;
      void refreshCounter();
    });

    const actions: BridgeActions = {
      toggle(folderId, on) {
        const picker = store.get().picker;
        if (!picker) return;
        sendToBackground<"set-folder">({ type: "set-folder", postId: picker.postId, folderId, on })
          .then((res) => store.set((s) => (s.picker ? { ...s, picker: { ...s.picker, selected: res.selected } } : s)))
          .catch(() => {});
      },
      async create(name) {
        const picker = store.get().picker;
        const res = await sendToBackground<"create-folder">({ type: "create-folder", name, postId: picker?.postId });
        if (!res.ok) return res.error;
        store.set((s) =>
          s.picker ? { ...s, picker: { ...s.picker, folders: [...s.picker.folders, res.folder], selected: res.selected } } : s,
        );
        return null;
      },
      closePicker() {
        store.set((s) => ({ ...s, picker: null }));
      },
    };

    await waitForBody();
    const ui = await createShadowRootUi<Root>(ctx, {
      name: "twittana-ui",
      position: "inline",
      anchor: "body",
      onMount(container) {
        const el = document.createElement("div");
        container.append(el);
        const root = createRoot(el);
        root.render(<BridgeApp store={store} actions={actions} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    void refreshCounter();
  },
});
