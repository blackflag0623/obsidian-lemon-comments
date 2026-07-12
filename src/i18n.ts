import { getLanguage } from "obsidian";

const EN_US = {
  "selection.toolbarLabel": "Selected text actions",
  "selection.addComment": "Add comment",
  "editor.editTitle": "Edit comment",
  "editor.newTitle": "Add comment",
  "editor.placeholder": "Enter a Markdown comment…",
  "editor.contentLabel": "Comment content",
  "editor.previewLabel": "Markdown preview",
  "editor.shortcutHint":
    "Enter to save · Shift+Enter for newline · Esc to cancel",
  "editor.delete": "Delete",
  "editor.deleteLabel": "Delete comment",
  "editor.cancel": "Cancel",
  "editor.save": "Save",
  "editor.previewEmpty":
    "Your comment will be rendered here with Obsidian's native Markdown style.",
  "editor.previewError":
    "Markdown preview failed. Check the comment content.",
  "hover.editHint": "Click the highlighted text to edit",
  "hover.edit": "Edit",
  "hover.editLabel": "Edit comment",
  "hover.renderError": "Failed to render comment.",
  "manager.title": "Manage reading comments",
  "manager.empty": "This note has no reading comments.",
  "manager.summary": "This note has {count} comments.",
  "manager.orphaned": "Not located",
  "manager.editLabel": "Edit comment",
  "manager.deleteLabel": "Delete comment",
  "manager.renderError": "Failed to render comment.",
  "command.manage": "Manage reading comments in current note",
  "notice.settingsSaveFailed":
    "Failed to save Lemon Comments settings. Check the console.",
  "notice.commentMissing": "This comment no longer exists.",
  "notice.commentDeleted": "Comment deleted.",
  "notice.commentDeleteFailed":
    "Failed to delete comment. Check the console.",
  "notice.unsupportedSelection":
    "Comments are not supported on embeds, code blocks, or formulas.",
  "notice.overlappingSelection":
    "Comments cannot overlap. Click highlighted text to edit its comment.",
  "notice.selectionTooLong":
    "A comment can be linked to at most {count} characters.",
  "notice.fileUnknown":
    "Could not determine the current note. Comment was not created.",
  "notice.commentAdded": "Comment added.",
  "notice.commentSaveFailed":
    "Failed to save comment. Check the console.",
  "notice.commentUpdated": "Comment updated.",
  "notice.commentUpdateFailed":
    "Failed to update comment. Check the console.",
  "notice.renameMigrationFailed":
    "The file was renamed, but its Lemon Comments data could not be migrated.",
  "notice.deletedFileCleanupFailed":
    "The file was deleted, but its Lemon Comments data could not be removed.",
  "highlight.editLabel": "Has a comment; press Enter to edit",
  "settings.highlightColor": "Highlight color",
  "settings.highlightColorDesc":
    "The lemon-colored highlight used for commented text in Reading view.",
  "settings.resetColor": "Restore default color",
  "settings.hoverDelay": "Hover delay",
  "settings.hoverDelayDesc":
    "Delay before showing a comment on hover, in milliseconds.",
  "settings.popupWidth": "Default comment popup width",
  "settings.popupWidthDesc":
    "Default width in pixels for create, edit, and reading popups.",
  "settings.popupHeight": "Default comment popup height",
  "settings.popupHeightDesc":
    "Height in pixels for comment popups when smart sizing is disabled.",
  "settings.smartSizing": "Smart reading popup sizing",
  "settings.smartSizingDesc":
    "Always anchor above or below the highlight. If the full content does not fit, use the side with more space and scroll inside the popup.",
  "settings.maxWidth": "Maximum adaptive width",
  "settings.maxWidthDesc":
    "Maximum reading popup width as a percentage of the Obsidian window.",
  "settings.maxHeight": "Maximum adaptive height",
  "settings.maxHeightDesc":
    "Maximum reading popup height as a percentage of the Obsidian window.",
  "settings.shortcuts": "Editor shortcuts",
  "settings.shortcutsDesc":
    "Enter to save; Shift+Enter for a newline; Esc to cancel. Clicking outside also saves."
} as const;

type TranslationKey = keyof typeof EN_US;
type TranslationValues = Record<string, string | number>;

