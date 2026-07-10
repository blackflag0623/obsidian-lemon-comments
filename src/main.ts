import {
  Component,
  MarkdownPostProcessorContext,
  MarkdownView,
  Notice,
  Plugin,
  TAbstractFile,
  TFile
} from "obsidian";
import {
  buildTextMap,
  createAnchorFromRange,
  getRangeEndRect,
  getRangeRect,
  locateAnchor,
  overlapsClaim,
  unwrapHighlights,
  wrapOffsets,
  type LocatedAnchor
} from "./anchor";
import { CommentManagerModal } from "./manager";
import {
  CommentEditorPopover,
  CommentHoverPopover,
  SelectionToolbarPopover
} from "./popovers";
import { ReadingCommentsSettingTab } from "./settings";
import {
  normalizePluginData,
  type ReadingComment,
  type ReadingCommentsData,
  type ReadingCommentsSettings,
  type TextQuoteAnchor
} from "./types";

const MAX_SELECTION_LENGTH = 2_000;
const FORBIDDEN_SELECTION_SELECTOR =
  "pre, .internal-embed, .math, canvas, iframe";

export default class ReadingCommentsPlugin extends Plugin {
  private data: ReadingCommentsData = normalizePluginData(null);
  private controllers = new Map<HTMLElement, RootDecorationController>();
  private renderFrames = new Map<HTMLElement, number>();
  private documentControllers = new Map<
    Document,
    DocumentSelectionController
  >();
  private locationState = new Map<string, Set<string>>();
  private selectionToolbar: SelectionToolbarPopover | null = null;
  private editor: CommentEditorPopover | null = null;
  private hover: CommentHoverPopover | null = null;
  private hoverCommentId: string | null = null;
  private hoverSpans: HTMLElement[] = [];
  private hoverOpenTimer: number | null = null;
  private hoverOpenWindow: Window | null = null;
  private hoverCloseTimer: number | null = null;
  private hoverCloseWindow: Window | null = null;

  get pluginSettings(): ReadingCommentsSettings {
    return this.data.settings;
  }

