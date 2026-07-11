import { App, Component, MarkdownRenderer, setIcon } from "obsidian";

interface SelectionToolbarOptions {
  doc: Document;
  getAnchorRect: () => DOMRect;
  onAddComment: () => void;
}

interface EditorPopoverOptions {
  app: App;
  doc: Document;
  sourcePath: string;
  initialValue: string;
  isEditing: boolean;
  popupWidth: number;
  popupHeight: number;
  autoFitHeight: boolean;
  getAnchorRect: () => DOMRect;
  onSubmit: (value: string) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onCancel: () => void;
}

interface HoverPopoverOptions {
  app: App;
  doc: Document;
  sourcePath: string;
  markdown: string;
  popupWidth: number;
  popupHeight: number;
  autoFitHeight: boolean;
  getAnchorRect: () => DOMRect;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onEdit: () => void;
}

type FloatingPlacement = "above" | "below";

export class SelectionToolbarPopover extends Component {
  private rootEl: HTMLElement | null = null;
  private outsideListenerTimer: number | null = null;

  constructor(private readonly options: SelectionToolbarOptions) {
    super();
  }

  onload(): void {
    const doc = this.options.doc;
    const win = doc.defaultView ?? activeWindow;
    const root = doc.createElement("div");
    root.className =
      "reading-comments-ui reading-comment-selection-toolbar reading-comments-floating";
    root.setAttribute("role", "toolbar");
    root.setAttribute("aria-label", "选中文字操作");

    const addButton = doc.createElement("button");
    addButton.className = "reading-comment-selection-toolbar__button";
    addButton.type = "button";
    addButton.setAttribute("aria-label", "添加评论");
    addButton.setAttribute("title", "添加评论");
    setIcon(addButton, "message-square-plus");
    root.appendChild(addButton);

    doc.body.appendChild(root);
    this.rootEl = root;

    this.registerDomEvent(addButton, "pointerdown", (event) => {
      // Keep the native text selection intact until the action is chosen.
      event.preventDefault();
    });
    this.registerDomEvent(addButton, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.options.onAddComment();
    });
    this.registerDomEvent(doc, "keydown", (event) => {
      if (event.key === "Escape") {
        this.unload();
      }
    });
    this.registerDomEvent(win, "resize", () => this.position());
    this.registerDomEvent(doc, "scroll", () => this.position(), true);

    this.outsideListenerTimer = win.setTimeout(() => {
      this.outsideListenerTimer = null;
      this.registerDomEvent(
        doc,
        "pointerdown",
        (event) => {
          if (event.button !== 0) {
            return;
          }

          const target = event.target;
          if (
            target !== null &&
            this.rootEl !== null &&
            !this.rootEl.contains(target as Node)
          ) {
            this.unload();
          }
        },
        true
      );
    }, 0);

    this.position();
    win.requestAnimationFrame(() => this.position());
  }

  onunload(): void {
    const win = this.options.doc.defaultView ?? activeWindow;
    if (this.outsideListenerTimer !== null) {
      win.clearTimeout(this.outsideListenerTimer);
      this.outsideListenerTimer = null;
    }

    this.rootEl?.remove();
    this.rootEl = null;
  }

  private position(): void {
    if (this.rootEl === null) {
      return;
    }

    positionFloatingElement(
      this.rootEl,
      this.options.getAnchorRect(),
      this.options.doc.defaultView ?? activeWindow,
      6
    );
  }
}

export class CommentEditorPopover extends Component {
  private rootEl: HTMLElement | null = null;
  private textareaEl: HTMLTextAreaElement | null = null;
  private previewEl: HTMLElement | null = null;
  private previewComponent: Component | null = null;
  private previewTimer: number | null = null;
  private outsideListenerTimer: number | null = null;
  private submitting = false;
  private placement: FloatingPlacement | null = null;

  constructor(private readonly options: EditorPopoverOptions) {
    super();
  }

