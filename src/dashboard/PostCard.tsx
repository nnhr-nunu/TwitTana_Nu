import type { ReactNode } from "react";
import type { Folder, Post } from "../core/types";
import { t } from "../i18n";

type Props = {
  post: Post;
  folders: Map<string, Folder>;
  selected?: boolean;
  onSelect?: (on: boolean) => void;
  children?: ReactNode;
};

/** 投稿 1 件の表示 */
export function PostCard({ post, folders, selected, onSelect, children }: Props) {
  const date = post.postedAt ? new Date(post.postedAt).toLocaleDateString() : "";
  return (
    <article className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-amber-700"
            aria-label={t("post.select")}
            checked={!!selected}
            onChange={(e) => onSelect(e.target.checked)}
          />
        )}
        {post.author.avatarUrl && (
          <img src={post.author.avatarUrl} alt="" className="h-10 w-10 rounded-full" loading="lazy" referrerPolicy="no-referrer" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold">{post.author.name || post.author.handle}</span>
            {post.author.handle && <span className="text-stone-500">@{post.author.handle}</span>}
            {date && <span className="text-stone-500">{date}</span>}
            {post.removedOnX && (
              <span className="rounded bg-stone-200 px-1.5 text-xs dark:bg-stone-700">{t("post.removed")}</span>
            )}
          </div>
          {post.partial ? (
            <p className="mt-1 text-sm text-stone-500">{t("post.partial")}</p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words">{post.text}</p>
          )}
          {post.quoted && (
            <blockquote className="mt-2 rounded-lg border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900">
              <span className="text-stone-500">{t("post.quoted", { handle: post.quoted.authorHandle })}</span>
              <span className="mt-1 block whitespace-pre-wrap break-words">{post.quoted.text}</span>
            </blockquote>
          )}
          {post.media.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {post.media.map((m, i) => (
                <img
                  key={`${i}-${m.thumbUrl}`}
                  src={m.thumbUrl}
                  alt=""
                  className="h-24 rounded-lg object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {post.folders.map((a) => {
              const folder = folders.get(a.folderId);
              if (!folder) return null;
              return (
                <span key={a.folderId} className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-stone-700">
                  {folder.name}
                  {a.by !== "manual" && (
                    <span className="ml-1 font-bold text-amber-700 dark:text-amber-300">{t(a.by === "ai" ? "post.by.ai" : "post.by.rule")}</span>
                  )}
                </span>
              );
            })}
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-amber-800 underline dark:text-amber-300">
              {t("post.open")}
            </a>
          </div>
          {children}
        </div>
      </div>
    </article>
  );
}
