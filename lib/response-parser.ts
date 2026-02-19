import { InternalLink, ParsedOutput } from '@/types';

export function parseAIResponse(text: string, originalContent: string): ParsedOutput {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Extract a single-line value by prefix
  const extract = (prefix: string): string => {
    const line = lines.find((l) => l.startsWith(prefix));
    return line ? line.replace(prefix, '').trim() : '';
  };

  // Extract a multiline value that starts at prefix and ends at the next known prefix
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

  const h2 = extract('H2:');
  const h3 = extract('H3:');

  const paragraph1 = extractMultiline('PARAGRAPH1:', ['H3:', 'META_TITLE:', 'LINK1_ANCHOR:']);
  const paragraph2 = extractMultiline('PARAGRAPH2:', ['META_TITLE:', 'META_DESC:', 'LINK1_ANCHOR:']);

  // Enforce hard character limits on meta fields
  const metaTitle = extract('META_TITLE:').substring(0, 55);
  const metaDescription = extract('META_DESC:').substring(0, 145);

  // Parse exactly 3 internal links
  const internalLinks: InternalLink[] = [];
  for (let i = 1; i <= 3; i++) {
    const anchor = extract(`LINK${i}_ANCHOR:`);
    const url = extract(`LINK${i}_URL:`);

    if (!anchor || !url) continue;

    // Post-AI validation: anchor must exist word-for-word in original content
    const anchorExistsInContent = originalContent
      .toLowerCase()
      .includes(anchor.toLowerCase());

    if (anchorExistsInContent) {
      internalLinks.push({
        anchorText: anchor,
        url,
        isLive: true, // Already HEAD-checked before AI call
      });
    }
  }

  const placementRecommendation = extractMultiline('PLACEMENT:', []);

  return {
    h2: h2 || 'SEO Optimised Section',
    h3: h3 || 'Key Insights',
    paragraph1,
    paragraph2,
    metaTitle,
    metaDescription,
    internalLinks,
    placementRecommendation,
  };
}
