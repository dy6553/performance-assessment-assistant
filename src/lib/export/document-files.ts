import type { DraftResult } from "@/features/assessment/schemas";

type ZipEntry = { name: string; data: Uint8Array };
type PdfLine = { text: string; font: string; y: number; center?: boolean };

const utf8 = new TextEncoder();

export function draftPlainText(draft: DraftResult): string {
  return [
    draft.title,
    "",
    draft.thesisOrGoal,
    "",
    ...draft.sections.flatMap((section) => [section.heading, section.body, ""]),
  ].join("\n").trim();
}

export function downloadTextDocument(draft: DraftResult) {
  downloadBlob(
    new Blob([draftPlainText(draft)], { type: "text/plain;charset=utf-8" }),
    `${safeFilename(draft.title)}.txt`,
  );
}

export function downloadDocxDocument(draft: DraftResult) {
  const paragraphs = [
    wordParagraph(draft.title, { bold: true, size: 34, center: true, after: 260 }),
    wordParagraph(draft.thesisOrGoal, { bold: true, size: 22, after: 280 }),
    ...draft.sections.flatMap((section) => [
      wordParagraph(section.heading, { bold: true, size: 26, before: 220, after: 100 }),
      ...section.body.split("\n").map((line) => wordParagraph(line || " ", { size: 22, after: 80 })),
    ]),
  ].join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = createStoredZip([
    { name: "[Content_Types].xml", data: utf8.encode(contentTypes) },
    { name: "_rels/.rels", data: utf8.encode(rels) },
    { name: "word/document.xml", data: utf8.encode(documentXml) },
  ]);
  downloadBlob(
    new Blob([zip as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    `${safeFilename(draft.title)}.docx`,
  );
}

export function downloadHwpxDocument(draft: DraftResult) {
  const now = new Date().toISOString();
  let paragraphId = 2;
  const bodyParagraphs = [
    hwpxParagraph(draft.title, paragraphId++, 1),
    hwpxParagraph(draft.thesisOrGoal, paragraphId++, 0),
    ...draft.sections.flatMap((section) => [
      hwpxParagraph(section.heading, paragraphId++, 1),
      ...section.body.split("\n").map((line) => hwpxParagraph(line || " ", paragraphId++, 0)),
    ]),
  ].join("\n");

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>`;
  const contentHpf = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="1.0">
<opf:metadata><dc:title>${escapeXml(draft.title)}</dc:title><dc:creator>수행평가 도우미</dc:creator><dc:date>${escapeXml(now)}</dc:date><dc:language>ko-KR</dc:language></opf:metadata>
<opf:manifest><opf:item id="header" href="header.xml" media-type="application/xml"/><opf:item id="section0" href="section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest>
<opf:spine><opf:itemref idref="section0"/></opf:spine></opf:package>`;
  const headerXml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">
<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
<hh:refList>
<hh:fontfaces><hh:fontface lang="HANGUL"><hh:font name="함초롬바탕" type="TTF"/></hh:fontface></hh:fontfaces>
<hh:borderFills><hh:borderFill id="0"/></hh:borderFills>
<hh:charProperties><hh:charPr id="0" height="1000" textColor="#000000"/><hh:charPr id="1" height="1200" textColor="#000000"><hh:bold/></hh:charPr></hh:charProperties>
<hh:paraProperties><hh:paraPr id="0" align="LEFT"/></hh:paraProperties>
<hh:styles><hh:style id="0" type="PARA" name="바탕글" paraPrIDRef="0" charPrIDRef="0"/></hh:styles><hh:bullets/><hh:numberings/>
</hh:refList></hh:head>`;
  const sectionXml = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:pagePr landscape="NARROWLY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl><hp:t/></hp:run></hp:p>
${bodyParagraphs}
</hs:sec>`;
  const settingsXml = `<?xml version="1.0" encoding="UTF-8"?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"/>`;
  const versionXml = `<?xml version="1.0" encoding="UTF-8"?><ha:HCFVersion xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" targetApplication="WORDPROC" major="5" minor="1" micro="0" buildNumber="0" os="Web"/>`;

  const zip = createStoredZip([
    { name: "mimetype", data: utf8.encode("application/hwp+zip") },
    { name: "META-INF/container.xml", data: utf8.encode(containerXml) },
    { name: "Contents/content.hpf", data: utf8.encode(contentHpf) },
    { name: "Contents/header.xml", data: utf8.encode(headerXml) },
    { name: "Contents/section0.xml", data: utf8.encode(sectionXml) },
    { name: "Contents/settings.xml", data: utf8.encode(settingsXml) },
    { name: "version.xml", data: utf8.encode(versionXml) },
    { name: "Preview/PrvText.txt", data: utf8.encode(draftPlainText(draft).slice(0, 4000)) },
  ]);
  downloadBlob(new Blob([zip as BlobPart], { type: "application/hwp+zip" }), `${safeFilename(draft.title)}.hwpx`);
}

export async function downloadPdfDocument(draft: DraftResult) {
  const width = 1240;
  const height = 1754;
  const marginX = 105;
  const top = 105;
  const bottom = 120;
  const maxWidth = width - marginX * 2;
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = width;
  measureCanvas.height = height;
  const measure = measureCanvas.getContext("2d");
  if (!measure) throw new Error("PDF_CANVAS_UNAVAILABLE");

  const pages: PdfLine[][] = [[]];
  let pageIndex = 0;
  let y = top;

  const addText = (text: string, font: string, lineHeight: number, gapAfter: number, center = false) => {
    const wrapped = wrapCanvasText(measure, text, font, maxWidth);
    for (const line of wrapped) {
      if (y + lineHeight > height - bottom) {
        pages.push([]);
        pageIndex += 1;
        y = top;
      }
      pages[pageIndex].push({ text: line, font, y, center });
      y += lineHeight;
    }
    y += gapAfter;
  };

  addText(draft.title, "700 40px sans-serif", 54, 26, true);
  addText(draft.thesisOrGoal, "700 24px sans-serif", 38, 30);
  for (const section of draft.sections) {
    addText(section.heading, "700 29px sans-serif", 42, 12);
    addText(section.body, "400 23px sans-serif", 38, 24);
  }

  const jpegPages: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  for (const lines of pages) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF_CANVAS_UNAVAILABLE");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#111827";
    ctx.textBaseline = "top";
    for (const line of lines) {
      ctx.font = line.font;
      const x = line.center ? Math.max(marginX, (width - ctx.measureText(line.text).width) / 2) : marginX;
      ctx.fillText(line.text, x, line.y);
    }
    const blob = await canvasBlob(canvas, "image/jpeg", 0.94);
    jpegPages.push({ bytes: new Uint8Array(await blob.arrayBuffer()), width, height });
  }

  const pdf = createImagePdf(jpegPages);
  downloadBlob(new Blob([pdf as BlobPart], { type: "application/pdf" }), `${safeFilename(draft.title)}.pdf`);
}

function wordParagraph(
  text: string,
  options: { bold?: boolean; size?: number; center?: boolean; before?: number; after?: number } = {},
) {
  const size = options.size ?? 22;
  const pPr = `<w:pPr>${options.center ? '<w:jc w:val="center"/>' : ""}<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 80}" w:line="360" w:lineRule="auto"/></w:pPr>`;
  const rPr = `<w:rPr>${options.bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="ko-KR"/></w:rPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function hwpxParagraph(text: string, id: number, charPrId: number) {
  return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrId}"><hp:t>${escapeXml(text)}</hp:t></hp:run></hp:p>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function safeFilename(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned || "수행평가-완성본";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createStoredZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = dosDateTime(new Date());

  for (const entry of entries) {
    const name = utf8.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function dosDateTime(dateValue: Date) {
  const year = Math.max(1980, dateValue.getFullYear());
  const date = ((year - 1980) << 9) | ((dateValue.getMonth() + 1) << 5) | dateValue.getDate();
  const time = (dateValue.getHours() << 11) | (dateValue.getMinutes() << 5) | Math.floor(dateValue.getSeconds() / 2);
  return { date, time };
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number) {
  ctx.font = font;
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      result.push("");
      continue;
    }
    let line = "";
    for (const char of paragraph) {
      const candidate = line + char;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        result.push(line);
        line = char;
      } else {
        line = candidate;
      }
    }
    if (line) result.push(line);
  }
  return result.length ? result : [""];
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PDF_RENDER_FAILED"))), type, quality);
  });
}

function createImagePdf(images: Array<{ bytes: Uint8Array; width: number; height: number }>) {
  const objectCount = 2 + images.length * 3;
  const objects = new Array<Uint8Array>(objectCount);
  const pageIds = images.map((_, index) => 3 + index * 3);
  objects[0] = utf8.encode(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects[1] = utf8.encode(`2 0 obj\n<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj\n`);

  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const mediaWidth = 595.28;
    const mediaHeight = 841.89;
    const content = `q\n${mediaWidth} 0 0 ${mediaHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    objects[pageId - 1] = utf8.encode(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mediaWidth} ${mediaHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    objects[contentId - 1] = utf8.encode(`${contentId} 0 obj\n<< /Length ${utf8.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    objects[imageId - 1] = concatBytes([
      utf8.encode(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
      image.bytes,
      utf8.encode("\nendstream\nendobj\n"),
    ]);
  });

  const header = utf8.encode("%PDF-1.4\n");
  const offsets = [0];
  let cursor = header.length;
  for (const object of objects) {
    offsets.push(cursor);
    cursor += object.length;
  }
  const xrefOffset = cursor;
  const xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return concatBytes([header, ...objects, utf8.encode(xref), utf8.encode(trailer)]);
}