  onload(): void {
    const doc = this.options.doc;
    const win = doc.defaultView ?? activeWindow;
    const root = doc.createElement("div");
    root.className =
      "reading-comments-ui reading-comment-editor reading-comments-floating";
    root.toggleClass(
      "is-auto-fit-height",
      this.options.autoFitHeight
    );
    root.setCssStyles({
      width: `${this.options.popupWidth}px`,
      height: this.options.autoFitHeight
        ? "auto"
        : `${this.options.popupHeight}px`
    });
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", this.options.isEditing ? "编辑评论" : "新增评论");

    const heading = doc.createElement("div");
    heading.className = "reading-comment-editor__heading";
    heading.textContent = this.options.isEditing ? "编辑评论" : "新增评论";
    root.appendChild(heading);

    const textarea = doc.createElement("textarea");
    textarea.className = "reading-comment-editor__textarea";
    textarea.placeholder = "输入 Markdown 评论…";
    textarea.value = this.options.initialValue;
    textarea.rows = 4;
    textarea.setAttribute("aria-label", "评论内容");
    root.appendChild(textarea);

    const previewLabel = doc.createElement("div");
    previewLabel.className = "reading-comment-editor__preview-label";
    previewLabel.textContent = "Markdown 预览";
    root.appendChild(previewLabel);

    const preview = doc.createElement("div");
    preview.className =
      "reading-comment-editor__preview markdown-rendered reading-comment-markdown";
    root.appendChild(preview);

    const footer = doc.createElement("div");
    footer.className = "reading-comment-editor__footer";
    root.appendChild(footer);

    const hint = doc.createElement("span");
    hint.className = "reading-comment-editor__hint";
    hint.textContent = "Enter 保存 · Shift+Enter 换行 · Esc 取消";
    footer.appendChild(hint);

    const actions = doc.createElement("div");
    actions.className = "reading-comment-editor__actions";
    footer.appendChild(actions);

    if (this.options.onDelete !== undefined) {
      const deleteButton = doc.createElement("button");
      deleteButton.className = "reading-comment-editor__delete";
      deleteButton.type = "button";
      deleteButton.textContent = "删除";
      deleteButton.setAttribute("aria-label", "删除评论");
      actions.appendChild(deleteButton);
      this.registerDomEvent(deleteButton, "click", () => {
        void this.deleteComment();
      });
    }

    const cancelButton = doc.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "取消";
    actions.appendChild(cancelButton);

    const saveButton = doc.createElement("button");
    saveButton.className = "mod-cta";
    saveButton.type = "button";
    saveButton.textContent = "保存";
    actions.appendChild(saveButton);

    doc.body.appendChild(root);
    this.rootEl = root;
    this.textareaEl = textarea;
    this.previewEl = preview;

    this.registerDomEvent(textarea, "input", () => {
      this.syncTextareaHeight();
      this.queuePreview();
    });
    this.registerDomEvent(textarea, "keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancel();
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        void this.submit();
      }
    });
    this.registerDomEvent(cancelButton, "click", () => this.cancel());
    this.registerDomEvent(saveButton, "click", () => {
      void this.submit();
    });
    this.registerDomEvent(win, "resize", () => this.position());
    this.registerDomEvent(
      doc,
      "scroll",
      (event) => {
        const target = event.target;
        if (
          target !== null &&
          this.rootEl !== null &&
          this.rootEl.contains(target as Node)
        ) {
          return;
        }

        this.position();
      },
      true
    );

    this.outsideListenerTimer = win.setTimeout(() => {
      this.outsideListenerTimer = null;
      this.registerDomEvent(
        doc,
        "pointerdown",
        (event) => {
          const target = event.target;
          if (
            target !== null &&
            this.rootEl !== null &&
            !this.rootEl.contains(target as Node)
          ) {
            void this.submit();
          }
        },
        true
      );
    }, 0);

    this.syncTextareaHeight();
    this.position();
    void this.renderPreview();
    win.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      this.position();
    });
  }

  onunload(): void {
    const win = this.options.doc.defaultView ?? activeWindow;
    if (this.previewTimer !== null) {
      win.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    if (this.outsideListenerTimer !== null) {
      win.clearTimeout(this.outsideListenerTimer);
      this.outsideListenerTimer = null;
    }

    this.previewComponent?.unload();
    this.previewComponent = null;
    this.rootEl?.remove();
    this.rootEl = null;
    this.textareaEl = null;
    this.previewEl = null;
    this.placement = null;
  }

  private queuePreview(): void {
    const win = this.options.doc.defaultView ?? activeWindow;
    if (this.previewTimer !== null) {
      win.clearTimeout(this.previewTimer);
    }
    this.previewTimer = win.setTimeout(() => {
      this.previewTimer = null;
      void this.renderPreview();
    }, 120);
  }

  private syncTextareaHeight(): void {
    const textarea = this.textareaEl;
    if (!this.options.autoFitHeight || textarea === null) {
      return;
    }

    textarea.setCssStyles({ height: "auto" });
    textarea.setCssStyles({
      height: `${Math.max(96, textarea.scrollHeight)}px`
    });
  }

  private async renderPreview(): Promise<void> {
    const preview = this.previewEl;
    const textarea = this.textareaEl;
    if (preview === null || textarea === null) {
      return;
    }

    this.previewComponent?.unload();
    this.previewComponent = null;
    preview.empty();

    const markdown = textarea.value.trim();
    if (markdown.length === 0) {
      preview.createSpan({
        cls: "reading-comment-editor__preview-empty",
        text: "评论会在这里按 Obsidian 原生 Markdown 样式渲染。"
      });
      return;
    }

    const component = new Component();
    component.load();
    this.previewComponent = component;
    try {
      await MarkdownRenderer.render(
        this.options.app,
        markdown,
        preview,
        this.options.sourcePath,
        component
      );
    } catch (error) {
      console.error("Lemon Comments: Markdown preview failed", error);
      preview.empty();
      preview.setText("Markdown 预览渲染失败，请检查评论内容。");
    }
  }

  private async submit(): Promise<void> {
    if (this.submitting || this.textareaEl === null) {
      return;
    }

    this.submitting = true;
    this.rootEl?.addClass("is-submitting");
    const value = this.textareaEl.value.trim();
    const success =
      value.length === 0 && this.options.onDelete !== undefined
        ? await this.options.onDelete()
        : await this.options.onSubmit(value);

    if (success) {
      this.unload();
      return;
    }

    this.submitting = false;
    this.rootEl?.removeClass("is-submitting");
    this.textareaEl?.focus();
  }

  private async deleteComment(): Promise<void> {
    if (this.submitting || this.options.onDelete === undefined) {
      return;
    }

    this.submitting = true;
    this.rootEl?.addClass("is-submitting");
    const success = await this.options.onDelete();
    if (success) {
      this.unload();
      return;
    }

    this.submitting = false;
    this.rootEl?.removeClass("is-submitting");
  }

  private cancel(): void {
    this.options.onCancel();
    this.unload();
  }

  private position(): void {
    const root = this.rootEl;
    const win = this.options.doc.defaultView ?? activeWindow;
    if (root === null) {
      return;
    }

    this.placement = positionSizedFloatingElement(
      root,
      this.options.getAnchorRect(),
      win,
      10,
      this.placement
    );
  }
}

