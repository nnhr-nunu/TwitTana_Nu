import { describe, expect, it, vi } from "vitest";
import { patchFetch } from "./network-patch";

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeTarget(body: string, status = 200) {
  return { fetch: (async () => new Response(body, { status, headers: { "content-type": "application/json" } })) as typeof fetch };
}

describe("patchFetch", () => {
  it("返事はそのまま返し、URL・送信本文・成否・JSON を知らせる", async () => {
    const target = fakeTarget('{"a":1}');
    const seen: unknown[] = [];
    patchFetch(target, (url, body, ok, readJson) => {
      void readJson().then((json) => seen.push({ url, body, ok, json }));
    });
    const res = await target.fetch("https://x.com/i/api/graphql/q/Bookmarks?v=1", { method: "POST", body: "{}" });
    expect(await res.json()).toEqual({ a: 1 });
    await tick();
    expect(seen).toEqual([{ url: "https://x.com/i/api/graphql/q/Bookmarks?v=1", body: "{}", ok: true, json: { a: 1 } }]);
  });

  it("URL オブジェクトと Request も受け付け、失敗の返事は ok: false で知らせる", async () => {
    const target = fakeTarget("{}", 500);
    const urls: [string, boolean][] = [];
    patchFetch(target, (url, _body, ok) => urls.push([url, ok]));
    await target.fetch(new URL("https://x.com/a"));
    await target.fetch(new Request("https://x.com/b"));
    expect(urls).toEqual([
      ["https://x.com/a", false],
      ["https://x.com/b", false],
    ]);
  });

  it("知らせる側が例外を投げても、返事はそのまま返る", async () => {
    const target = fakeTarget('{"ok":true}');
    patchFetch(target, () => {
      throw new Error("壊れた");
    });
    const res = await target.fetch("https://x.com/i/api/graphql/q/Bookmarks");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("JSON でない返事でも、返事はそのまま返る", async () => {
    const target = fakeTarget("<html>");
    let failed = false;
    patchFetch(target, (_u, _b, _ok, readJson) => {
      readJson().catch(() => {
        failed = true;
      });
    });
    const res = await target.fetch("https://x.com/i/api/graphql/q/Bookmarks");
    expect(await res.text()).toBe("<html>");
    await tick();
    expect(failed).toBe(true);
  });

  it("見張らない URL は知らせず、複製もしない", async () => {
    const target = fakeTarget('{"a":1}');
    let called = false;
    patchFetch(
      target,
      () => {
        called = true;
      },
      (url) => url.includes("/i/api/graphql/"),
    );
    const clone = vi.spyOn(Response.prototype, "clone");
    const res = await target.fetch("https://video.twimg.com/v.mp4");
    expect(await res.json()).toEqual({ a: 1 });
    expect(called).toBe(false);
    expect(clone).not.toHaveBeenCalled();
    clone.mockRestore();
  });
});
