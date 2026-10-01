import { useState } from "react";
import { LINKS } from "../config";
import { parseImport } from "../core/export-format";
import { hasParseWarning } from "../core/health";
import { localDateString } from "../core/review";
import { exportAll, importFile } from "../db/backup";
import { updateSettings } from "../db/settings";
import { t, type LanguageSetting } from "../i18n";
import { AiSettings } from "./AiSettings";
import { usePostCount, useSettings } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { IMPORT_ERROR_LABEL } from "./labels";

const BUTTON = "rounded-lg bg-amber-700 px-3 py-1.5 text-white dark:bg-amber-600";
const LINK = "text-amber-800 underline dark:text-amber-300";

/** 「設定」タブ */
export function SettingsPanel() {
  const db = useDb();
  const run = useRun();
  const settings = useSettings();
  const total = usePostCount();
  const [message, setMessage] = useState<string | null>(null);

  if (!settings) return null;

  const doExport = () =>
    void run(async () => {
      const file = await exportAll(db, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `twittana-${localDateString(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const doImport = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      const result = parseImport(await file.text());
      if (!result.ok) {
        setMessage(t(IMPORT_ERROR_LABEL[result.error]));
        return;
      }
      setMessage(t("settings.imported", await importFile(db, result.file)));
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {hasParseWarning(settings.parseHealth) && (
        <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100">
          {t("settings.health.warning", { op: settings.parseHealth.lastErrorOp ?? "?" })}
        </p>
      )}
      <p>{t("settings.stats", { count: total ?? 0 })}</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-amber-700"
          checked={settings.pickerOnBookmark}
          onChange={(e) => void run(() => updateSettings(db, { pickerOnBookmark: e.target.checked }))}
        />
        {t("settings.picker")}
      </label>
      <label className="flex items-center gap-2">
        {t("settings.reviewPerDay")}
        <input
          type="number"
          min={1}
          max={20}
          value={settings.reviewPerDay}
          onChange={(e) => {
            const n = Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 1));
            void run(() => updateSettings(db, { reviewPerDay: n }));
          }}
          className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1 dark:border-stone-600 dark:bg-stone-900"
        />
      </label>
      <label className="flex items-center gap-2">
        {t("settings.language")}
        <select
          value={settings.language}
          onChange={(e) => void run(() => updateSettings(db, { language: e.target.value as LanguageSetting }))}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 dark:border-stone-600 dark:bg-stone-900"
        >
          <option value="auto">{t("settings.language.auto")}</option>
          <option value="ja">{t("settings.language.ja")}</option>
          <option value="en">{t("settings.language.en")}</option>
        </select>
      </label>
      <AiSettings />
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{t("settings.backup")}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BUTTON} onClick={doExport}>
            {t("settings.export")}
          </button>
          <label className="flex items-center gap-2">
            {t("settings.import")}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                doImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{t("settings.about")}</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">{t("app.unofficial")}</p>
        <div className="flex gap-4">
          {LINKS.privacy && (
            <a href={LINKS.privacy} target="_blank" rel="noopener noreferrer" className={LINK}>
              {t("settings.privacy")}
            </a>
          )}
          {LINKS.donate && (
            <a href={LINKS.donate} target="_blank" rel="noopener noreferrer" className={LINK}>
              {t("settings.donate")}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
