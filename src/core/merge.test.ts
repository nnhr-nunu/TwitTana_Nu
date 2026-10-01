import { describe, expect, it } from "vitest";
import { makeCaptured, makePost } from "../test/factories";
import { mergeCaptured, mergeImported } from "./merge";

const NOW = "2026-10-02T12:00:00.000Z";

describe("mergeCaptured", () => {
  it("新しい投稿は、整理の状態を空で作る", () => {
    const p = mergeCaptured(undefined, makeCaptured({ id: "1" }), { now: NOW, bookmarked: true });
    expect(p).toMatchObject({ id: "1", capturedAt: NOW, folders: [], sortedByUser: false, removedOnX: false, hidden: false, review: { count: 0 } });
  });

  it("既にある投稿は中身だけ更新し、整理の状態は残す", () => {
    const existing = makePost({
      id: "1",
      text: "古い本文",
      capturedAt: "2026-01-05T00:00:00.000Z",
      folders: [{ folderId: "f1", by: "manual" }],
      sortedByUser: true,
      hidden: true,
      review: { count: 2, lastAt: "2026-09-01T00:00:00.000Z" },
      aiCheckedFoldersVersion: 3,
    });
    const p = mergeCaptured(existing, makeCaptured({ id: "1", text: "新しい本文" }), { now: NOW, bookmarked: true });
    expect(p.text).toBe("新しい本文");
    expect(p.capturedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(p.folders).toEqual([{ folderId: "f1", by: "manual" }]);
    expect(p.sortedByUser).toBe(true);
    expect(p.hidden).toBe(true);
    expect(p.review).toEqual({ count: 2, lastAt: "2026-09-01T00:00:00.000Z" });
    expect(p.aiCheckedFoldersVersion).toBe(3);
  });

  it("ブクマ済みと分かったら解除済みの印を外す", () => {
    const existing = makePost({ id: "1", removedOnX: true });
    expect(mergeCaptured(existing, makeCaptured({ id: "1" }), { now: NOW, bookmarked: true }).removedOnX).toBe(false);
    expect(mergeCaptured(existing, makeCaptured({ id: "1" }), { now: NOW, bookmarked: false }).removedOnX).toBe(true);
  });

  it("中身の分からない取り込みで、分かっている中身を上書きしない", () => {
    const existing = makePost({ id: "1", text: "本文あり" });
    const p = mergeCaptured(existing, makeCaptured({ id: "1", text: "", partial: true }), { now: NOW, bookmarked: true });
    expect(p.text).toBe("本文あり");
    expect(p.partial).toBeUndefined();
  });

  it("中身の分からなかった投稿は、あとの取り込みで埋まる", () => {
    const existing = makePost({ id: "1", text: "", partial: true });
    const p = mergeCaptured(existing, makeCaptured({ id: "1", text: "本文" }), { now: NOW, bookmarked: true });
    expect(p.text).toBe("本文");
    expect(p.partial).toBeUndefined();
  });

  it("並び値は新しい取り込みに無ければ前の値を残す", () => {
    const existing = makePost({ id: "1", bookmarkOrder: "500" });
    expect(mergeCaptured(existing, makeCaptured({ id: "1" }), { now: NOW, bookmarked: true }).bookmarkOrder).toBe("500");
    expect(mergeCaptured(existing, makeCaptured({ id: "1", bookmarkOrder: "900" }), { now: NOW, bookmarked: true }).bookmarkOrder).toBe("900");
  });
});

describe("mergeImported", () => {
  it("無ければそのまま入れる", () => {
    const imported = makePost({ id: "1" });
    expect(mergeImported(undefined, imported)).toEqual(imported);
  });

  it("フォルダは足し合わせ、非表示や手動の印はどちらかが立っていれば立てる", () => {
    const existing = makePost({ id: "1", folders: [{ folderId: "a", by: "rule" }] });
    const imported = makePost({ id: "1", folders: [{ folderId: "a", by: "manual" }, { folderId: "b", by: "manual" }], hidden: true, sortedByUser: true });
    const p = mergeImported(existing, imported);
    expect(p.folders).toEqual([{ folderId: "a", by: "rule" }, { folderId: "b", by: "manual" }]);
    expect(p.hidden).toBe(true);
    expect(p.sortedByUser).toBe(true);
  });

  it("見返しは多い回数と新しい日時をとる。取り込み日時は古い方をとる", () => {
    const existing = makePost({ id: "1", capturedAt: "2026-05-01T00:00:00.000Z", review: { count: 1, lastAt: "2026-09-01T00:00:00.000Z" } });
    const imported = makePost({ id: "1", capturedAt: "2026-04-01T00:00:00.000Z", review: { count: 3, lastAt: "2026-08-01T00:00:00.000Z" } });
    const p = mergeImported(existing, imported);
    expect(p.review).toEqual({ count: 3, lastAt: "2026-09-01T00:00:00.000Z" });
    expect(p.capturedAt).toBe("2026-04-01T00:00:00.000Z");
  });

  it("手元が中身なしで、読み込んだ方に中身があれば中身を埋める", () => {
    const existing = makePost({ id: "1", text: "", partial: true });
    const p = mergeImported(existing, makePost({ id: "1", text: "本文" }));
    expect(p.text).toBe("本文");
    expect(p.partial).toBeUndefined();
  });
});
