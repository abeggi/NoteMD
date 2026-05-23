import mammoth from "mammoth";
import TurndownService from "turndown";
// @ts-expect-error: no types for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});
turndown.use(gfm);

export async function docxToMarkdown(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })),
    },
  );

  let html = result.value;

  // Strip <a> tags (keep text) — TOC/summary links are dead in markdown anyway
  html = html.replace(/<a[^>]*>/gi, "");
  html = html.replace(/<\/a>/gi, "");

  // Promote first row of each table to header if missing — required by turndown GFM
  html = html.replace(
    /<table>(?!\s*<thead>)([\s\S]*?)(<\/table>)/gi,
    (_, body, close) => {
      const fixed = body.replace(
        /<tr>(\s*<td[^>]*>[\s\S]*?<\/td>\s*.*?)<\/tr>/i,
        "<thead><tr>$1</tr></thead>",
      );
      return "<table>" + fixed.replace(/<td([^>]*)>/gi, "<th$1>").replace(/<\/td>/gi, "</th>") + close;
    },
  );

  // Strip <p>, <img>, and <a> inside table cells
  html = html.replace(
    /(<(?:th|td)>)([\s\S]*?)(<\/(?:th|td)>)/gi,
    (_, open, body, close) =>
      open +
      body.replace(/<\/?p>/gi, "").replace(/<img[^>]*>/gi, "").replace(/<a[^>]*>/gi, "").replace(/<\/a>/gi, "") +
      close,
  );

  let md = turndown.turndown(html);

  // Strip any remaining HTML anchors/images that survived turndown
  md = md.replace(/<a[^>]*>[^<]*<\/a>/g, "");
  md = md.replace(/<a[^>]*>/g, "");
  md = md.replace(/<\/a>/g, "");
  md = md.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "");

  return md;
}
