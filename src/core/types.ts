export type Author = { id: string; handle: string; name: string; avatarUrl: string };
export type MediaItem = { type: "photo" | "video" | "gif"; url: string; thumbUrl: string };
export type LinkItem = { url: string; domain: string };
export type QuotedPost = { id: string; authorHandle: string; text: string };
export type AssignedBy = "manual" | "rule" | "ai";
export type FolderAssignment = { folderId: string; by: AssignedBy };

/** X から読み取った投稿の中身（利用者の整理状態は含まない） */
export type CapturedPost = {
  id: string;
  url: string;
  text: string;
  author: Author;
  postedAt: string;
  media: MediaItem[];
  links: LinkItem[];
  hashtags: string[];
  quoted?: QuotedPost;
  /** X のブクマ一覧での並び値（数字の文字列。新しいほど大きい） */
  bookmarkOrder?: string;
  /** ID と URL しか分からなかったとき true */
  partial?: boolean;
};

export type Post = CapturedPost & {
  capturedAt: string;
  folders: FolderAssignment[];
  /** 利用者が手でフォルダを出し入れしたら true。ルール・AI はこの投稿に手を出さない */
  sortedByUser: boolean;
  removedOnX: boolean;
  hidden: boolean;
  aiCheckedFoldersVersion?: number;
  review: { count: number; lastAt?: string };
};

export type Folder = { id: string; name: string; description: string; order: number; createdAt: string };

export type Condition =
  | { kind: "keyword"; value: string }
  | { kind: "author"; handle: string }
  | { kind: "hashtag"; tag: string }
  | { kind: "domain"; domain: string }
  | { kind: "hasMedia"; media: "any" | "photo" | "video" };

export type Rule = { id: string; folderId: string; conditions: Condition[]; enabled: boolean; order: number };

export type TodayReview = { date: string; postIds: string[]; doneIds: string[] };
export type ParseHealth = { lastOkAt?: string; lastErrorAt?: string; lastErrorOp?: string };

export type Settings = {
  pickerOnBookmark: boolean;
  aiEnabled: boolean;
  language: "auto" | "ja" | "en";
  reviewPerDay: number;
  /** フォルダの追加・削除・改名・説明変更で +1。AI の再判定に使う */
  foldersVersion: number;
  todayReview?: TodayReview;
  parseHealth: ParseHealth;
};

export const DEFAULT_SETTINGS: Settings = {
  pickerOnBookmark: true,
  aiEnabled: false,
  language: "auto",
  reviewPerDay: 5,
  foldersVersion: 1,
  parseHealth: {},
};
