import { describe, expect, it } from "vitest";
import { hasParseWarning } from "./health";

describe("hasParseWarning", () => {
  it("最後の失敗が最後の成功より新しいときだけ警告", () => {
    expect(hasParseWarning({})).toBe(false);
    expect(hasParseWarning({ lastErrorAt: "2026-10-02T00:00:00.000Z" })).toBe(true);
    expect(hasParseWarning({ lastOkAt: "2026-10-02T01:00:00.000Z", lastErrorAt: "2026-10-02T00:00:00.000Z" })).toBe(false);
    expect(hasParseWarning({ lastOkAt: "2026-10-02T00:00:00.000Z", lastErrorAt: "2026-10-02T01:00:00.000Z" })).toBe(true);
  });
});
