import { useEffect } from "react";
import { localDateString, remainingReviewIds } from "../core/review";
import type { Folder, Post } from "../core/types";
import { addToFolder, setHidden } from "../db/posts";
import { completeReview, ensureTodayReview } from "../db/review-repo";
import { t } from "../i18n";
import { requestBadgeRefresh } from "./badge";
import { useSettings } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { PostCard } from "./PostCard";

const BUTTON = "rounded-lg bg-amber-700 px-3 py-1 text-sm text-white dark:bg-amber-600";
const SUBTLE = "rounded-lg px-3 py-1 text-sm hover:bg-amber-200 dark:hover:bg-stone-700";

/** 今日の積みツイ崩し（過去のブクマを毎日少しずつ見返す） */
export function ReviewStrip({ posts, folders }: { posts: Map<string, Post>; folders: Folder[] }) {
  const db = useDb();
  const run = useRun();
  const settings = useSettings();
  const today = localDateString(new Date());

  useEffect(() => {
    void run(async () => {
      await ensureTodayReview(db, today);
      requestBadgeRefresh();
    });
  }, [db, today, run]);

  const review = settings?.todayReview?.date === today ? settings.todayReview : undefined;
  if (!review || review.postIds.length === 0) return null;

  const remaining = remainingReviewIds(review)
    .map((id) => posts.get(id))
    .filter((p): p is Post => p !== undefined && !p.hidden);
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  const finish = (postId: string, before?: () => Promise<void>) =>
    void run(async () => {
      if (before) await before();
      await completeReview(db, postId, today, new Date().toISOString());
      requestBadgeRefresh();
    });

  return (
    <section aria-label={t("review.title")} className="rounded-2xl bg-amber-100 p-4 dark:bg-stone-800">
      <h2 className="font-bold">
        {t("review.title")}
        <span className="ml-2 text-sm font-normal text-stone-600 dark:text-stone-400">{t("review.left", { count: remaining.length })}</span>
      </h2>
      {remaining.length === 0 ? (
        <p className="mt-2">{t("review.done")}</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {remaining.map((post) => (
            <PostCard key={post.id} post={post} folders={folderMap}>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BUTTON} onClick={() => finish(post.id)}>
                  {t("review.seen")}
                </button>
                {folders.length > 0 && (
                  <select
                    aria-label={t("review.toFolder")}
                    value=""
                    onChange={(e) => {
                      const folderId = e.target.value;
                      if (folderId) finish(post.id, () => addToFolder(db, [post.id], folderId));
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-900"
                  >
                    <option value="">{t("review.toFolder")}</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className={SUBTLE} onClick={() => finish(post.id, () => setHidden(db, [post.id], true))}>
                  {t("review.hide")}
                </button>
              </div>
            </PostCard>
          ))}
        </div>
      )}
    </section>
  );
}