export class CommentHoverPopover extends Component {
  private rootEl: HTMLElement | null = null;
  private markdownComponent: Component | null = null;
  private placement: FloatingPlacement | null = null;

  constructor(private readonly options: HoverPopoverOptions) {
    super();
  }

  onload(): void {
    const doc = this.options.doc;
    const win = doc.defaultView ?? activeWindow;
    const root = doc.createElement("div");
    root.className =
      "reading-comments-ui reading-comment-hover reading-comments-floating";
    root.toggleClass(
      "is-auto-fit-height",
      this.options.autoFitHeight
    );
    root.setCssStyles({
      width: `${this.options.popupWidth}px`,
      height: this.options.autoFitHeight
        ? "auto"
        : `${this.options.popupHeight}px`
    });
    root.setAttribute("role", "tooltip");

    const content = doc.createElement("div");
    content.className =
      "reading-comment-hover__content markdown-rendered reading-comment-markdown";
    root.appendChild(content);

    const footer = doc.createElement("div");
    footer.className = "reading-comment-hover__footer";
    root.appendChild(footer);

    const hint = doc.createElement("span");
    hint.textContent = "点击高亮文字可编辑";
    footer.appendChild(hint);

    const editButton = doc.createElement("button");
    editButton.type = "button";
    editButton.textContent = "编辑";
    editButton.setAttribute("aria-label", "编辑评论");
    footer.appendChild(editButton);

    doc.body.appendChild(root);
    this.rootEl = root;

    this.registerDomEvent(root, "pointerenter", this.options.onPointerEnter);
    this.registerDomEvent(root, "pointerleave", this.options.onPointerLeave);
    this.registerDomEvent(editButton, "click", this.options.onEdit);
    this.registerDomEvent(content, "load", () => this.position(), true);
    this.registerDomEvent(win, "resize", () => this.position());
    this.registerDomEvent(
      doc,
      "scroll",
      (event) => {
        const target = event.target;
        if (
          target !== null &&
          this.rootEl !== null &&
          this.rootEl.contains(target as Node)
        ) {
          return;
        }

        this.position();
      },
      true
    );

    const component = new Component();
    component.load();
    this.markdownComponent = component;
    void MarkdownRenderer.render(
      this.options.app,
      this.options.markdown,
      content,
      this.options.sourcePath,
      component
    )
      .then(() => this.position())
      .catch((error) => {
        console.error("Lemon Comments: hover Markdown render failed", error);
        content.empty();
        content.setText("评论渲染失败。");
        this.position();
      });

    this.position();
    win.requestAnimationFrame(() => this.position());
  }

