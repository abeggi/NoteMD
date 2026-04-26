import type { Data, Processor } from "unified";
import { visit } from "unist-util-visit";
import type {
  Handle,
  Options as ToMarkdownExtension,
} from "mdast-util-to-markdown";
import type { Parent, Root } from "mdast";

declare module "mdast" {
  export interface TextColor extends Parent {
    type: "textColor";
    data: {
      color: string;
    };
    children: PhrasingContent[];
  }

  interface StaticPhrasingContentMap {
    textColor: TextColor;
  }

  interface PhrasingContentMap {
    textColor: TextColor;
  }

  interface RootContentMap {
    textColor: TextColor;
  }
}

// Captures the full style attribute value from any <span style="..."> tag
const SPAN_WITH_STYLE_RE = /^<span\s[^>]*style="([^"]*)"[^>]*>$/i;
// Extracts the color value from a style string
const COLOR_IN_STYLE_RE = /(?:^|;)\s*color:\s*([^;"]+)/i;
// Extracts the font-family value from a style string
const FONT_FAMILY_IN_STYLE_RE = /(?:^|;)\s*font-family:\s*([^;"]+)/i;
// Matches ANY span open tag (used for nesting depth tracking)
const ANY_SPAN_OPEN_RE = /^<span[\s>]/i;
const SPAN_CLOSE_RE = /^<\/span>$/i;

/**
 * Remark plugin to support text color via inline HTML spans.
 *
 * Parses:   <span style="color: #ff0000">text</span>
 * Produces: textColor mdast node with { data: { color: "#ff0000" } }
 *
 * Also handles combined spans:
 *   <span style="color: #ff0000; font-family: Georgia, serif">text</span>
 * Produces: textColor { fontFamily { text } }
 *
 * Serializes back to a single combined span when both marks are present.
 */
export function remarkTextColor(this: Processor) {
  const data = this.data();
  add(data, "toMarkdownExtensions", textColorToMarkdown);

  return (tree: Root) => {
    // Walk all parent nodes (paragraphs, list items, blockquotes, etc.)
    visit(tree, (node) => {
      const parent = node as unknown as Parent;
      if (!parent.children || !Array.isArray(parent.children)) return;

      let i = 0;
      while (i < parent.children.length) {
        const child = parent.children[i] as any;

        if (child.type !== "html") {
          i++;
          continue;
        }

        const spanMatch = child.value?.match(SPAN_WITH_STYLE_RE);
        if (!spanMatch) {
          i++;
          continue;
        }

        const styleAttr = spanMatch[1];
        const colorMatch = styleAttr.match(COLOR_IN_STYLE_RE);
        if (!colorMatch) {
          i++;
          continue;
        }

        const color = colorMatch[1].trim();
        // Also extract font-family if present in the same span (combined span)
        const familyMatch = styleAttr.match(FONT_FAMILY_IN_STYLE_RE);
        const family = familyMatch ? familyMatch[1].trim() : null;

        // Find the matching closing </span>, skipping over any nested spans
        let closeIdx = -1;
        let depth = 0;
        for (let j = i + 1; j < parent.children.length; j++) {
          const sibling = parent.children[j] as any;
          if (sibling.type === "html") {
            if (ANY_SPAN_OPEN_RE.test(sibling.value)) {
              depth++;
            } else if (SPAN_CLOSE_RE.test(sibling.value)) {
              if (depth === 0) {
                closeIdx = j;
                break;
              }
              depth--;
            }
          }
        }

        if (closeIdx === -1) {
          i++;
          continue;
        }

        // Grab everything between the open and close tags
        const innerChildren = parent.children.slice(i + 1, closeIdx) as any[];

        let textColorNode: any;
        if (family) {
          // Combined span — nest fontFamily inside textColor so both marks apply
          const fontFamilyNode: any = {
            type: "fontFamily",
            data: { family },
            children: innerChildren,
          };
          textColorNode = {
            type: "textColor",
            data: { color },
            children: [fontFamilyNode],
          };
        } else {
          textColorNode = {
            type: "textColor",
            data: { color },
            children: innerChildren,
          };
        }

        // Replace the open-tag, content, and close-tag with a single node
        parent.children.splice(i, closeIdx - i + 1, textColorNode);
        // Don't increment — re-visit in case of nested spans
      }
    });
  };
}

// ── Serializer ──────────────────────────────────────────────────────────────

const handleTextColor: Handle = (node, _, state, info) => {
  const color = (node as any).data?.color ?? "inherit";
  const tracker = state.createTracker(info);

  // If the sole child is a fontFamily node, emit a single combined span
  const nodeChildren = (node as any).children ?? [];
  if (nodeChildren.length === 1 && nodeChildren[0].type === "fontFamily") {
    const family = nodeChildren[0].data?.family ?? "inherit";
    const open = `<span style="color: ${color}; font-family: ${family}">`;
    const close = `</span>`;
    let value = tracker.move(open);
    value += tracker.move(
      state.containerPhrasing(nodeChildren[0] as any, {
        before: value,
        after: close,
        ...tracker.current(),
      }),
    );
    value += tracker.move(close);
    return value;
  }

  const open = `<span style="color: ${color}">`;
  const close = `</span>`;

  let value = tracker.move(open);
  value += tracker.move(
    state.containerPhrasing(node as any, {
      before: value,
      after: close,
      ...tracker.current(),
    }),
  );
  value += tracker.move(close);
  return value;
};

const textColorToMarkdown: ToMarkdownExtension = {
  unsafe: [],
  handlers: {
    textColor: handleTextColor,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function add(
  data: Data,
  field: "toMarkdownExtensions",
  value: ToMarkdownExtension,
) {
  // @ts-ignore
  const list = (data[field] = data[field] || []);
  if (!list.includes(value)) list.push(value);
}
