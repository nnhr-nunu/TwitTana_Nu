import { useEffect, useState, type FormEvent } from "react";
import type { Folder } from "../../core/types";

export const PICKER_AUTO_CLOSE_MS = 8000;
export type PickerAnchor = { top: number; left: number } | null;
export type CreateFolderError = "empty" | "duplicate";

export type FolderPickerProps = {
  folders: Folder[];
  selected: string[];
  /** 画面上の位置。null なら画面の左下に出す */
  anchor: PickerAnchor;
  onToggle: (folderId: string, on: boolean) => void;
  onCreate: (name: string) => Promise<CreateFolderError | null>;
  onClose: () => void;
};

const ERROR_TEXT: Record<CreateFolderError, string> = {
  empty: "名前を入れてください",
  duplicate: "同じ名前のフォルダがあります",
};

/** ブクマした瞬間に出す、フォルダを選ぶ小さなメニュー */
export function FolderPicker({ folders, selected, anchor, onToggle, onCreate, onClose }: FolderPickerProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<CreateFolderError | null>(null);
  const [lastTouch, setLastTouch] = useState(0);

  useEffect(() => {
    const timer = setTimeout(onClose, PICKER_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [lastTouch, onClose]);

  const touch = () => setLastTouch((n) => n + 1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    touch();
    const result = await onCreate(name);
    setError(result);
    if (!result) setName("");
  };

  return (
    <div
      className={anchor ? "tt-picker" : "tt-picker tt-picker--corner"}
      style={anchor ? { top: anchor.top, left: anchor.left } : undefined}
      role="dialog"
      aria-label="ツイッ棚のフォルダ"
      onPointerEnter={touch}
      onPointerDown={touch}
      onKeyDown={touch}
    >
      <div className="tt-picker__head">
        <span>ツイッ棚に整理</span>
        <button type="button" className="tt-picker__close" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
      </div>
      {folders.length === 0 ? (
        <p className="tt-picker__empty">フォルダがまだありません</p>
      ) : (
        <ul className="tt-picker__list">
          {folders.map((f) => {
            const on = selected.includes(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className="tt-picker__chip"
                  aria-pressed={on}
                  onClick={() => {
                    touch();
                    onToggle(f.id, !on);
                  }}
                >
                  {f.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form className="tt-picker__new" onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => {
            touch();
            setName(e.target.value);
          }}
          placeholder="新しいフォルダ"
          aria-label="新しいフォルダの名前"
        />
        <button type="submit">追加</button>
      </form>
      {error && (
        <p className="tt-picker__error" role="alert">
          {ERROR_TEXT[error]}
        </p>
      )}
    </div>
  );
}
