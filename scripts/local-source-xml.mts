import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { SaxesParser } from "saxes";
import { type LocalSource } from "./local-source-manifest.mts";

export type SourceNode = { name: string; attributes: Record<string, string>; text: string; children: SourceNode[] };
export const children = (node: SourceNode, name: string) => node.children.filter((child) => child.name === name);
export const textOf = (node: SourceNode, name: string) => children(node, name).map((child) => child.text.trim());
const escapeXml = (value: string) => value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
export function serializeNode(node: SourceNode): string {
  const attributes = Object.entries(node.attributes).map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join("");
  if (!node.text && node.children.length === 0) return `<${node.name}${attributes}/>`;
  return `<${node.name}${attributes}>${escapeXml(node.text)}${node.children.map(serializeNode).join("")}</${node.name}>`;
}

export async function scanSourceXml(source: LocalSource, root: string, record: string, visit: (node: SourceNode) => void, signal = AbortSignal.timeout(120_000)): Promise<number> {
  const parser = new SaxesParser({ xmlns: false });
  const hash = createHash("sha256");
  let depth = 0;
  let bytes = 0;
  let sinceRecord = 0;
  let nodes = 0;
  let count = 0;
  const stack: SourceNode[] = [];
  parser.on("doctype", (doctype) => {
    if (doctype.length > 262_144 || /<!ENTITY\s+(?:%|[^>]*\b(?:SYSTEM|PUBLIC)\b)/u.test(doctype)) throw new Error("Unsafe source DTD.");
    let definitions = 0;
    for (const match of doctype.matchAll(/<!ENTITY\s+([A-Za-z][\w.-]*)\s+(["'])(.*?)\2\s*>/gsu)) {
      const [, name, , value] = match;
      if (++definitions > 2048 || value!.length > 1024 || /[&%<>]/u.test(value!) || ["amp", "lt", "gt", "apos", "quot", "constructor", "prototype"].includes(name!)) throw new Error("Unsafe source entity.");
      parser.ENTITIES[name!] = value!;
    }
  });
  parser.on("opentag", (tag) => {
    depth++;
    if (depth > 64 || (depth === 1 && tag.name !== root)) throw new Error("Unexpected source XML root/depth.");
    if (depth === 2 && tag.name === record) nodes = 0;
    if (stack.length > 0 || (depth === 2 && tag.name === record)) {
      if (++nodes > 20_000) throw new Error("Source record is too complex.");
      const node: SourceNode = { name: tag.name, attributes: { ...tag.attributes }, text: "", children: [] };
      stack.at(-1)?.children.push(node);
      stack.push(node);
    }
  });
  const append = (text: string) => {
    const current = stack.at(-1);
    if (current) {
      current.text += text;
      if (current.text.length > 1_048_576) throw new Error("Source text exceeds its record budget.");
    }
  };
  parser.on("text", append);
  parser.on("cdata", append);
  parser.on("closetag", () => {
    if (stack.length > 0) {
      const node = stack.pop()!;
      if (stack.length === 0) {
        if (++count > 1_000_000) throw new Error("Source record budget exceeded.");
        visit(node);
        sinceRecord = 0;
      }
    }
    depth--;
  });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for await (const chunk of createReadStream(source.path, { highWaterMark: 16_384, signal })) {
    signal.throwIfAborted();
    bytes += chunk.length;
    sinceRecord += chunk.length;
    if (bytes > 1_073_741_824 || sinceRecord > 2_097_152) throw new Error("Source XML exceeds its byte budget.");
    hash.update(chunk);
    parser.write(decoder.decode(chunk, { stream: true }));
  }
  parser.write(decoder.decode()).close();
  if (hash.digest("hex") !== source.contentSha256) throw new Error("Source changed while being inspected.");
  if (count === 0) throw new Error("Source contains no expected records.");
  return count;
}
