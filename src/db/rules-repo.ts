import { withRuleFolders } from "../core/rules";
import type { Post, Rule } from "../core/types";
import type { TwitTanaDB } from "./schema";

export async function listRules(db: TwitTanaDB): Promise<Rule[]> {
  return (await db.rules.toArray()).sort((a, b) => a.order - b.order);
}

/** ルールを作る（id なし）か更新する（id あり）。並び順は新規なら末尾、更新なら保つ */
export async function saveRule(
  db: TwitTanaDB,
  input: { id?: string; folderId: string; conditions: Rule["conditions"]; enabled: boolean },
): Promise<Rule> {
  return db.transaction("rw", [db.rules, db.folders], async () => {
    if (!(await db.folders.get(input.folderId))) throw new Error(`folder not found: ${input.folderId}`);
    const current = input.id ? await db.rules.get(input.id) : undefined;
    const all = await db.rules.toArray();
    const order = current?.order ?? all.reduce((max, r) => Math.max(max, r.order), -1) + 1;
    const rule: Rule = {
      id: current?.id ?? crypto.randomUUID(),
      folderId: input.folderId,
      conditions: input.conditions,
      enabled: input.enabled,
      order,
    };
    await db.rules.put(rule);
    return rule;
  });
}

export async function deleteRule(db: TwitTanaDB, id: string): Promise<void> {
  await db.rules.delete(id);
}

/** どのフォルダにも入っておらず、手で整理していない投稿にルールを当てる。変わった件数を返す */
export async function applyRulesToUnsorted(db: TwitTanaDB): Promise<number> {
  return db.transaction("rw", [db.posts, db.rules], async () => {
    const rules = await db.rules.toArray();
    const targets = await db.posts.filter((p) => p.folders.length === 0 && !p.sortedByUser).toArray();
    const changed = targets.map((p) => withRuleFolders(p, rules)).filter((p): p is Post => p !== null);
    await db.posts.bulkPut(changed);
    return changed.length;
  });
}
