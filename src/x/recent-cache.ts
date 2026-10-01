import type { CapturedPost } from "../core/types";

/** 直前に画面に流れてきた投稿を覚えておく（古いものから捨てる） */
export class RecentPosts {
  private readonly map = new Map<string, CapturedPost>();

  constructor(private readonly limit = 500) {}

  add(posts: CapturedPost[]): void {
    for (const p of posts) {
      this.map.delete(p.id);
      this.map.set(p.id, p);
    }
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get(id: string): CapturedPost | undefined {
    return this.map.get(id);
  }

  get size(): number {
    return this.map.size;
  }
}
