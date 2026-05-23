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

  // Strip <p> tags inside table cells — mammoth wraps cell content in <p>
  html = html.replace(/<(th|td)><p>/gi, "<$1>");
  html = html.replace(/<\/p><\/(th|td)>/gi, "</$1>");

  let md = turndown.turndown(html);

  // Strip Word TOC/bookmark anchors that turndown may preserve as HTML
  md = md.replace(/<a id="[^"]*"><\/a>/g, "");
  md = md.replace(/<a id="[^"]*">/g, "");
  md = md.replace(/<\/a>/g, "");
  // Strip any remaining base64 image references
  md = md.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "");

  return md;
}
