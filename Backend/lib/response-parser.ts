import { InternalLink, ParsedOutput } from '@/types';

export function parseAIResponse(text: string, originalContent: string): ParsedOutput {
  // Primary: XML tag parser (matches new HOC prompt format)
  const xmlResult = parseXMLFormat(text, originalContent);
  if (xmlResult.h2 && xmlResult.paragraph1) return xmlResult;

  // Fallback: label-based parser (backward compatibility)
  return parseLabelFormat(text, originalContent);
}

function extractXMLTag(text: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

// Strip surrounding quotes (curly or straight) that AI sometimes wraps around text
function stripQuotes(s: string): string {
  return s
    .replace(/^[“”‘’«»"'`]+/, '')
    .replace(/[“”‘’«»"'`]+$/, '')
    .trim();
}

function parseLinks(raw: string, originalContent: string): InternalLink[] {
  const links: InternalLink[] = [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip decorative lines
    if (!line.includes('|')) continue;

    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 2) continue;

    // Strip leading list markers (1., 2., -, •), bold markdown (**), then quotes
    const anchor = stripQuotes(
      parts[0]
        .replace(/^\d+\.\s*/, '')
        .replace(/^[-•*]\s*/, '')
        .replace(/\*\*/g, '')
    );
    const url = stripQuotes(parts[1]).replace(/[<>]/g, '').trim(); // also strip angle brackets

    // Must have content and a valid URL
    if (!anchor || !url || !url.startsWith('http')) continue;

    // Anchor must exist verbatim (case-insensitive) in the article
    if (originalContent.toLowerCase().includes(anchor.toLowerCase())) {
      links.push({ anchorText: anchor, url, isLive: true });
    }
  }

  return links;
}

function parseXMLFormat(text: string, originalContent: string): ParsedOutput {
  return {
    h2:                      extractXMLTag(text, 'h2') || 'SEO Optimised Section',
    h3:                      extractXMLTag(text, 'h3') || 'Key Insights',
    paragraph1:              extractXMLTag(text, 'paragraph1'),
    paragraph2:              extractXMLTag(text, 'paragraph2'),
    metaTitle:               extractXMLTag(text, 'meta_title').substring(0, 55),
    metaDescription:         extractXMLTag(text, 'meta_description').substring(0, 145),
    internalLinks:           parseLinks(extractXMLTag(text, 'links'), originalContent),
    placementRecommendation: extractXMLTag(text, 'placement'),
  };
}

function parseLabelFormat(text: string, originalContent: string): ParsedOutput {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const extract = (prefix: string): string => {
    const line = lines.find((l) => l.startsWith(prefix));
    return line ? line.replace(prefix, '').trim() : '';
  };

  const extractMultiline = (startPrefix: string, endPrefixes: string[]): string => {
    const startIdx = lines.findIndex((l) => l.startsWith(startPrefix));
    if (startIdx === -1) return '';
    const endIdx = lines.findIndex(
      (l, i) => i > startIdx && endPrefixes.some((p) => l.startsWith(p))
    );
    const relevantLines =
      endIdx === -1 ? lines.slice(startIdx + 1) : lines.slice(startIdx + 1, endIdx);
    return relevantLines.join(' ').trim();
  };

  const internalLinks: InternalLink[] = [];
  for (let i = 1; i <= 3; i++) {
    const anchor = extract(`LINK${i}_ANCHOR:`);
    const url = extract(`LINK${i}_URL:`);
    if (!anchor || !url) continue;
    if (originalContent.toLowerCase().includes(anchor.toLowerCase())) {
      internalLinks.push({ anchorText: anchor, url, isLive: true });
    }
  }

  return {
    h2:                      extract('H2:') || 'SEO Optimised Section',
    h3:                      extract('H3:') || 'Key Insights',
    paragraph1:              extractMultiline('PARAGRAPH1:', ['H3:', 'META_TITLE:', 'LINK1_ANCHOR:']),
    paragraph2:              extractMultiline('PARAGRAPH2:', ['META_TITLE:', 'META_DESC:', 'LINK1_ANCHOR:']),
    metaTitle:               extract('META_TITLE:').substring(0, 55),
    metaDescription:         extract('META_DESC:').substring(0, 145),
    internalLinks,
    placementRecommendation: extractMultiline('PLACEMENT:', []),
  };
}
