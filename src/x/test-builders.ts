type RawMedia = {
  type: "photo" | "video" | "animated_gif";
  url: string;
  base: string;
  variants?: { bitrate?: number; content_type: string; url: string }[];
};

export type RawTweetOptions = {
  id: string;
  handle?: string;
  name?: string;
  text?: string;
  /** "core": 2025 年以降の形（core.screen_name・avatar.image_url）。"legacy": 古い形 */
  userLayout?: "core" | "legacy";
  urls?: { url: string; expanded: string }[];
  hashtags?: string[];
  media?: RawMedia[];
  note?: string;
  quoted?: object;
  retweeted?: object;
  createdAt?: string;
};

export function rawTweet(o: RawTweetOptions): Record<string, unknown> {
  const handle = o.handle ?? "alice";
  const name = o.name ?? "Alice";
  const avatar = `https://pbs.twimg.com/profile_images/${handle}.jpg`;
  const user =
    o.userLayout === "legacy"
      ? { __typename: "User", rest_id: `u-${handle}`, legacy: { screen_name: handle, name, profile_image_url_https: avatar } }
      : { __typename: "User", rest_id: `u-${handle}`, core: { screen_name: handle, name }, avatar: { image_url: avatar }, legacy: {} };
  const media = (o.media ?? []).map((m) => ({
    type: m.type,
    url: m.url,
    media_url_https: m.base,
    ...(m.variants ? { video_info: { variants: m.variants } } : {}),
  }));
  return {
    __typename: "Tweet",
    rest_id: o.id,
    core: { user_results: { result: user } },
    legacy: {
      full_text: o.text ?? "",
      created_at: o.createdAt ?? "Wed Oct 01 12:00:00 +0000 2025",
      entities: {
        hashtags: (o.hashtags ?? []).map((text) => ({ text })),
        urls: (o.urls ?? []).map((u) => ({ url: u.url, expanded_url: u.expanded })),
        ...(media.length ? { media } : {}),
      },
      ...(media.length ? { extended_entities: { media } } : {}),
      ...(o.retweeted ? { retweeted_status_result: { result: o.retweeted } } : {}),
    },
    ...(o.note ? { note_tweet: { note_tweet_results: { result: { text: o.note, entity_set: { urls: [], hashtags: [] } } } } } : {}),
    ...(o.quoted ? { quoted_status_result: { result: o.quoted } } : {}),
  };
}

export function visibilityWrapped(tweet: object): object {
  return { __typename: "TweetWithVisibilityResults", tweet };
}

export function tombstone(): object {
  return { __typename: "TweetTombstone", tombstone: { text: { text: "この投稿は表示できません" } } };
}

export function bookmarksResponse(entries: { tweet: object; sortIndex: string }[]): object {
  return {
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                ...entries.map((e, i) => ({
                  entryId: `tweet-${i}`,
                  sortIndex: e.sortIndex,
                  content: {
                    entryType: "TimelineTimelineItem",
                    itemContent: { itemType: "TimelineTweet", tweet_results: { result: e.tweet } },
                  },
                })),
                { entryId: "cursor-bottom-0", sortIndex: "1", content: { entryType: "TimelineTimelineCursor", value: "c", cursorType: "Bottom" } },
              ],
            },
          ],
        },
      },
    },
  };
}

export function timelineResponse(tweets: object[]): object {
  return {
    data: {
      home: {
        home_timeline_urt: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: tweets.map((t, i) => ({
                entryId: `tweet-${i}`,
                sortIndex: String(9000 - i),
                content: { itemContent: { tweet_results: { result: t } } },
              })),
            },
          ],
        },
      },
    },
  };
}
