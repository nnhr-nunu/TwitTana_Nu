import { useState } from "react";
import { createAiSession } from "../ai/language-model";
import { updateSettings } from "../db/settings";
import { t } from "../i18n";
import { useSettings } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { useAiAvailability } from "./useAiSorter";

const STATUS_KEY = {
  available: "ai.status.available",
  downloadable: "ai.status.downloadable",
  downloading: "ai.status.downloading",
  unavailable: "ai.status.unavailable",
} as const;

/** 設定タブの AI の項目 */
export function AiSettings() {
  const db = useDb();
  const run = useRun();
  const settings = useSettings();
  const [availability, refresh] = useAiAvailability();
  const [progress, setProgress] = useState<number | null>(null);

  if (!settings || !availability) return null;

  const prepare = () =>
    void run(async () => {
      setProgress(0);
      const session = await createAiSession((ratio) => setProgress(ratio));
      session.destroy();
      setProgress(null);
      await updateSettings(db, { aiEnabled: true });
      refresh();
    });

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{t("ai.title")}</h2>
      <p className="text-sm">{t(STATUS_KEY[availability])}</p>
      {availability !== "unavailable" && (
        <>
          <p className="text-sm text-stone-600 dark:text-stone-400">{t("ai.help")}</p>
          {availability === "available" ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-700"
                checked={settings.aiEnabled}
                onChange={(e) => void run(() => updateSettings(db, { aiEnabled: e.target.checked }))}
              />
              {t("ai.enable")}
            </label>
          ) : (
            <button type="button" className="rounded-lg bg-amber-700 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-amber-600" disabled={progress !== null} onClick={prepare}>
              {progress === null ? t("ai.prepare") : t("ai.progress", { percent: Math.round(progress * 100) })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
