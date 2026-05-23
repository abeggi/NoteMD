import { marked, Token, Tokens } from "marked";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  IParagraphOptions,
} from "docx";

interface RunProps {
  text?: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  font?: string;
  size?: number;
  color?: string;
  underline?: Record<string, never>;
  shading?: { type: (typeof ShadingType)[keyof typeof ShadingType]; color: string };
  break?: number;
}

function mergeRunProps(base: RunProps, overrides: RunProps): RunProps {
  return { ...base, ...overrides };
}

function extractRunProps(run: TextRun): RunProps {
  const root = (run as unknown as { options: Map<string, unknown> }).options;
  const props: RunProps = {};
  if (root instanceof Map) {
    for (const [key, value] of root.entries()) {
      (props as Record<string, unknown>)[key] = value;
    }
  }
  return props;
}

function buildTextRunsFromTokens(tokens: Token[]): TextRun[] {
  const runs: TextRun[] = [];

  for (const tok of tokens) {
    switch (tok.type) {
      case "text": {
        const text = tok as Tokens.Text;
        runs.push(new TextRun({ text: text.text }));
        break;
      }
      case "strong": {
        const strong = tok as Tokens.Strong;
        if (strong.tokens) {
          for (const child of buildTextRunsFromTokens(strong.tokens)) {
            const props = extractRunProps(child);
            runs.push(new TextRun(mergeRunProps(props, { bold: true })));
          }
        } else {
          runs.push(new TextRun({ text: strong.text, bold: true }));
        }
        break;
      }
      case "em": {
        const em = tok as Tokens.Em;
        if (em.tokens) {
          for (const child of buildTextRunsFromTokens(em.tokens)) {
            const props = extractRunProps(child);
            runs.push(new TextRun(mergeRunProps(props, { italics: true })));
          }
        } else {
          runs.push(new TextRun({ text: em.text, italics: true }));
        }
        break;
      }
      case "del": {
        const del = tok as Tokens.Del;
        if (del.tokens) {
          for (const child of buildTextRunsFromTokens(del.tokens)) {
            const props = extractRunProps(child);
            runs.push(new TextRun(mergeRunProps(props, { strike: true })));
          }
        } else {
          runs.push(new TextRun({ text: del.text, strike: true }));
        }
        break;
      }
      case "codespan": {
        const code = tok as Tokens.Codespan;
        runs.push(
          new TextRun({
            text: code.text,
            font: "Courier New",
            size: 20,
            shading: { type: ShadingType.SOLID, color: "ededed" },
          }),
        );
        break;
      }
      case "link": {
        const link = tok as Tokens.Link;
        if (link.tokens) {
          for (const child of buildTextRunsFromTokens(link.tokens)) {
            const props = extractRunProps(child);
            runs.push(
              new TextRun(
                mergeRunProps(props, { color: "0563c1", underline: {} }),
              ),
            );
          }
        } else {
          runs.push(
            new TextRun({
              text: link.text,
              color: "0563c1",
              underline: {},
            }),
          );
        }
        break;
      }
      case "br": {
        runs.push(new TextRun({ break: 1 }));
        break;
      }
      case "image": {
        const img = tok as Tokens.Image;
        runs.push(
          new TextRun({
            text: `[Image: ${img.text || img.href}]`,
            italics: true,
            color: "888888",
          }),
        );
        break;
      }
      default:
        break;
    }
  }

  return runs;
}

function headingLevelForDepth(
  depth: number,
): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const map: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> =
    {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6,
    };
  return map[depth] ?? HeadingLevel.HEADING_1;
}

const BLOCKQUOTE_OPTIONS: IParagraphOptions = {
  indent: { left: convertInchesToTwip(0.5) },
  border: {
    left: {
      style: BorderStyle.SINGLE,
      size: 3,
      color: "999999",
      space: 8,
    },
  },
};

