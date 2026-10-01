import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { RecentPosts } from "./recent-cache";

describe("RecentPosts", () => {
  it("上限を超えたら古いものから捨てる。見直したものは新しくなる", () => {
    const c = new RecentPosts(2);
    c.add([makeCaptured({ id: "1" }), makeCaptured({ id: "2" })]);
    c.add([makeCaptured({ id: "1", text: "更新" })]);
    c.add([makeCaptured({ id: "3" })]);
    expect(c.size).toBe(2);
    expect(c.get("2")).toBeUndefined();
    expect(c.get("1")?.text).toBe("更新");
    expect(c.get("3")).toBeDefined();
  });
});
