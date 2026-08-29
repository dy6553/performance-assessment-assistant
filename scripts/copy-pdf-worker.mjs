import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const target = resolve("public/pdf.worker.min.mjs");
const candidates = [
  resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
];

let source = "";
for (const candidate of candidates) {
  try {
    await access(candidate);
    source = candidate;
    break;
  } catch {
    // Try the next pdfjs-dist worker location.
  }
}

if (!source) {
  throw new Error("pdfjs-dist PDF worker file was not found.");
}

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
const worker = await stat(target);
console.log(`Copied PDF.js worker (${worker.size} bytes) to ${target}`);
