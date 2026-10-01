import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAvailability, classifierFrom, createAiSession, normalizeAvailability, type AiSession } from "./language-model";

const g = globalThis as { LanguageModel?: unknown };
afterEach(() => {
  delete g.LanguageModel;
});

describe("normalizeAvailability", () => {
  it("新旧どちらの呼び名も 4 種類にそろえる", () => {
    expect(normalizeAvailability("available")).toBe("available");
    expect(normalizeAvailability("readily")).toBe("available");
    expect(normalizeAvailability("downloadable")).toBe("downloadable");
    expect(normalizeAvailability("after-download")).toBe("downloadable");
    expect(normalizeAvailability("downloading")).toBe("downloading");
    expect(normalizeAvailability("no")).toBe("unavailable");
    expect(normalizeAvailability(undefined)).toBe("unavailable");
  });
});

describe("aiAvailability", () => {
  it("LanguageModel が無ければ使えない", async () => {
    expect(await aiAvailability()).toBe("unavailable");
  });
  it("ある場合は日本語と英語を指定して聞く。例外なら使えない", async () => {
    const availability = vi.fn(async () => "available");
    g.LanguageModel = { availability, create: vi.fn() };
    expect(await aiAvailability()).toBe("available");
    expect(availability).toHaveBeenCalledWith(expect.objectContaining({ expectedInputs: [{ type: "text", languages: ["en", "ja"] }] }));
    g.LanguageModel = { availability: async () => Promise.reject(new Error("x")), create: vi.fn() };
    expect(await aiAvailability()).toBe("unavailable");
  });
});

describe("createAiSession", () => {
  it("システムの指示文つきで作り、ダウンロードの進み具合を知らせる", async () => {
    const create = vi.fn(async (opts: { monitor?: (m: EventTarget) => void }) => {
      const target = new EventTarget();
      opts.monitor?.(target);
      const e = new Event("downloadprogress");
      Object.assign(e, { loaded: 0.5 });
      target.dispatchEvent(e);
      return { prompt: vi.fn(), clone: vi.fn(), destroy: vi.fn() };
    });
    g.LanguageModel = { availability: vi.fn(), create };
    const progress = vi.fn();
    await createAiSession(progress);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ initialPrompts: [expect.objectContaining({ role: "system" })] }));
    expect(progress).toHaveBeenCalledWith(0.5);
  });
  it("LanguageModel が無ければ例外", async () => {
    await expect(createAiSession()).rejects.toThrow();
  });
});

describe("classifierFrom", () => {
  it("1 件ごとに複製したセッションで聞き、終わったら捨てる", async () => {
    const clone: AiSession = { prompt: vi.fn(async () => '{"ok":1}'), clone: vi.fn(), destroy: vi.fn() };
    const base: AiSession = { prompt: vi.fn(), clone: vi.fn(async () => clone), destroy: vi.fn() };
    const classify = classifierFrom(base);
    expect(await classify("p", { type: "object" })).toBe('{"ok":1}');
    expect(clone.prompt).toHaveBeenCalledWith("p", { responseConstraint: { type: "object" } });
    expect(clone.destroy).toHaveBeenCalled();
    expect(base.prompt).not.toHaveBeenCalled();
  });
});
