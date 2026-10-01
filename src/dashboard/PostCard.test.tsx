// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../core/types";
import { makePost } from "../test/factories";
import { PostCard } from "./PostCard";

afterEach(cleanup);

const folders = new Map<string, Folder>([
  ["a", { id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" }],
  ["b", { id: "b", name: "料理", description: "", order: 1, createdAt: "" }],
]);

describe("PostCard", () => {
  it("本文・投稿者・フォルダ（AI やルールの印つき）・X へのリンクを出す", () => {
    const post = makePost({
      id: "1",
      text: "おもしろい",
      folders: [
        { folderId: "a", by: "manual" },
        { folderId: "b", by: "ai" },
        { folderId: "gone", by: "rule" },
      ],
    });
    render(<PostCard post={post} folders={folders} />);
    expect(screen.getByText("おもしろい")).toBeTruthy();
    expect(screen.getByText("@someone")).toBeTruthy();
    expect(screen.getByText("ゲーム")).toBeTruthy();
    expect(screen.getByText("料理").textContent).toBe("料理AI");
    const link = screen.getByRole("link", { name: "X で開く" });
    expect(link.getAttribute("href")).toBe("https://x.com/someone/status/1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("解除済みの印と、中身が無いときの案内", () => {
    render(<PostCard post={makePost({ removedOnX: true, partial: true, text: "" })} folders={folders} />);
    expect(screen.getByText("X で解除済み")).toBeTruthy();
    expect(screen.getByText("中身は、X のブックマーク画面を開くと入ります")).toBeTruthy();
  });

  it("選ぶチェックを押すと知らせる", () => {
    const onSelect = vi.fn();
    render(<PostCard post={makePost()} folders={folders} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "この投稿を選ぶ" }));
    expect(onSelect).toHaveBeenCalledWith(true);
  });
});
