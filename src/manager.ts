import { Component, MarkdownRenderer, Modal, setIcon } from "obsidian";
import type ReadingCommentsPlugin from "./main";
import type { ReadingComment } from "./types";

export class CommentManagerModal extends Modal {
  private renderComponents: Component[] = [];

  constructor(
    private readonly readingComments: ReadingCommentsPlugin,
    private readonly sourcePath: string
  ) {
    super(readingComments.app);
  }

  onOpen(): void {
    this.setTitle("管理阅读评论");
    this.renderRows();
  }

  onClose(): void {
    this.unloadRenderComponents();
    this.contentEl.empty();
  }

  private renderRows(): void {
    this.unloadRenderComponents();
    this.contentEl.empty();
    this.contentEl.addClass("reading-comments-manager");

    const comments = this.readingComments.getComments(this.sourcePath);
    if (comments.length === 0) {
      this.contentEl.createDiv({
        cls: "reading-comments-manager__empty",
        text: "当前笔记还没有阅读评论。"
      });
      return;
    }

    this.contentEl.createDiv({
      cls: "reading-comments-manager__summary",
      text: `当前笔记共有 ${comments.length} 条评论。`
    });

    for (const comment of comments) {
      this.renderComment(comment);
    }
  }

  private renderComment(comment: ReadingComment): void {
    const row = this.contentEl.createDiv("reading-comments-manager__item");
    const header = row.createDiv("reading-comments-manager__item-header");
    const quote = header.createDiv("reading-comments-manager__quote");
    quote.setText(`“${truncate(comment.anchor.exact, 140)}”`);

    const location = this.readingComments.isCommentLocated(
      this.sourcePath,
      comment.id
    );
    if (location === false) {
      header.createSpan({
        cls: "reading-comments-manager__orphan",
        text: "未定位"
      });
    }

    const actions = header.createDiv("reading-comments-manager__actions");
    const editButton = actions.createEl("button", {
      attr: { "aria-label": "编辑评论", type: "button" }
    });
    setIcon(editButton, "pencil");

    const deleteButton = actions.createEl("button", {
      cls: "reading-comments-manager__delete",
      attr: { "aria-label": "删除评论", type: "button" }
    });
    setIcon(deleteButton, "trash-2");

    const markdown = row.createDiv(
      "reading-comments-manager__markdown markdown-rendered reading-comment-markdown"
    );
    const component = new Component();
    component.load();
    this.renderComponents.push(component);
    void MarkdownRenderer.render(
      this.app,
      comment.body,
      markdown,
      this.sourcePath,
      component
    ).catch((error) => {
      console.error("Lemon Comments: manager Markdown render failed", error);
      markdown.empty();
      markdown.setText("评论渲染失败。");
    });

    editButton.addEventListener("click", () => {
      const rect = row.getBoundingClientRect();
      const win = row.ownerDocument.defaultView ?? window;
      this.close();
      win.setTimeout(() => {
        this.readingComments.openCommentEditorById(
          this.sourcePath,
          comment.id,
          rect,
          row.ownerDocument
        );
      }, 0);
    });

    deleteButton.addEventListener("click", () => {
      void this.readingComments
        .deleteComment(this.sourcePath, comment.id)
        .then((success) => {
          if (success) {
            this.renderRows();
          }
        });
    });
  }

  private unloadRenderComponents(): void {
    for (const component of this.renderComponents) {
      component.unload();
    }
    this.renderComponents = [];
  }
}

function truncate(value: string, maximum: number): string {
  return value.length <= maximum
    ? value
    : `${value.slice(0, maximum - 1)}…`;
}
