import { InternalLink, ParsedOutput } from '@/types';

export function parseAIResponse(text: string, originalContent: string): ParsedOutput {
  // Primary: XML tag parser — collects all links without anchor validation
  // (route.ts validates anchors against article + generated paragraphs)
  const xmlResult = parseXMLFormat(text);
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

// The parser collects ALL links Claude outputs — it does NOT validate anchor text.
// Verbatim + relevance validation is done in route.ts with the full searchable
// content (original article + generated paragraphs). Rejecting here would drop
// valid links before the expanded check ever runs.
function parseLinks(raw: string): InternalLink[] {
  const links: InternalLink[] = [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
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
    const url = stripQuotes(parts[1]).replace(/[<>]/g, '').trim();

    // Clean up common trailing punctuation the AI sometimes appends
    const cleanedUrl = url.replace(/[.,;\)\]]+$/g, '').trim();

    // Minimal sanity check only — route.ts handles full validation
    if (!anchor || anchor.length < 2 || !cleanedUrl || !cleanedUrl.startsWith('http')) continue;

    links.push({ anchorText: anchor, url: cleanedUrl, isLive: true });
  }

  return links;
}

function parseXMLFormat(text: string): ParsedOutput {
  return {
    h2:                      extractXMLTag(text, 'h2') || 'SEO Optimised Section',
    h3:                      extractXMLTag(text, 'h3') || 'Key Insights',
    paragraph1:              extractXMLTag(text, 'paragraph1'),
    paragraph2:              extractXMLTag(text, 'paragraph2'),
    metaTitle:               stripQuotes(extractXMLTag(text, 'meta_title')).substring(0, 55),
    metaDescription:         stripQuotes(extractXMLTag(text, 'meta_description')).substring(0, 145),
    internalLinks:           parseLinks(extractXMLTag(text, 'links')),
    placementRecommendation: stripQuotes(extractXMLTag(text, 'placement')),
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
      internalLinks.push({ anchorText: stripQuotes(anchor), url: stripQuotes(url).replace(/[.,;\)\]]+$/g, ''), isLive: true });
    }
  }

  return {
    h2:                      extract('H2:') || 'SEO Optimised Section',
    h3:                      extract('H3:') || 'Key Insights',
    paragraph1:              extractMultiline('PARAGRAPH1:', ['H3:', 'META_TITLE:', 'LINK1_ANCHOR:']),
    paragraph2:              extractMultiline('PARAGRAPH2:', ['META_TITLE:', 'META_DESC:', 'LINK1_ANCHOR:']),
    metaTitle:               extract('META_TITLE:').substring(0, 55),
    metaDescription:         stripQuotes(extract('META_DESC:')).substring(0, 145),
    internalLinks,
    placementRecommendation: extractMultiline('PLACEMENT:', []),
  };
}
