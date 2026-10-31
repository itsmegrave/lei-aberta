/**
 * Minimal ZIP reader (no dependencies): finds an entry through the central directory and streams it,
 * inflated, as text. Enough for the open-data dumps, which are single-file "deflate" or "stored" archives.
 */
import { Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

export function zipEntries(buf: Buffer): Entry[] {
  // End of central directory record: signature 0x06054b50, within the last 64 KiB + 22 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    out.push({ name, method, compressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Raw bytes of one entry, still compressed. */
function entryData(buf: Buffer, e: Entry): Buffer {
  const p = e.localHeaderOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error("bad local header");
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  return buf.subarray(start, start + e.compressedSize);
}

/** Streams the first entry whose name ends with `suffix` (or the first entry) as decoded text chunks. */
export async function* zipTextChunks(buf: Buffer, suffix?: string): AsyncGenerator<string> {
  const entries = zipEntries(buf).filter((e) => !e.name.endsWith("/"));
  const e = (suffix && entries.find((x) => x.name.toLowerCase().endsWith(suffix.toLowerCase()))) || entries[0];
  if (!e) throw new Error("empty zip");
  const data = entryData(buf, e);
  if (e.method !== 0 && e.method !== 8) throw new Error(`unsupported zip method ${e.method}`);
  const stream = e.method === 0 ? Readable.from([data]) : Readable.from([data]).pipe(createInflateRaw());
  yield* decodeXmlStream(stream);
}

/** Decodes a byte stream as text, honoring the XML declaration's encoding (UTF-8 or ISO-8859-1/Windows-1252). */
export async function* decodeXmlStream(bytes: AsyncIterable<Buffer | Uint8Array> | Iterable<Buffer | Uint8Array>): AsyncGenerator<string> {
  let decoder: TextDecoder | null = null;
  for await (const chunk of bytes) {
    if (!decoder) {
      const head = Buffer.from(chunk.subarray(0, 200)).toString("latin1");
      const enc = /encoding=["']([^"']+)["']/i.exec(head)?.[1]?.toLowerCase() ?? "utf-8";
      decoder = new TextDecoder(/8859|latin|1252/.test(enc) ? "windows-1252" : "utf-8");
    }
    yield decoder.decode(chunk, { stream: true });
  }
  if (decoder) yield decoder.decode();
}

/** Calls `fn` with the inner text of every <tag>...</tag> element found in a stream of text chunks. */
export async function forEachElement(chunks: AsyncIterable<string>, tag: string, fn: (xml: string) => void): Promise<number> {
  const open = new RegExp(`<${tag}(\\s[^>]*)?>`, "i");
  const close = new RegExp(`</${tag}\\s*>`, "gi");
  let buf = "";
  let n = 0;
  for await (const c of chunks) {
    buf += c;
    for (;;) {
      const m = open.exec(buf);
      if (!m) {
        // Keep a tail in case an opening tag is split across chunks.
        buf = buf.slice(-tag.length - 64);
        break;
      }
      close.lastIndex = m.index + m[0].length;
      const end = close.exec(buf);
      if (!end) {
        buf = buf.slice(m.index);
        break;
      }
      fn(buf.slice(m.index + m[0].length, end.index));
      n++;
      buf = buf.slice(end.index + end[0].length);
    }
  }
  return n;
}

/** Text of the first <name> child in a small XML fragment, entity-decoded; "" when missing or empty. */
export function child(xml: string, name: string): string {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decodeXml(m[1]).trim() : "";
}

/** All <name> children (for repeated elements such as <idsTemas>). */
export function children(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi"))].map((m) => decodeXml(m[1]).trim());
}

export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, code: string) => {
      const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
      if (code[0] !== "#") return named[code.toLowerCase()] ?? all;
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    });
}