  onunload(): void {
    this.markdownComponent?.unload();
    this.markdownComponent = null;
    this.rootEl?.remove();
    this.rootEl = null;
    this.placement = null;
  }

  private position(): void {
    const root = this.rootEl;
    const win = this.options.doc.defaultView ?? activeWindow;
    if (root === null) {
      return;
    }

    if (this.options.autoFitHeight) {
      positionAutoFitFloatingElement(
        root,
        this.options.getAnchorRect(),
        win,
        8
      );
      return;
    }

    this.placement = positionSizedFloatingElement(
      root,
      this.options.getAnchorRect(),
      win,
      8,
      this.placement
    );
  }
}

function positionFloatingElement(
  element: HTMLElement,
  anchor: DOMRect,
  win: Window,
  gap: number
): void {
  const margin = 10;
  const panel = element.getBoundingClientRect();
  let left = anchor.left;
  let top = anchor.bottom + gap;

  if (left + panel.width > win.innerWidth - margin) {
    left = win.innerWidth - panel.width - margin;
  }
  if (top + panel.height > win.innerHeight - margin) {
    top = anchor.top - panel.height - gap;
  }

  element.setCssStyles({
    left: `${Math.max(margin, left)}px`,
    top: `${Math.max(margin, top)}px`
  });
}

function positionSizedFloatingElement(
  element: HTMLElement,
  anchor: DOMRect,
  win: Window,
  gap: number,
  currentPlacement: FloatingPlacement | null
): FloatingPlacement {
  const margin = 10;
  const availableBelow = Math.max(
    0,
    win.innerHeight - anchor.bottom - gap - margin
  );
  const availableAbove = Math.max(0, anchor.top - gap - margin);
  const currentHeight = element.getBoundingClientRect().height;
  const placement =
    currentPlacement ??
    (currentHeight <= availableBelow || availableBelow >= availableAbove
      ? "below"
      : "above");
  const availableHeight =
    placement === "below" ? availableBelow : availableAbove;

  element.setCssStyles({
    maxHeight: `${Math.max(96, availableHeight)}px`,
    overflowY: "auto"
  });

  const panel = element.getBoundingClientRect();
  let left = anchor.left;
  let top =
    placement === "below"
      ? anchor.bottom + gap
      : anchor.top - panel.height - gap;

  if (left + panel.width > win.innerWidth - margin) {
    left = win.innerWidth - panel.width - margin;
  }
  top = Math.min(top, win.innerHeight - panel.height - margin);

  element.setCssStyles({
    left: `${Math.max(margin, left)}px`,
    top: `${Math.max(margin, top)}px`
  });
  return placement;
}

function positionAutoFitFloatingElement(
  element: HTMLElement,
  anchor: DOMRect,
  win: Window,
  gap: number
): void {
  const margin = 10;
  element.setCssStyles({
    maxHeight: "none",
    overflowY: "visible",
    transform: "none",
    transformOrigin: "top left"
  });

  const naturalWidth = element.offsetWidth;
  const naturalHeight = element.offsetHeight;
  if (naturalWidth === 0 || naturalHeight === 0) {
    return;
  }

  const maxWidth = Math.max(1, win.innerWidth - margin * 2);
  const maxHeight = Math.max(1, win.innerHeight - margin * 2);
  const scale = Math.min(
    1,
    maxWidth / naturalWidth,
    maxHeight / naturalHeight
  );
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  const availableBelow = win.innerHeight - anchor.bottom - gap - margin;
  const availableAbove = anchor.top - gap - margin;

  let left = anchor.left;
  let top =
    height <= availableBelow
      ? anchor.bottom + gap
      : height <= availableAbove
        ? anchor.top - height - gap
        : Math.min(
            Math.max(margin, anchor.top - height / 2),
            win.innerHeight - height - margin
          );

  left = Math.min(left, win.innerWidth - width - margin);
  top = Math.min(top, win.innerHeight - height - margin);
  element.setCssStyles({
    left: `${Math.max(margin, left)}px`,
    top: `${Math.max(margin, top)}px`,
    transform: `scale(${scale})`
  });
}