const ZH_CN: Record<TranslationKey, string> = {
  "selection.toolbarLabel": "选中文字操作",
  "selection.addComment": "添加评论",
  "editor.editTitle": "编辑评论",
  "editor.newTitle": "新增评论",
  "editor.placeholder": "输入 Markdown 评论…",
  "editor.contentLabel": "评论内容",
  "editor.previewLabel": "Markdown 预览",
  "editor.shortcutHint": "Enter 保存 · Shift+Enter 换行 · Esc 取消",
  "editor.delete": "删除",
  "editor.deleteLabel": "删除评论",
  "editor.cancel": "取消",
  "editor.save": "保存",
  "editor.previewEmpty":
    "评论会在这里按 Obsidian 原生 Markdown 样式渲染。",
  "editor.previewError": "Markdown 预览渲染失败，请检查评论内容。",
  "hover.editHint": "点击高亮文字可编辑",
  "hover.edit": "编辑",
  "hover.editLabel": "编辑评论",
  "hover.renderError": "评论渲染失败。",
  "manager.title": "管理阅读评论",
  "manager.empty": "当前笔记还没有阅读评论。",
  "manager.summary": "当前笔记共有 {count} 条评论。",
  "manager.orphaned": "未定位",
  "manager.editLabel": "编辑评论",
  "manager.deleteLabel": "删除评论",
  "manager.renderError": "评论渲染失败。",
  "command.manage": "管理当前笔记的阅读评论",
  "notice.settingsSaveFailed": "阅读评论设置保存失败，请查看控制台。",
  "notice.commentMissing": "这条评论已经不存在。",
  "notice.commentDeleted": "评论已删除。",
  "notice.commentDeleteFailed": "评论删除失败，请查看控制台。",
  "notice.unsupportedSelection":
    "嵌入内容、代码块或公式暂不支持添加阅读评论。",
  "notice.overlappingSelection":
    "评论不能与已有评论重叠；点击高亮文字可编辑原评论。",
  "notice.selectionTooLong": "单条评论最多可关联 {count} 个字符。",
  "notice.fileUnknown": "无法确定当前笔记，评论未创建。",
  "notice.commentAdded": "评论已添加。",
  "notice.commentSaveFailed": "评论保存失败，请查看控制台。",
  "notice.commentUpdated": "评论已更新。",
  "notice.commentUpdateFailed": "评论更新失败，请查看控制台。",
  "notice.renameMigrationFailed": "文件已重命名，但阅读评论迁移失败。",
  "notice.deletedFileCleanupFailed":
    "文件已删除，但其阅读评论数据清理失败。",
  "highlight.editLabel": "有评论；按 Enter 编辑",
  "settings.highlightColor": "高亮颜色",
  "settings.highlightColorDesc":
    "阅读模式中，被评论文字使用的柠檬色高亮。",
  "settings.resetColor": "恢复默认颜色",
  "settings.hoverDelay": "悬停显示延迟",
  "settings.hoverDelayDesc": "鼠标停留多久后显示评论，单位为毫秒。",
  "settings.popupWidth": "评论弹窗默认宽度",
  "settings.popupWidthDesc":
    "新增、编辑及悬停阅读评论弹窗的默认宽度，单位为像素。",
  "settings.popupHeight": "评论弹窗默认高度",
  "settings.popupHeightDesc":
    "关闭智能自适应时，评论弹窗使用的高度，单位为像素。",
  "settings.smartSizing": "阅读弹窗智能自适应",
  "settings.smartSizingDesc":
    "始终紧贴高亮文字上方或下方。完整内容放不下时，选择空间更大的一侧并在窗口内滚动。",
  "settings.maxWidth": "自适应最大宽度",
  "settings.maxWidthDesc":
    "悬停阅读弹窗最多占 Obsidian 窗口宽度的百分比。",
  "settings.maxHeight": "自适应最大高度",
  "settings.maxHeightDesc":
    "悬停阅读弹窗最多占 Obsidian 窗口高度的百分比。",
  "settings.shortcuts": "编辑快捷键",
  "settings.shortcutsDesc":
    "Enter 保存；Shift+Enter 换行；Esc 取消。点击弹窗外也会保存。"
};

export type LemonLocale = "en-US" | "zh-CN";

export function resolveLocale(language: string): LemonLocale {
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function getLocale(): LemonLocale {
  return resolveLocale(getLanguage());
}

export function t(
  key: TranslationKey,
  values: TranslationValues = {}
): string {
  const dictionary = getLocale() === "zh-CN" ? ZH_CN : EN_US;
  return interpolate(dictionary[key], values);
}

function interpolate(template: string, values: TranslationValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
