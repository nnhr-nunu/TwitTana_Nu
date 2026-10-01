import { useState, type FormEvent } from "react";
import { CONDITION_KINDS, conditionValue, draftToCondition, emptyDraft, MEDIA_CHOICES, type ConditionDraft, type ConditionKind } from "../core/condition-input";
import type { Condition } from "../core/types";
import { applyRulesToUnsorted, deleteRule, saveRule } from "../db/rules-repo";
import { t } from "../i18n";
import { useFolders, useRules } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { COND_LABEL, MEDIA_LABEL } from "./labels";

const FIELD = "rounded-lg border border-amber-300 bg-white px-2 py-1.5 dark:border-stone-600 dark:bg-stone-900";
const BUTTON = "rounded-lg bg-amber-700 px-3 py-1.5 text-white dark:bg-amber-600";
const SUBTLE = "rounded-lg px-3 py-1.5 hover:bg-amber-100 dark:hover:bg-stone-700";

function ConditionRow({ draft, onChange, onRemove }: { draft: ConditionDraft; onChange(d: ConditionDraft): void; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <select aria-label={t("rules.kind")} value={draft.kind} onChange={(e) => onChange(emptyDraft(e.target.value as ConditionKind))} className={FIELD}>
        {CONDITION_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(COND_LABEL[k])}
          </option>
        ))}
      </select>
      {draft.kind === "hasMedia" ? (
        <select aria-label={t(COND_LABEL.hasMedia)} value={draft.value} onChange={(e) => onChange({ ...draft, value: e.target.value })} className={FIELD}>
          {MEDIA_CHOICES.map((m) => (
            <option key={m} value={m}>
              {t(MEDIA_LABEL[m])}
            </option>
          ))}
        </select>
      ) : (
        <input aria-label={t(COND_LABEL[draft.kind])} value={draft.value} onChange={(e) => onChange({ ...draft, value: e.target.value })} className={`${FIELD} min-w-0 flex-1`} />
      )}
      {onRemove && (
        <button type="button" className={SUBTLE} aria-label={t("rules.removeCondition")} onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );
}

function describeCondition(c: Condition): string {
  return `${t(COND_LABEL[c.kind])}: ${c.kind === "hasMedia" ? t(MEDIA_LABEL[c.media]) : conditionValue(c)}`;
}

/** 自動振り分けのルールの一覧・追加・有効無効・削除・未整理への適用 */
export function RuleEditor() {
  const db = useDb();
  const run = useRun();
  const folders = useFolders();
  const rules = useRules();
  const [folderId, setFolderId] = useState("");
  const [drafts, setDrafts] = useState<ConditionDraft[]>([emptyDraft()]);
  const [message, setMessage] = useState<string | null>(null);

  if (!folders || !rules) return null;
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const target = folderId || folders[0]?.id || "";

  const save = (e: FormEvent) => {
    e.preventDefault();
    const conditions = drafts.map(draftToCondition).filter((c): c is Condition => c !== null);
    if (!target || conditions.length !== drafts.length || conditions.length === 0) {
      setMessage(t("rules.invalid"));
      return;
    }
    void run(async () => {
      await saveRule(db, { folderId: target, conditions, enabled: true });
      setDrafts([emptyDraft()]);
      setMessage(null);
    });
  };

  const applyNow = () =>
    void run(async () => {
      const count = await applyRulesToUnsorted(db);
      setMessage(t("rules.applied", { count }));
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{t("rules.title")}</h2>
      <p className="text-sm text-stone-600 dark:text-stone-400">{t("rules.help")}</p>
      {rules.length === 0 ? (
        <p className="text-stone-500">{t("rules.none")}</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white p-3 text-sm dark:border-stone-700 dark:bg-stone-800">
              <span className="font-bold">{folderMap.get(r.folderId)?.name}</span>
              <span>←</span>
              {r.conditions.map((c, i) => (
                <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-stone-700">
                  {describeCondition(c)}
                </span>
              ))}
              <label className="ml-auto flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => void run(() => saveRule(db, { id: r.id, folderId: r.folderId, conditions: r.conditions, enabled: e.target.checked }))}
                />
                {t("rules.enabled")}
              </label>
              <button type="button" className={SUBTLE} onClick={() => void run(() => deleteRule(db, r.id))}>
                {t("rules.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {folders.length === 0 ? (
        <p className="text-stone-500">{t("rules.needFolder")}</p>
      ) : (
        <form onSubmit={save} className="space-y-2 rounded-xl bg-amber-100 p-3 dark:bg-stone-800">
          <label className="flex items-center gap-2">
            {t("rules.folder")}
            <select value={target} onChange={(e) => setFolderId(e.target.value)} className={FIELD}>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {drafts.map((d, i) => (
            <ConditionRow
              key={i}
              draft={d}
              onChange={(next) => setDrafts((ds) => ds.map((x, j) => (j === i ? next : x)))}
              onRemove={drafts.length > 1 ? () => setDrafts((ds) => ds.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          <div className="flex gap-2">
            <button type="button" className={SUBTLE} onClick={() => setDrafts((ds) => [...ds, emptyDraft()])}>
              {t("rules.addCondition")}
            </button>
            <button type="submit" className={BUTTON}>
              {t("rules.save")}
            </button>
          </div>
        </form>
      )}
      <button type="button" className={SUBTLE} onClick={applyNow}>
        {t("rules.applyNow")}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
