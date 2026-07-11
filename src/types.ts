export interface TextQuoteAnchor {
  exact: string;
  prefix: string;
  suffix: string;
  startHint: number;
}

export interface ReadingComment {
  id: string;
  anchor: TextQuoteAnchor;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingCommentsSettings {
  highlightColor: string;
  hoverDelay: number;
  popupWidth: number;
  popupHeight: number;
  autoFitPopupHeight: boolean;
  autoFitMaxWidthPercent: number;
  autoFitMaxHeightPercent: number;
}

export interface ReadingCommentsData {
  version: 1;
  commentsByPath: Record<string, ReadingComment[]>;
  settings: ReadingCommentsSettings;
}

export const DEFAULT_SETTINGS: ReadingCommentsSettings = {
  highlightColor: "#d7ff52",
  hoverDelay: 180,
  popupWidth: 430,
  popupHeight: 420,
  autoFitPopupHeight: false,
  autoFitMaxWidthPercent: 60,
  autoFitMaxHeightPercent: 60
};

export function normalizePluginData(value: unknown): ReadingCommentsData {
  const source = isRecord(value) ? value : {};
  const rawSettings = isRecord(source.settings) ? source.settings : {};
  const settings: ReadingCommentsSettings = {
    highlightColor:
      typeof rawSettings.highlightColor === "string"
        ? rawSettings.highlightColor
        : DEFAULT_SETTINGS.highlightColor,
    hoverDelay:
      typeof rawSettings.hoverDelay === "number"
        ? Math.min(800, Math.max(0, rawSettings.hoverDelay))
        : DEFAULT_SETTINGS.hoverDelay,
    popupWidth:
      typeof rawSettings.popupWidth === "number"
        ? Math.min(900, Math.max(300, rawSettings.popupWidth))
        : DEFAULT_SETTINGS.popupWidth,
    popupHeight:
      typeof rawSettings.popupHeight === "number"
        ? Math.min(900, Math.max(240, rawSettings.popupHeight))
        : DEFAULT_SETTINGS.popupHeight,
    autoFitPopupHeight:
      typeof rawSettings.autoFitPopupHeight === "boolean"
        ? rawSettings.autoFitPopupHeight
        : DEFAULT_SETTINGS.autoFitPopupHeight,
    autoFitMaxWidthPercent:
      typeof rawSettings.autoFitMaxWidthPercent === "number"
        ? Math.min(95, Math.max(30, rawSettings.autoFitMaxWidthPercent))
        : DEFAULT_SETTINGS.autoFitMaxWidthPercent,
    autoFitMaxHeightPercent:
      typeof rawSettings.autoFitMaxHeightPercent === "number"
        ? Math.min(95, Math.max(30, rawSettings.autoFitMaxHeightPercent))
        : DEFAULT_SETTINGS.autoFitMaxHeightPercent
  };

  const commentsByPath: Record<string, ReadingComment[]> = {};
  if (isRecord(source.commentsByPath)) {
    for (const [path, comments] of Object.entries(source.commentsByPath)) {
      if (!Array.isArray(comments)) {
        continue;
      }

      const validComments = comments.filter(isReadingComment);
      if (validComments.length > 0) {
        commentsByPath[path] = validComments;
      }
    }
  }

  return {
    version: 1,
    commentsByPath,
    settings
  };
}

function isReadingComment(value: unknown): value is ReadingComment {
  if (!isRecord(value) || !isRecord(value.anchor)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.body === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    typeof value.anchor.exact === "string" &&
    typeof value.anchor.prefix === "string" &&
    typeof value.anchor.suffix === "string" &&
    typeof value.anchor.startHint === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
