import type { TextQuoteAnchor } from "./types";

const CONTEXT_LENGTH = 64;
const SKIPPED_SELECTOR = [
  ".reading-comments-ui",
  ".internal-embed",
  ".metadata-container",
  ".mod-header",
  ".embedded-backlinks",
  ".markdown-preview-pusher",
  ".copy-code-button",
  ".collapse-indicator",
  ".heading-collapse-indicator",
  "button",
  "canvas",
  "iframe",
  "input",
  "script",
  "select",
  "style",
  "textarea"
].join(",");

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

export interface TextMap {
  text: string;
  segments: TextSegment[];
}

export interface AnchoredSelection {
  anchor: TextQuoteAnchor;
  range: Range;
  start: number;
  end: number;
}

export interface LocatedAnchor {
  start: number;
  end: number;
  score: number;
}

export function buildTextMap(root: HTMLElement): TextMap {
  const doc = root.ownerDocument;
  const nodeFilter = doc.defaultView?.NodeFilter ?? NodeFilter;
  const walker = doc.createTreeWalker(root, nodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node as Text;
      const parent = text.parentElement;
      if (
        text.data.length === 0 ||
        parent === null ||
        parent.closest(SKIPPED_SELECTOR) !== null
      ) {
        return nodeFilter.FILTER_REJECT;
      }

      return nodeFilter.FILTER_ACCEPT;
    }
  });

  const segments: TextSegment[] = [];
  let text = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const start = text.length;
    text += node.data;
    segments.push({ node, start, end: text.length });
  }

  return { text, segments };
}

export function createAnchorFromRange(
  root: HTMLElement,
  sourceRange: Range
): AnchoredSelection | null {
  const map = buildTextMap(root);
  const offsets = getRangeOffsets(map, sourceRange);
  if (offsets === null) {
    return null;
  }

  let { start, end } = offsets;
  while (start < end && isWhitespace(map.text[start])) {
    start += 1;
  }
  while (end > start && isWhitespace(map.text[end - 1])) {
    end -= 1;
  }

  if (start === end) {
    return null;
  }

  const range = createRangeFromOffsets(root, start, end);
  if (range === null) {
    return null;
  }

  return {
    anchor: {
      exact: map.text.slice(start, end),
      prefix: map.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: map.text.slice(end, end + CONTEXT_LENGTH),
      startHint: start
    },
    range,
    start,
    end
  };
}

export function locateAnchor(
  map: TextMap,
  anchor: TextQuoteAnchor
): LocatedAnchor | null {
  if (anchor.exact.length === 0) {
    return null;
  }

  let best: LocatedAnchor | null = null;
  let index = map.text.indexOf(anchor.exact);
  while (index !== -1) {
    const end = index + anchor.exact.length;
    const currentPrefix = map.text.slice(
      Math.max(0, index - anchor.prefix.length),
      index
    );
    const currentSuffix = map.text.slice(end, end + anchor.suffix.length);
    const contextScore =
      commonSuffixLength(currentPrefix, anchor.prefix) * 2 +
      commonPrefixLength(currentSuffix, anchor.suffix) * 2;
    const distancePenalty = Math.min(
      24,
      Math.abs(index - anchor.startHint) / 500
    );
    const score = contextScore - distancePenalty;

    if (best === null || score > best.score) {
      best = { start: index, end, score };
    }

    index = map.text.indexOf(anchor.exact, index + 1);
  }

  return best;
}

export function createRangeFromOffsets(
  root: HTMLElement,
  start: number,
  end: number
): Range | null {
  const map = buildTextMap(root);
  if (
    start < 0 ||
    end <= start ||
    end > map.text.length ||
    map.segments.length === 0
  ) {
    return null;
  }

  const startPoint = findBoundary(map.segments, start, true);
  const endPoint = findBoundary(map.segments, end, false);
  if (startPoint === null || endPoint === null) {
    return null;
  }

  const range = root.ownerDocument.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

export function wrapOffsets(
  root: HTMLElement,
  start: number,
  end: number,
  commentId: string
): HTMLElement[] {
  const map = buildTextMap(root);
  const affected = map.segments.filter(
    (segment) => segment.end > start && segment.start < end
  );
  const spans: HTMLElement[] = [];

  for (let index = affected.length - 1; index >= 0; index -= 1) {
    const segment = affected[index];
    if (segment === undefined) {
      continue;
    }

    const localStart = Math.max(0, start - segment.start);
    const localEnd = Math.min(segment.node.length, end - segment.start);
    if (localStart >= localEnd) {
      continue;
    }

    let selectedNode = segment.node;
    if (localStart > 0) {
      selectedNode = selectedNode.splitText(localStart);
    }

    const selectedLength = localEnd - localStart;
    if (selectedLength < selectedNode.length) {
      selectedNode.splitText(selectedLength);
    }

    const span = root.ownerDocument.createElement("span");
    span.className = "reading-comment-highlight";
    span.dataset.commentId = commentId;
    selectedNode.parentNode?.insertBefore(span, selectedNode);
    span.appendChild(selectedNode);
    spans.push(span);
  }

  spans.reverse();
  return spans;
}

export function unwrapHighlights(root: HTMLElement): void {
  const parents = new Set<Node>();
  const highlights = Array.from(
    root.querySelectorAll<HTMLElement>(".reading-comment-highlight")
  );

  for (const highlight of highlights) {
    const parent = highlight.parentNode;
    if (parent === null) {
      continue;
    }

    parents.add(parent);
    highlight.replaceWith(...Array.from(highlight.childNodes));
  }

  for (const parent of parents) {
    parent.normalize();
  }
}

export function overlapsClaim(
  candidate: LocatedAnchor,
  claims: LocatedAnchor[]
): boolean {
  return claims.some(
    (claim) => candidate.start < claim.end && claim.start < candidate.end
  );
}

export function getRangeRect(range: Range): DOMRect {
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect;
  }

  const clientRects = range.getClientRects();
  return clientRects.length > 0 ? clientRects[clientRects.length - 1]! : rect;
}

export function getRangeEndRect(range: Range): DOMRect {
  const clientRects = range.getClientRects();
  return clientRects.length > 0
    ? clientRects[clientRects.length - 1]!
    : range.getBoundingClientRect();
}

function getRangeOffsets(
  map: TextMap,
  range: Range
): { start: number; end: number } | null {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  for (const segment of map.segments) {
    if (!range.intersectsNode(segment.node)) {
      continue;
    }

    const localStart =
      segment.node === range.startContainer
        ? clamp(range.startOffset, 0, segment.node.length)
        : 0;
    const localEnd =
      segment.node === range.endContainer
        ? clamp(range.endOffset, 0, segment.node.length)
        : segment.node.length;

    if (localStart >= localEnd) {
      continue;
    }

    start = Math.min(start, segment.start + localStart);
    end = Math.max(end, segment.start + localEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return null;
  }

  return { start, end };
}

function findBoundary(
  segments: TextSegment[],
  offset: number,
  preferNext: boolean
): { node: Text; offset: number } | null {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined) {
      continue;
    }

    if (
      offset < segment.end ||
      (offset === segment.end &&
        (!preferNext || index === segments.length - 1))
    ) {
      return {
        node: segment.node,
        offset: clamp(offset - segment.start, 0, segment.node.length)
      };
    }
  }

  return null;
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function commonSuffixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let length = 0;
  while (
    length < limit &&
    left[left.length - 1 - length] === right[right.length - 1 - length]
  ) {
    length += 1;
  }
  return length;
}

function isWhitespace(value: string | undefined): boolean {
  return value !== undefined && /\s/u.test(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
