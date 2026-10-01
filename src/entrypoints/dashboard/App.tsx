import { useEffect, useState } from "react";
import { requestBadgeRefresh } from "../../dashboard/badge";
import { useSettings } from "../../dashboard/data";
import { ErrorProvider } from "../../dashboard/errors";
import { Organize } from "../../dashboard/Organize";
import { SettingsPanel } from "../../dashboard/SettingsPanel";
import { Shelf } from "../../dashboard/Shelf";
import { setLanguage, t, type MessageKey } from "../../i18n";

type Tab = "shelf" | "organize" | "settings";
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "shelf", label: "tab.shelf" },
  { id: "organize", label: "tab.organize" },
  { id: "settings", label: "tab.settings" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("shelf");
  const [error, setError] = useState<string | null>(null);
  const settings = useSettings();
  if (settings) {
    const language = setLanguage(settings.language);
    document.documentElement.lang = language;
  }

  useEffect(() => {
    requestBadgeRefresh();
  }, []);

  return (
    <ErrorProvider value={setError}>
      <div className="min-h-screen bg-amber-50 text-stone-800 dark:bg-stone-900 dark:text-stone-100">
        <header className="sticky top-0 z-20 border-b border-amber-200 bg-amber-50/95 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <h1 className="text-xl font-bold">{t("app.title")}</h1>
            <nav role="tablist" className="flex gap-1">
              {TABS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === x.id}
                  onClick={() => setTab(x.id)}
                  className={`rounded-lg px-3 py-1.5 ${tab === x.id ? "bg-amber-200 font-bold dark:bg-stone-700" : "hover:bg-amber-100 dark:hover:bg-stone-800"}`}
                >
                  {t(x.label)}
                </button>
              ))}
            </nav>
          </div>
        </header>
        {error && (
          <div role="alert" className="mx-auto mt-4 flex max-w-6xl items-start gap-3 rounded-xl bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="flex-1">{error}</p>
            <button type="button" className="underline" onClick={() => setError(null)}>
              {t("error.close")}
            </button>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-6 py-6">
          {tab === "shelf" ? <Shelf /> : tab === "organize" ? <Organize /> : <SettingsPanel />}
        </div>
      </div>
    </ErrorProvider>
  );
}
