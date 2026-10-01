import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { aiAvailability, classifierFrom, createAiSession, type AiAvailability } from "../ai/language-model";
import { runAiSorting } from "../core/ai-runner";
import { aiCandidates, aiFolders, countAiCandidates, recordAiResult } from "../db/ai-repo";
import { useSettings } from "./data";
import { useDb } from "./db-context";

/** この PC で AI が使えるか（調べている間は undefined）。refresh で調べ直す */
export function useAiAvailability(): [AiAvailability | undefined, () => void] {
  const [availability, setAvailability] = useState<AiAvailability>();
  const refresh = useCallback(() => {
    void aiAvailability().then(setAvailability);
  }, []);
  useEffect(refresh, [refresh]);
  return [availability, refresh];
}

export type AiSorterState = { status: "idle" | "running" | "finished" | "stopped"; done: number; sorted: number };

/** 本棚画面を開いている間、未整理を AI で振り分ける。設定でオンかつ使えるときは自動で始める */
export function useAiSorter(): { state: AiSorterState; waiting: number | undefined; start(): void; usable: boolean } {
  const db = useDb();
  const settings = useSettings();
  const [availability] = useAiAvailability();
  const [state, setState] = useState<AiSorterState>({ status: "idle", done: 0, sorted: 0 });
  const running = useRef(false);
  const stopped = useRef(false);
  const version = settings?.foldersVersion;
  const waiting = useLiveQuery(() => (version === undefined ? undefined : countAiCandidates(db, version)), [db, version]);
  const usable = availability === "available" && settings?.aiEnabled === true;

  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, []);

  const start = useCallback(() => {
    if (running.current || version === undefined) return;
    running.current = true;
    setState({ status: "running", done: 0, sorted: 0 });
    void (async () => {
      try {
        const classify = classifierFrom(await createAiSession());
        const result = await runAiSorting({
          folders: () => aiFolders(db),
          candidates: () => aiCandidates(db, version),
          classify,
          record: (postId, folderId) => recordAiResult(db, postId, folderId, version),
          shouldStop: () => stopped.current,
          onProgress: (p) => setState({ status: "running", ...p }),
        });
        setState({ status: result.stoppedByErrors ? "stopped" : "finished", done: result.done, sorted: result.sorted });
      } catch {
        setState((s) => ({ ...s, status: "stopped" }));
      } finally {
        running.current = false;
      }
    })();
  }, [db, version]);

  useEffect(() => {
    if (usable && waiting !== undefined && waiting > 0 && state.status === "idle") start();
  }, [usable, waiting, state.status, start]);

  return { state, waiting, start, usable };
}