  async onload(): Promise<void> {
    this.data = normalizePluginData(await this.loadData());
    this.addSettingTab(new ReadingCommentsSettingTab(this.app, this));
    this.attachSelectionListeners(document);
    if (typeof activeDocument !== "undefined") {
      this.attachSelectionListeners(activeDocument);
    }

    this.registerMarkdownPostProcessor(
      (element: HTMLElement, context: MarkdownPostProcessorContext) => {
        if (element.closest(".internal-embed") !== null) {
          return;
        }

        const root = element.closest<HTMLElement>(
          ".markdown-reading-view .markdown-preview-view.markdown-rendered"
        );
        if (root !== null) {
          this.scheduleRootRender(root, context.sourcePath);
        }
      }
    );

    this.registerEvent(
      this.app.workspace.on("window-open", (_workspaceWindow, win) => {
        this.attachSelectionListeners(win.document);
        this.applySettingsToDocument(win.document);
      })
    );
    this.registerEvent(
      this.app.workspace.on("window-close", (_workspaceWindow, win) => {
        this.detachSelectionListeners(win.document);
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.closeSelectionToolbar();
        this.pruneControllers();
        this.refreshAllReadingViews();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        void this.handleFileRename(file, oldPath);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        void this.handleFileDelete(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.refreshPath(file.path);
        }
      })
    );

    this.addCommand({
      id: "manage-current-note-comments",
      name: "管理当前笔记的阅读评论",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file === null || view?.file === undefined) {
          return false;
        }

        if (!checking) {
          new CommentManagerModal(this, view.file.path).open();
        }
        return true;
      }
    });

    this.applySettingsToDocument(document);
    this.refreshAllReadingViews();
  }

  onunload(): void {
    this.closeSelectionToolbar();
    this.closeEditor();
    this.closeHover();
    for (const controller of this.controllers.values()) {
      controller.unload();
    }
    this.controllers.clear();

    for (const [root, frame] of this.renderFrames) {
      (root.ownerDocument.defaultView ?? window).cancelAnimationFrame(frame);
    }
    this.renderFrames.clear();

    for (const doc of this.documentControllers.keys()) {
      doc.body.style.removeProperty("--reading-comments-color");
    }
    for (const controller of this.documentControllers.values()) {
      this.removeChild(controller);
    }
    this.documentControllers.clear();
  }

  async saveSettings(): Promise<void> {
    try {
      await this.saveData(this.data);
      for (const doc of this.documentControllers.keys()) {
        this.applySettingsToDocument(doc);
      }
      this.refreshAllReadingViews();
    } catch (error) {
      console.error("Reading Comments: failed to save settings", error);
      new Notice("阅读评论设置保存失败，请查看控制台。");
    }
  }

  getComments(sourcePath: string): readonly ReadingComment[] {
    return this.data.commentsByPath[sourcePath] ?? [];
  }

  isCommentLocated(sourcePath: string, commentId: string): boolean | null {
    const state = this.locationState.get(sourcePath);
    return state === undefined ? null : state.has(commentId);
  }

  openCommentEditorById(
    sourcePath: string,
    commentId: string,
    rect: DOMRect,
    doc: Document = document
  ): void {
    const comment = this.findComment(sourcePath, commentId);
    if (comment === null) {
      new Notice("这条评论已经不存在。");
      return;
    }

    this.openEditorForComment(sourcePath, comment, () => rect, doc);
  }

  async deleteComment(
    sourcePath: string,
    commentId: string
  ): Promise<boolean> {
    const comments = this.data.commentsByPath[sourcePath];
    if (comments === undefined) {
      return true;
    }

    const index = comments.findIndex((comment) => comment.id === commentId);
    if (index === -1) {
      return true;
    }

    const [removed] = comments.splice(index, 1);
    if (comments.length === 0) {
      delete this.data.commentsByPath[sourcePath];
    }

    try {
      await this.saveData(this.data);
      this.closeHover();
      this.refreshPath(sourcePath);
      new Notice("评论已删除。");
      return true;
    } catch (error) {
      console.error("Reading Comments: failed to delete comment", error);
      const restored = this.data.commentsByPath[sourcePath] ?? [];
      if (removed !== undefined) {
        restored.splice(index, 0, removed);
      }
      this.data.commentsByPath[sourcePath] = restored;
      new Notice("评论删除失败，请查看控制台。");
      return false;
    }
  }

  setLocationState(sourcePath: string, locatedIds: Set<string>): void {
    this.locationState.set(sourcePath, locatedIds);
  }

  queueHover(
    sourcePath: string,
    comment: ReadingComment,
    target: HTMLElement,
    spans: HTMLElement[],
    immediate = false
  ): void {
    if (this.editor !== null) {
      return;
    }

    this.cancelHoverClose();
    if (this.hoverCommentId === comment.id && this.hover !== null) {
      return;
    }

    this.cancelHoverOpen();
    const win = target.ownerDocument.defaultView ?? window;
    const open = () => {
      this.hoverOpenTimer = null;
      this.hoverOpenWindow = null;
      this.openHover(sourcePath, comment, target, spans);
    };

    if (immediate || this.pluginSettings.hoverDelay === 0) {
      open();
    } else {
      this.hoverOpenWindow = win;
      this.hoverOpenTimer = win.setTimeout(
        open,
        this.pluginSettings.hoverDelay
      );
    }
  }

  queueHoverClose(): void {
    this.cancelHoverOpen();
    this.cancelHoverClose();
    const doc = this.hoverSpans[0]?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    this.hoverCloseWindow = win;
    this.hoverCloseTimer = win.setTimeout(() => {
      this.hoverCloseTimer = null;
      this.hoverCloseWindow = null;
      this.closeHover();
    }, 180);
  }

  cancelHoverClose(): void {
    if (this.hoverCloseTimer === null) {
      return;
    }

    (this.hoverCloseWindow ?? window).clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = null;
    this.hoverCloseWindow = null;
  }

  openEditorForComment(
    sourcePath: string,
    comment: ReadingComment,
    getAnchorRect: () => DOMRect,
    doc: Document
  ): void {
    this.closeSelectionToolbar();
    this.closeHover();
    this.closeEditor();

    const editor = new CommentEditorPopover({
      app: this.app,
      document: doc,
      sourcePath,
      initialValue: comment.body,
      isEditing: true,
      popupWidth: this.pluginSettings.popupWidth,
      popupHeight: this.pluginSettings.popupHeight,
      autoFitHeight: this.pluginSettings.autoFitPopupHeight,
      getAnchorRect,
      onSubmit: async (body) =>
        this.updateComment(sourcePath, comment.id, body),
      onDelete: async () => this.deleteComment(sourcePath, comment.id),
      onCancel: () => {
        this.editor = null;
      }
    });
    this.editor = editor;
    editor.register(() => {
      if (this.editor === editor) {
        this.editor = null;
      }
    });
    editor.load();
  }

  private attachSelectionListeners(doc: Document): void {
    if (this.documentControllers.has(doc)) {
      return;
    }

    const controller = new DocumentSelectionController(
      doc,
      () => this.handleSelection(doc)
    );
    this.documentControllers.set(doc, controller);
    this.addChild(controller);
  }

  private detachSelectionListeners(doc: Document): void {
    const controller = this.documentControllers.get(doc);
    if (controller === undefined) {
      return;
    }

    doc.body.style.removeProperty("--reading-comments-color");
    this.closeSelectionToolbarForDocument(doc);
    this.removeChild(controller);
    this.documentControllers.delete(doc);
  }

  private handleSelection(doc: Document): void {
    if (this.editor !== null) {
      return;
    }

    const selection = doc.getSelection();
    if (
      selection === null ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      this.closeSelectionToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    const ancestor =
      range.commonAncestorContainer.nodeType === 1
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
    const root = ancestor?.closest<HTMLElement>(
      ".markdown-reading-view .markdown-preview-view.markdown-rendered"
    );
    if (
      root === null ||
      root === undefined ||
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      this.closeSelectionToolbar();
      return;
    }

    if (this.rangeIntersectsSelector(range, root, FORBIDDEN_SELECTION_SELECTOR)) {
      this.closeSelectionToolbar();
      new Notice("嵌入内容、代码块或公式暂不支持添加阅读评论。");
      return;
    }
    if (
      this.rangeIntersectsSelector(
        range,
        root,
        ".reading-comment-highlight"
      )
    ) {
      this.closeSelectionToolbar();
      new Notice("评论不能与已有评论重叠；点击高亮文字可编辑原评论。");
      return;
    }

    const anchored = createAnchorFromRange(root, range);
    if (anchored === null) {
      this.closeSelectionToolbar();
      return;
    }
    if (anchored.anchor.exact.length > MAX_SELECTION_LENGTH) {
      this.closeSelectionToolbar();
      new Notice(`单条评论最多可关联 ${MAX_SELECTION_LENGTH} 个字符。`);
      return;
    }

    const view = this.findViewForRoot(root);
    if (view?.file === null || view?.file === undefined) {
      this.closeSelectionToolbar();
      new Notice("无法确定当前笔记，评论未创建。");
      return;
    }

    const sourcePath = view.file.path;
    const selectionRange = anchored.range.cloneRange();
    this.closeHover();
    this.closeSelectionToolbar();
    const toolbar = new SelectionToolbarPopover({
      document: doc,
      getAnchorRect: () => getRangeEndRect(selectionRange),
      onAddComment: () => {
        this.closeSelectionToolbar();
        this.openNewCommentEditor(
          sourcePath,
          anchored.anchor,
          selectionRange,
          doc
        );
      }
    });
    this.selectionToolbar = toolbar;
    toolbar.register(() => {
      if (this.selectionToolbar === toolbar) {
        this.selectionToolbar = null;
      }
    });
    toolbar.load();
  }

  private openNewCommentEditor(
    sourcePath: string,
    anchor: TextQuoteAnchor,
    selectionRange: Range,
    doc: Document
  ): void {
    this.closeEditor();
    const editor = new CommentEditorPopover({
      app: this.app,
      document: doc,
      sourcePath,
      initialValue: "",
      isEditing: false,
      popupWidth: this.pluginSettings.popupWidth,
      popupHeight: this.pluginSettings.popupHeight,
      autoFitHeight: this.pluginSettings.autoFitPopupHeight,
      getAnchorRect: () => getRangeRect(selectionRange),
      onSubmit: async (body) =>
        this.createComment(sourcePath, anchor, body),
      onCancel: () => {
        this.editor = null;
      }
    });
    this.editor = editor;
    editor.register(() => {
      if (this.editor === editor) {
        this.editor = null;
      }
    });
    editor.load();
  }

  private rangeIntersectsSelector(
    range: Range,
    root: HTMLElement,
    selector: string
  ): boolean {
    return Array.from(root.querySelectorAll(selector)).some((element) =>
      range.intersectsNode(element)
    );
  }

  private async createComment(
    sourcePath: string,
    anchor: TextQuoteAnchor,
    body: string
  ): Promise<boolean> {
    if (body.length === 0) {
      return true;
    }

    const now = Date.now();
    const comment: ReadingComment = {
      id: createId(),
      anchor,
      body,
      createdAt: now,
      updatedAt: now
    };
    const comments = this.data.commentsByPath[sourcePath] ?? [];
    comments.push(comment);
    this.data.commentsByPath[sourcePath] = comments;

    try {
      await this.saveData(this.data);
      this.clearDocumentSelection();
      this.refreshPath(sourcePath);
      new Notice("评论已添加。");
      return true;
    } catch (error) {
      console.error("Reading Comments: failed to create comment", error);
      const index = comments.indexOf(comment);
      if (index !== -1) {
        comments.splice(index, 1);
      }
      if (comments.length === 0) {
        delete this.data.commentsByPath[sourcePath];
      }
      new Notice("评论保存失败，请查看控制台。");
      return false;
    }
  }

  private async updateComment(
    sourcePath: string,
    commentId: string,
    body: string
  ): Promise<boolean> {
    const comment = this.findComment(sourcePath, commentId);
    if (comment === null) {
      new Notice("这条评论已经不存在。");
      return false;
    }

    const previousBody = comment.body;
    const previousUpdatedAt = comment.updatedAt;
    comment.body = body;
    comment.updatedAt = Date.now();

    try {
      await this.saveData(this.data);
      this.refreshPath(sourcePath);
      new Notice("评论已更新。");
      return true;
    } catch (error) {
      console.error("Reading Comments: failed to update comment", error);
      comment.body = previousBody;
      comment.updatedAt = previousUpdatedAt;
      new Notice("评论更新失败，请查看控制台。");
      return false;
    }
  }

  private findComment(
    sourcePath: string,
    commentId: string
  ): ReadingComment | null {
    return (
      this.data.commentsByPath[sourcePath]?.find(
        (comment) => comment.id === commentId
      ) ?? null
    );
  }

  private openHover(
    sourcePath: string,
    comment: ReadingComment,
    target: HTMLElement,
    spans: HTMLElement[]
  ): void {
    this.closeHover();
    this.hoverCommentId = comment.id;
    this.hoverSpans = spans;
    for (const span of spans) {
      span.addClass("is-active");
    }

    const hover = new CommentHoverPopover({
      app: this.app,
      document: target.ownerDocument,
      sourcePath,
      markdown: comment.body,
      getAnchorRect: () => target.getBoundingClientRect(),
      onPointerEnter: () => this.cancelHoverClose(),
      onPointerLeave: () => this.queueHoverClose(),
      onEdit: () => {
        const rect = target.getBoundingClientRect();
        this.closeHover();
        this.openEditorForComment(
          sourcePath,
          comment,
          () => rect,
          target.ownerDocument
        );
      }
    });
    this.hover = hover;
    hover.register(() => {
      if (this.hover === hover) {
        this.hover = null;
      }
    });
    hover.load();
  }

  private closeHover(): void {
    this.cancelHoverOpen();
    this.cancelHoverClose();
    for (const span of this.hoverSpans) {
      span.removeClass("is-active");
    }
    this.hoverSpans = [];
    this.hoverCommentId = null;

    const hover = this.hover;
    this.hover = null;
    hover?.unload();
  }

  private closeEditor(): void {
    const editor = this.editor;
    this.editor = null;
    editor?.unload();
  }

  private closeSelectionToolbar(): void {
    const toolbar = this.selectionToolbar;
    this.selectionToolbar = null;
    toolbar?.unload();
  }

  private closeSelectionToolbarForDocument(doc: Document): void {
    if (this.selectionToolbar === null) {
      return;
    }

    const toolbarElement = doc.querySelector(".reading-comment-selection-toolbar");
    if (toolbarElement !== null) {
      this.closeSelectionToolbar();
    }
  }

  private cancelHoverOpen(): void {
    if (this.hoverOpenTimer === null) {
      return;
    }

    (this.hoverOpenWindow ?? window).clearTimeout(this.hoverOpenTimer);
    this.hoverOpenTimer = null;
    this.hoverOpenWindow = null;
  }

  private scheduleRootRender(root: HTMLElement, sourcePath: string): void {
    const existing = this.renderFrames.get(root);
    const win = root.ownerDocument.defaultView ?? window;
    if (existing !== undefined) {
      win.cancelAnimationFrame(existing);
    }

    const frame = win.requestAnimationFrame(() => {
      this.renderFrames.delete(root);
      if (!root.isConnected) {
        return;
      }

      this.applySettingsToDocument(root.ownerDocument);
      this.controllers.get(root)?.unload();
      const controller = new RootDecorationController(
        root,
        sourcePath,
        this
      );
      this.controllers.set(root, controller);
      controller.load();
    });
    this.renderFrames.set(root, frame);
  }

  private refreshPath(sourcePath: string): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (
        view instanceof MarkdownView &&
        view.file?.path === sourcePath &&
        view.getMode() === "preview"
      ) {
        const root = view.containerEl.querySelector<HTMLElement>(
          ".markdown-reading-view .markdown-preview-view.markdown-rendered"
        );
        if (root !== null) {
          this.scheduleRootRender(root, sourcePath);
        }
      }
    }
  }

  private refreshAllReadingViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (
        view instanceof MarkdownView &&
        view.file !== null &&
        view.getMode() === "preview"
      ) {
        const root = view.containerEl.querySelector<HTMLElement>(
          ".markdown-reading-view .markdown-preview-view.markdown-rendered"
        );
        if (root !== null) {
          this.scheduleRootRender(root, view.file.path);
        }
      }
    }
  }

  private findViewForRoot(root: HTMLElement): MarkdownView | null {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.containerEl.contains(root)) {
        return view;
      }
    }
    return null;
  }

  private pruneControllers(): void {
    for (const [root, controller] of this.controllers) {
      if (!root.isConnected) {
        controller.unload();
        this.controllers.delete(root);
      }
    }
  }

  private applySettingsToDocument(doc: Document): void {
    this.attachSelectionListeners(doc);
    doc.body.style.setProperty(
      "--reading-comments-color",
      this.pluginSettings.highlightColor
    );
  }

  private clearDocumentSelection(): void {
    for (const doc of this.documentControllers.keys()) {
      doc.getSelection()?.removeAllRanges();
    }
  }

  private async handleFileRename(
    file: TAbstractFile,
    oldPath: string
  ): Promise<void> {
    if (!(file instanceof TFile)) {
      return;
    }

    const comments = this.data.commentsByPath[oldPath];
    if (comments === undefined) {
      return;
    }

    const previousAtDestination = this.data.commentsByPath[file.path];
    this.data.commentsByPath[file.path] = comments;
    delete this.data.commentsByPath[oldPath];
    try {
      await this.saveData(this.data);
      this.locationState.delete(oldPath);
      this.refreshPath(file.path);
    } catch (error) {
      console.error("Reading Comments: failed to migrate renamed file", error);
      this.data.commentsByPath[oldPath] = comments;
      if (previousAtDestination === undefined) {
        delete this.data.commentsByPath[file.path];
      } else {
        this.data.commentsByPath[file.path] = previousAtDestination;
      }
      new Notice("文件已重命名，但阅读评论迁移失败。");
    }
  }

  private async handleFileDelete(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile)) {
      return;
    }

    const comments = this.data.commentsByPath[file.path];
    if (comments === undefined) {
      return;
    }

    delete this.data.commentsByPath[file.path];
    try {
      await this.saveData(this.data);
      this.locationState.delete(file.path);
    } catch (error) {
      console.error("Reading Comments: failed to remove deleted file data", error);
      this.data.commentsByPath[file.path] = comments;
      new Notice("文件已删除，但其阅读评论数据清理失败。");
    }
  }
}

