import type { BrowserContext, Route } from "@playwright/test";
import { bookmarksResponse, rawTweet, timelineResponse } from "../src/x/test-builders";

export const BOOKMARKED = [
  rawTweet({ id: "1973000000000000601", handle: "alice", name: "アリス", text: "ブクマ1本文" }),
  rawTweet({ id: "1973000000000000602", handle: "bob", name: "ボブ", text: "ブクマ2本文" }),
];
export const TIMELINE_POST = rawTweet({ id: "1973000000000000700", handle: "carol", name: "キャロル", text: "タイムラインの投稿" });

/** ブクマ画面：X と同じく fetch で一覧を取り、本文を描く */
const BOOKMARKS_HTML = `<!doctype html><html><body><main id="app">loading</main><script>
fetch("/i/api/graphql/q1/Bookmarks?variables=%7B%7D")
  .then((r) => r.json())
  .then((json) => {
    const entries = json.data.bookmark_timeline_v2.timeline.instructions[0].entries.filter((e) => e.content.itemContent);
    document.getElementById("app").innerHTML = entries
      .map((e) => '<article data-testid="tweet"><div data-testid="tweetText">' + e.content.itemContent.tweet_results.result.legacy.full_text + "</div></article>")
      .join("");
  });
</script></body></html>`;

/** ホーム：XMLHttpRequest でタイムラインを取り、ブクマボタンつきで描く。ボタンで CreateBookmark を送る */
const HOME_HTML = `<!doctype html><html><body><main id="app">loading</main><script>
const xhr = new XMLHttpRequest();
xhr.open("GET", "/i/api/graphql/q2/HomeTimeline?variables=%7B%7D");
xhr.onload = () => {
  const json = JSON.parse(xhr.responseText);
  const t = json.data.home.home_timeline_urt.instructions[0].entries[0].content.itemContent.tweet_results.result;
  const handle = t.core.user_results.result.core.screen_name;
  document.getElementById("app").innerHTML =
    '<article data-testid="tweet"><a href="/' + handle + "/status/" + t.rest_id + '"><time datetime="2026-09-01T00:00:00.000Z">9月1日</time></a>' +
    '<div data-testid="tweetText">' + t.legacy.full_text + "</div>" +
    '<div role="group" style="margin-top:200px"><button data-testid="bookmark">bookmark</button></div></article>';
  document.querySelector('[data-testid="bookmark"]').addEventListener("click", () => {
    fetch("/i/api/graphql/q3/CreateBookmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variables: { tweet_id: t.rest_id }, queryId: "q3" }),
    });
  });
};
xhr.send();
</script></body></html>`;

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

/** https://x.com/** を偽物で返し、それ以外の外部への通信は遮断する */
export async function routeFakeX(context: BrowserContext): Promise<void> {
  // http(s) だけを対象にする（拡張自身のページ chrome-extension:// は触らない）
  await context.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://x.com") return route.abort();
    if (url.pathname === "/i/bookmarks") return route.fulfill({ status: 200, contentType: "text/html", body: BOOKMARKS_HTML });
    if (url.pathname === "/home") return route.fulfill({ status: 200, contentType: "text/html", body: HOME_HTML });
    if (url.pathname.endsWith("/Bookmarks")) {
      return json(route, bookmarksResponse(BOOKMARKED.map((tweet, i) => ({ tweet, sortIndex: String(1868000000000000010n - BigInt(i)) }))));
    }
    if (url.pathname.endsWith("/HomeTimeline")) return json(route, timelineResponse([TIMELINE_POST]));
    if (url.pathname.endsWith("/CreateBookmark")) return json(route, { data: { tweet_bookmark_put: "Done" } });
    return route.fulfill({ status: 404, body: "" });
  });
}
