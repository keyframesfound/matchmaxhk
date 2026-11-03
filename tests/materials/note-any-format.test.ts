import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { classifyUploadFile } from "../../src/features/materials/note-taxonomy";
import { extractOfficeText } from "../../src/features/materials/office-text";

describe("any upload format", () => {
  it("accepts every format except programs and scripts", () => {
    expect(classifyUploadFile("notes.docx")).toBe("word");
    expect(classifyUploadFile("slides.pptx")).toBe("powerpoint");
    expect(classifyUploadFile("scan.heic")).toBe("image");
    expect(classifyUploadFile("model.blend")).toBe("other");
    expect(classifyUploadFile("README")).toBe("other");
    expect(classifyUploadFile("setup.exe")).toBeNull();
    expect(classifyUploadFile("run.sh")).toBeNull();
  });
});

/** Minimal ZIP writer (deflated entries) for test fixtures. */
function makeZip(files: Record<string, string>): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(text);
    const data = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, cdBuf, end]));
}

describe("office text extraction", () => {
  it("reads Word and PowerPoint text in order", async () => {
    const docx = makeZip({
      "word/document.xml":
        "<w:document><w:body><w:p><w:r><w:t>日內交易速查表</w:t></w:r></w:p><w:p><w:r><w:t>Entry &amp; exit rules</w:t></w:r></w:p></w:body></w:document>",
    });
    const pptx = makeZip({
      "ppt/slides/slide2.xml": "<p:sld><a:p><a:r><a:t>Slide two</a:t></a:r></a:p></p:sld>",
      "ppt/slides/slide1.xml": "<p:sld><a:p><a:r><a:t>Slide one 第一頁</a:t></a:r></a:p></p:sld>",
    });
    expect(await extractOfficeText(new File([docx as BlobPart], "a.docx"))).toContain(
      "日內交易速查表\nEntry & exit rules",
    );
    const ppt = await extractOfficeText(new File([pptx as BlobPart], "b.pptx"));
    expect(ppt.indexOf("Slide one 第一頁")).toBeGreaterThanOrEqual(0);
    expect(ppt.indexOf("Slide one 第一頁")).toBeLessThan(ppt.indexOf("Slide two"));
  });
});
