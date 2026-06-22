export type XmlElementWithAttributes = {
  readonly attributes: Record<string, string>;
  readonly text: string;
};

export function extractElements(xml: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "gu");
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    matches.push(match[1] ?? "");
  }

  return matches;
}

export function extractOptionalElement(xml: string, tagName: string): string | null {
  return extractElements(xml, tagName)[0] ?? null;
}

export function extractRequiredText(xml: string, tagName: string): string {
  const text = extractOptionalText(xml, tagName);

  if (text === null) {
    throw new Error(`XML is missing <${tagName}>.`);
  }

  return text;
}

export function extractOptionalText(xml: string, tagName: string): string | null {
  const element = extractOptionalElement(xml, tagName);

  return element === null ? null : decodeXml(element.trim());
}

export function extractAttributedElements(
  xml: string,
  tagName: string,
): readonly XmlElementWithAttributes[] {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)</${tagName}>`, "gu");
  const matches: XmlElementWithAttributes[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    matches.push({
      attributes: parseAttributes(match[1] ?? ""),
      text: decodeXml((match[2] ?? "").trim()),
    });
  }

  return matches;
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:-]+)="([^"]*)"/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    attributes[match[1] ?? ""] = decodeXml(match[2] ?? "");
  }

  return attributes;
}

export function decodeXml(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&");
}
