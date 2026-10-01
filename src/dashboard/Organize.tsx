import { FolderEditor } from "./FolderEditor";
import { RuleEditor } from "./RuleEditor";

/** 「フォルダとルール」タブ */
export function Organize() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <FolderEditor />
      <RuleEditor />
    </div>
  );
}