class RootDecorationController extends Component {
  private spans: HTMLElement[] = [];
  private touchClickSuppressedUntil = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly sourcePath: string,
    private readonly plugin: ReadingCommentsPlugin
  ) {
    super();
  }

  onload(): void {
    unwrapHighlights(this.root);
    const comments = [...this.plugin.getComments(this.sourcePath)].sort(
      (left, right) => left.createdAt - right.createdAt
    );
    const map = buildTextMap(this.root);
    const claims: LocatedAnchor[] = [];
    const locatedIds = new Set<string>();
    const matches: Array<{
      comment: ReadingComment;
      location: LocatedAnchor;
    }> = [];

    for (const comment of comments) {
      const location = locateAnchor(map, comment.anchor);
      if (location === null || overlapsClaim(location, claims)) {
        continue;
      }

      claims.push(location);
      locatedIds.add(comment.id);
      matches.push({ comment, location });
    }

    this.plugin.setLocationState(this.sourcePath, locatedIds);
    matches.sort((left, right) => right.location.start - left.location.start);
    for (const match of matches) {
      const spans = wrapOffsets(
        this.root,
        match.location.start,
        match.location.end,
        match.comment.id
      );
      this.spans.push(...spans);
      this.bindComment(match.comment, spans);
    }
  }

  onunload(): void {
    unwrapHighlights(this.root);
    this.spans = [];
  }

  private bindComment(comment: ReadingComment, spans: HTMLElement[]): void {
    for (let index = 0; index < spans.length; index += 1) {
      const span = spans[index];
      if (span === undefined) {
        continue;
      }

      span.setAttribute("role", "button");
      span.setAttribute("aria-label", "有评论；按 Enter 编辑");
      span.tabIndex = index === 0 ? 0 : -1;

      this.registerDomEvent(span, "pointerenter", () => {
        this.plugin.queueHover(this.sourcePath, comment, span, spans);
      });
      this.registerDomEvent(span, "pointerleave", () => {
        this.plugin.queueHoverClose();
      });
      this.registerDomEvent(span, "focus", () => {
        this.plugin.queueHover(this.sourcePath, comment, span, spans, true);
      });
      this.registerDomEvent(span, "blur", () => {
        this.plugin.queueHoverClose();
      });
      this.registerDomEvent(span, "pointerup", (event) => {
        if (event.pointerType === "touch") {
          event.preventDefault();
          this.touchClickSuppressedUntil = Date.now() + 500;
          this.plugin.queueHover(this.sourcePath, comment, span, spans, true);
        }
      });
      this.registerDomEvent(span, "click", (event) => {
        if (Date.now() < this.touchClickSuppressedUntil) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        this.plugin.openEditorForComment(
          this.sourcePath,
          comment,
          () => span.getBoundingClientRect(),
          span.ownerDocument
        );
      });
      this.registerDomEvent(span, "keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        this.plugin.openEditorForComment(
          this.sourcePath,
          comment,
          () => span.getBoundingClientRect(),
          span.ownerDocument
        );
      });
    }
  }
}

class DocumentSelectionController extends Component {
  constructor(
    private readonly doc: Document,
    private readonly handleSelection: () => void
  ) {
    super();
  }

  onload(): void {
    this.registerDomEvent(this.doc, "pointerup", (event) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      const elementConstructor = this.doc.defaultView?.Element;
      if (
        elementConstructor !== undefined &&
        target instanceof elementConstructor &&
        target.closest(".reading-comments-ui") !== null
      ) {
        return;
      }

      (this.doc.defaultView ?? window).setTimeout(this.handleSelection, 0);
    });
    this.registerDomEvent(this.doc, "keyup", (event) => {
      if (
        event.shiftKey &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        (this.doc.defaultView ?? window).setTimeout(this.handleSelection, 0);
      }
    });
  }
}

function createId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
