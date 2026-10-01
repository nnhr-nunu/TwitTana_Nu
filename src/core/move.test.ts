import { describe, expect, it } from "vitest";
import { moveItem } from "./move";

describe("moveItem", () => {
  it("指定の位置へ動かし、元の配列は変えない", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 2, 0)).toEqual(["c", "a", "b"]);
    expect(items).toEqual(["a", "b", "c"]);
  });
  it("範囲外なら元のまま", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});
