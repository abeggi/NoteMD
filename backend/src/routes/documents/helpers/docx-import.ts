// mammoth types are incomplete — convertToMarkdown exists at runtime
import mammoth from "mammoth";

type MammothWithMarkdown = typeof mammoth & {
  convertToMarkdown(
    input: { buffer: Buffer },
    options?: Record<string, unknown>,
  ): Promise<{ value: string; messages: unknown[] }>;
};

export async function docxToMarkdown(buffer: Buffer): Promise<string> {
  const m = mammoth as MammothWithMarkdown;
  const result = await m.convertToMarkdown({ buffer }, {
    convertImage: mammoth.images.imgElement(() =>
      Promise.resolve({ src: "" }),
    ),
  });

  let md = result.value;
  // Strip Word TOC/bookmark anchors
  md = md.replace(/<a id="[^"]*"><\/a>/g, "");
  md = md.replace(/<a id="[^"]*">/g, "");
  md = md.replace(/<\/a>/g, "");
  // Strip any remaining base64 image references
  md = md.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "");

  return md;
}
