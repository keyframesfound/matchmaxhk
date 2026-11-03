/**
 * Read plain text from Word / PowerPoint / OpenDocument / text files in the
 * browser, for AI detect and the automatic content check when a note has no
 * PDF. .docx / .pptx / .odt / .odp are ZIP archives of XML; this reads the
 * ZIP central directory and inflates the text parts with the built-in
 * DecompressionStream ("deflate-raw"), so no extra dependency ships.
 * Best effort: anything it cannot read returns "".
 */

import { fileExtension } from "@/features/materials/note-taxonomy";

const MAX_CHARS = 60_000;

type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

function readEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory record: scan back from the end.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66_000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let n = 0; n < count && ptr + 46 <= bytes.length; n += 1) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const offset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    entries.push({ name, method, compressedSize, offset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.offset;
  if (view.getUint32(local, true) !== 0x04034b50) return "";
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") return "";
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Response(stream).text();
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|text:p|text:h)>/g, "\n")
    .replace(/<(w:tab|w:br)\b[^>]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ");
}

function slideOrder(name: string): number {
  const match = /(\d+)\.xml$/.exec(name);
  return match ? Number(match[1]) : 0;
}

/** Plain text of a Word / PowerPoint / OpenDocument / text file ("" if unreadable). */
export async function extractOfficeText(file: File): Promise<string> {
  const ext = fileExtension(file.name);
  try {
    if (["txt", "md", "tex", "csv"].includes(ext)) {
      return (await file.slice(0, MAX_CHARS * 4).text()).slice(0, MAX_CHARS);
    }
    if (ext === "rtf") {
      const raw = await file.slice(0, MAX_CHARS * 4).text();
      return raw
        .replace(/\\[a-z]+-?\d* ?/gi, " ")
        .replace(/[{}]/g, "")
        .slice(0, MAX_CHARS);
    }
    if (!["docx", "pptx", "odt", "odp"].includes(ext)) return "";
    // Office files keep their text near the front; 40 MB is plenty.
    if (file.size > 40 * 1024 * 1024) return "";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = readEntries(bytes);
    const parts =
      ext === "docx"
        ? entries.filter((e) => e.name === "word/document.xml")
        : ext === "pptx"
          ? entries
              .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
              .sort((a, b) => slideOrder(a.name) - slideOrder(b.name))
          : entries.filter((e) => e.name === "content.xml");
    let text = "";
    for (const entry of parts) {
      if (text.length >= MAX_CHARS) break;
      text += `${xmlToText(await readEntry(bytes, entry))}\n`;
    }
    return text.slice(0, MAX_CHARS);
  } catch {
    return "";
  }
}
