import { describe, expect, it } from "vitest";
import { anonymize } from "./anonymize";

const sample = {
  __typename: "Tweet",
  rest_id: "1973000000000000500",
  core: { user_results: { result: { core: { screen_name: "realname", name: "本名太郎" } } } },
  legacy: {
    full_text: "秘密の本文 https://t.co/abc",
    entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://private.example.com/x" }], media: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/A.jpg" }] },
    favorite_count: 12,
    possibly_sensitive: false,
  },
  entries: [{ entryId: "tweet-1973000000000000500", sortIndex: "1868000000000000002" }, { sortIndex: "9999" }],
};

describe("anonymize", () => {
  const out = JSON.stringify(anonymize(sample));

  it("元の文字列（本文・名前・URL・ID）が残らない", () => {
    for (const secret of ["realname", "本名太郎", "秘密の本文", "private.example.com", "1973000000000000500", "1868000000000000002", "pbs.twimg.com"]) {
      expect(out).not.toContain(secret);
    }
  });

  it("構造を表す値（__typename・type）と数値・真偽値は残す", () => {
    const a = anonymize(sample) as typeof sample;
    expect(a.__typename).toBe("Tweet");
    expect(a.legacy.entities.media[0]?.type).toBe("photo");
    expect(a.legacy.favorite_count).toBe(12);
    expect(a.legacy.possibly_sensitive).toBe(false);
  });

  it("同じ文字列は同じ置き換え。数字の文字列は大小関係を保つ", () => {
    const a = anonymize(sample) as typeof sample;
    expect(a.legacy.entities.urls[0]?.url).toBe(a.legacy.full_text.split(" ")[1]);
    const [first, second] = a.entries;
    expect(BigInt(first?.sortIndex ?? "0") > BigInt(second?.sortIndex ?? "0")).toBe(true);
    expect(a.legacy.entities.urls[0]?.expanded_url.startsWith("https://example.com/")).toBe(true);
  });
});
