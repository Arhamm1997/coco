/**
 * Meta title / description finalisation. The AI is instructed to produce
 * compliant fields, but models drift: they append site names, exceed length
 * limits, cut off mid-word, or drop the primary keyword. These helpers enforce
 * the rules deterministically — grounded in the article itself — so the meta
 * fields are always correct and always contain the primary keyword.
 */

// Google shows roughly this many characters of a description; never exceed it.
const MAX_DESC = 155;
// Anything shorter than this cannot meaningfully describe the article.
const MIN_DESC = 70;
const MAX_TITLE = 55;

/** Cut a string at a word boundary so it never ends mid-word. */
export function trimAtWordBoundary(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, max)).replace(
    /[,;:\-–—\s]+$/,
    ''
  );
}

/**
 * Final meta title: strip any brand suffix the AI was told not to add, then
 * trim to 55 characters at a WORD boundary — never a mid-word cut.
 */
export function finalizeMetaTitle(raw: string): string {
  const noBrand = raw
    .trim()
    .replace(/\s*[|\-–—]\s*(house\s+of\s+coco|hoc)\s*$/i, '')
    .trim();
  return trimAtWordBoundary(noBrand, MAX_TITLE);
}

// The article's first real sentence — a description built from it is always
// grounded in what the post actually says.
function firstArticleSentence(content: string): string {
  const text = content
    .replace(/^#{1,6}\s+.*$/gm, ' ') // markdown headings are titles, not prose
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = text.match(/[A-Z][^.!?]{30,}?[.!?]/);
  return (m ? m[0] : text.slice(0, 120)).trim();
}

function closeSentence(s: string): string {
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

// Deterministic fallback: lead with the primary keyword, then the article's
// own opening idea — keyword guaranteed, content guaranteed.
function buildFallbackDescription(content: string, pk: string): string {
  const lead = pk.charAt(0).toUpperCase() + pk.slice(1);
  let desc = `${lead}: ${firstArticleSentence(content)}`;
  if (desc.length > MAX_DESC) {
    desc = closeSentence(trimAtWordBoundary(desc, MAX_DESC - 1));
  }
  return closeSentence(desc);
}

/**
 * Final meta description. Keeps the AI's wording when it is genuinely valid:
 * a substantial, complete description that contains the EXACT primary keyword.
 * Otherwise repairs it deterministically:
 *   • keyword missing or description too short → rebuild from the keyword +
 *     the article's own first sentence (never invented content)
 *   • too long → keep whole sentences that fit; else cut at a word boundary —
 *     never a mid-word chop, and the keyword must survive the trim
 */
export function finalizeMetaDescription(
  raw: string,
  content: string,
  primaryKeyword: string
): string {
  const pk = primaryKeyword.trim().replace(/\s+/g, ' ');
  const desc = raw.replace(/\s+/g, ' ').trim();

  const hasKeyword = (s: string) => s.toLowerCase().includes(pk.toLowerCase());

  if (desc.length < MIN_DESC || !hasKeyword(desc)) {
    return buildFallbackDescription(content, pk);
  }

  if (desc.length <= MAX_DESC) return desc;

  // Too long — prefer ending at a full sentence.
  const sentences = desc.match(/[^.!?]+[.!?]+/g) || [];
  let kept = '';
  for (const s of sentences) {
    if ((kept + s).trim().length > MAX_DESC) break;
    kept += s;
  }
  kept = kept.trim();
  if (kept.length >= MIN_DESC && hasKeyword(kept)) return kept;

  const cut = closeSentence(trimAtWordBoundary(desc, MAX_DESC - 1));
  return hasKeyword(cut) ? cut : buildFallbackDescription(content, pk);
}
