import { createContext, useCallback, useContext } from "react";
import { t } from "../i18n";

const ErrorContext = createContext<(message: string) => void>(() => {});

/** DB 操作の失敗を画面上部に出す先 */
export const ErrorProvider = ErrorContext.Provider;

/** DB 操作を実行し、失敗したら画面上部に理由を出す */
export function useRun() {
  const report = useContext(ErrorContext);
  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await action();
      } catch (e) {
        report(t("error.generic", { message: e instanceof Error ? e.message : String(e) }));
        return undefined;
      }
    },
    [report],
  );
}