function tokenToParagraphs(token: Token): (Paragraph | Table)[] {
  if (token.type === "heading") {
    const heading = token as Tokens.Heading;
    const headingLevel = headingLevelForDepth(heading.depth);
    const runs = heading.tokens
      ? buildTextRunsFromTokens(heading.tokens)
      : [new TextRun({ text: heading.text })];
    return [
      new Paragraph({
        heading: headingLevel,
        children: runs,
        spacing: { before: 240, after: 120 },
      }),
    ];
  }

  if (token.type === "paragraph") {
    const p = token as Tokens.Paragraph;
    const runs = p.tokens
      ? buildTextRunsFromTokens(p.tokens)
      : [new TextRun({ text: p.text })];
    return [
      new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun({ text: "" })],
        spacing: { after: 120 },
      }),
    ];
  }

  if (token.type === "code") {
    const code = token as Tokens.Code;
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: code.text,
            font: "Courier New",
            size: 18,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: "f5f5f5" },
        spacing: { after: 120, before: 120 },
        indent: { left: convertInchesToTwip(0.25) },
        border: {
          left: {
            style: BorderStyle.SINGLE,
            size: 3,
            color: "cccccc",
            space: 8,
          },
        },
      }),
    ];
  }

  if (token.type === "blockquote") {
    const bq = token as Tokens.Blockquote;
    return buildParagraphsFromTokens(bq.tokens, BLOCKQUOTE_OPTIONS);
  }

  if (token.type === "list") {
    const list = token as Tokens.List;
    const results: Paragraph[] = [];
    const leftIndentBase = convertInchesToTwip(0.5);

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i];
        const isOrdered = list.ordered;
        const startNum = typeof list.start === "number" ? list.start : Number(list.start) || 1;
        const bulletText = isOrdered ? `${startNum + i}.` : "\u2022";

      let itemRuns = getItemTextRuns(item);
      if (itemRuns.length === 0) {
        const text = (item as unknown as { text?: string }).text ?? "";
        itemRuns = [new TextRun({ text })];
      }

      results.push(
        new Paragraph({
          children: [
            new TextRun({ text: bulletText + " ", bold: true }),
            ...itemRuns,
          ],
          spacing: { after: 60 },
          indent: { left: leftIndentBase },
          bullet: { level: 0 },
        }),
      );

      // Handle nested tokens (sub-lists, additional paragraphs)
      const remainingTokens = item.tokens.slice(1);
      for (const nested of remainingTokens) {
        const nestedChildren = tokenToParagraphs(nested);
        for (const child of nestedChildren) {
          if (child instanceof Paragraph) {
            // Apply deeper indent for nested items
            results.push(
              new Paragraph({
                children: buildRunsFromInline(nested),
                spacing: { after: 60 },
                indent: { left: convertInchesToTwip(0.75) },
              }),
            );
          } else {
            results.push(
              new Paragraph({
                spacing: { after: 60 },
                indent: { left: convertInchesToTwip(0.75) },
                children: [],
              }),
            );
          }
        }
      }
    }

    return results;
  }

  if (token.type === "hr") {
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: "cccccc",
            space: 1,
          },
        },
        children: [],
      }),
    ];
  }

  if (token.type === "table") {
    const table = token as Tokens.Table;
    const rows: TableRow[] = [];

    const headerRow = new TableRow({
      tableHeader: true,
      children: table.header.map((cell) =>
        createCell(cellTextFromTokens(cell.tokens), true),
      ),
    });
    rows.push(headerRow);

    for (const row of table.rows) {
      const dataRow = new TableRow({
        children: row.map((cell) =>
          createCell(cellTextFromTokens(cell.tokens)),
        ),
      });
      rows.push(dataRow);
    }

    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      }),
      new Paragraph({ spacing: { after: 120 }, children: [] }),
    ];
  }

  return [];
}

function getItemTextRuns(item: Tokens.ListItem): TextRun[] {
  const firstToken = item.tokens[0];
  if (firstToken && firstToken.type === "text") {
    const textToken = firstToken as Tokens.Text;
    if (textToken.tokens) {
      return buildTextRunsFromTokens(textToken.tokens);
    }
    return [new TextRun({ text: textToken.text })];
  }
  if (firstToken && firstToken.type === "paragraph") {
    const p = firstToken as Tokens.Paragraph;
    if (p.tokens) {
      return buildTextRunsFromTokens(p.tokens);
    }
    return [new TextRun({ text: p.text })];
  }
  return [];
}

function buildRunsFromInline(token: Token): TextRun[] {
  if (token.type === "text") {
    const t = token as Tokens.Text;
    if (t.tokens) return buildTextRunsFromTokens(t.tokens);
    return [new TextRun({ text: t.text })];
  }
  if (token.type === "paragraph") {
    const p = token as Tokens.Paragraph;
    if (p.tokens) return buildTextRunsFromTokens(p.tokens);
    return [new TextRun({ text: p.text })];
  }
  if (token.type === "list") {
    return [];
  }
  return [];
}

function buildParagraphsFromTokens(
  tokens: Token[],
  baseOptions?: IParagraphOptions,
): Paragraph[] {
  const results: Paragraph[] = [];
  for (const t of tokens) {
    const children = tokenToParagraphs(t);
    for (const child of children) {
      if (child instanceof Paragraph && baseOptions) {
        results.push(
          new Paragraph({
            children: buildRunsFromInline(t),
            spacing: { after: 120 },
            ...baseOptions,
          }),
        );
      } else if (child instanceof Paragraph) {
        results.push(child);
      }
    }
  }
  return results;
}

function cellTextFromTokens(tokens: Token[]): string {
  return tokens.map((t) => ("text" in t ? t.text : "")).join("");
}

function createCell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold })],
      }),
    ],
    ...(bold ? { shading: { type: ShadingType.SOLID, color: "e0e0e0" } } : {}),
  });
}

export async function markdownToDocx(
  markdown: string,
  title: string,
): Promise<Buffer> {
  const tokens = marked.lexer(markdown);
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title })],
      spacing: { after: 360 },
    }),
  );

  for (const token of tokens) {
    children.push(...tokenToParagraphs(token));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
