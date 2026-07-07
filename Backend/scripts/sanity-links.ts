// Sanity checks for the internal-link + meta quality bar. Run: npx tsx scripts/sanity-links.ts
import {
  anchorMatchesPageText,
  findAnchorForPage,
  buildInternalLinksFromPages,
  scorePageRelevance,
  isQualityAnchor,
} from '../lib/url-matcher';
import { finalizeMetaTitle, finalizeMetaDescription } from '../lib/meta';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  →`, actual, ok ? '' : `(expected ${JSON.stringify(expected)})`);
}

// ── Anchor ↔ page pairing ──────────────────────────────────────────────────

// 1. Generic descriptor alone must NOT confirm a pairing
check(
  "'luxury hotels' vs skincare page",
  anchorMatchesPageText('luxury hotels', 'Luxury Skincare Routines for Glowing Skin'),
  false
);

// 2. Short topic nouns (3 letters) now count as exact matches
check(
  "'luxury spa' vs spa page",
  anchorMatchesPageText('luxury spa', 'The Best Spa Retreats in Bali'),
  true
);

// 3. Real naming match still passes
check(
  "'Hotel Heaven' vs Hotel Heaven page",
  anchorMatchesPageText('Hotel Heaven', 'Hotel Heaven: The New Album Reviewed'),
  true
);

// 4. Shared filler like 'guide'/'best' must not confirm
check(
  "'ultimate guide' vs fashion guide page",
  anchorMatchesPageText('ultimate guide', 'The Ultimate Guide to Paris Fashion Week'),
  false
);

const content = `Iceland has always felt otherworldly to me. On my last trip I spent three days
soaking in geothermal pools outside Reykjavik, watching steam rise against a slate sky.

The spa culture there is unlike anywhere else. Between soaks we tried local wellness
rituals, cold plunges and long slow breakfasts.

If you love winter travel, Iceland rewards the effort. Pack layers, book the pools
early, and give yourself one morning with no plans at all.`;

// 5. Anchor chosen to NAME the destination page's real title
const anchor = findAnchorForPage(
  content,
  {
    url: 'https://houseofcoco.net/geothermal-pools-iceland-spa-guide/',
    pageTitle: "Iceland's Geothermal Pools: A Spa Lover's Guide",
    pageDescription: 'Where to soak in Iceland, from Blue Lagoon to hidden hot springs.',
  },
  'iceland spa travel'
);
console.log('findAnchorForPage →', JSON.stringify(anchor));
check('anchor exists verbatim in article', anchor !== null && content.toLowerCase().includes(anchor.toLowerCase()), true);
check('anchor passes quality bar', anchor !== null && isQualityAnchor(anchor), true);

// 6. Page with no naming phrase in the article must yield NO link
const noAnchor = findAnchorForPage(
  content,
  {
    url: 'https://houseofcoco.net/best-london-bingo-halls/',
    pageTitle: 'The Best Bingo Halls in East London',
    pageDescription: 'Our pick of London bingo nights.',
  },
  'iceland spa travel'
);
check('irrelevant page gets no anchor', noAnchor, null);

// 7. buildInternalLinksFromPages: ranks by pageScore, skips unmatchable pages
const links = buildInternalLinksFromPages(
  content,
  [
    { url: 'https://houseofcoco.net/best-london-bingo-halls/', pageTitle: 'The Best Bingo Halls in East London', pageDescription: '', pageScore: 30 },
    { url: 'https://houseofcoco.net/geothermal-pools-iceland-spa-guide/', pageTitle: "Iceland's Geothermal Pools: A Spa Lover's Guide", pageDescription: 'Where to soak in Iceland.', pageScore: 25 },
    { url: 'https://houseofcoco.net/winter-travel-essentials/', pageTitle: 'Winter Travel Essentials: What to Pack', pageDescription: 'Layers, boots and more for cold-weather trips.', pageScore: 20 },
  ],
  'iceland spa travel',
  7
);
console.log('buildInternalLinksFromPages →', links);
check('bingo page excluded', links.every((l) => !l.url.includes('bingo')), true);
check('got links for the two relevant pages', links.length, 2);
check('every anchor verbatim in article', links.every((l) => content.toLowerCase().includes(l.anchorText.toLowerCase())), true);

// 8. scorePageRelevance: generic keyword word must not inflate the score
const page = { title: 'The Best Handbags of 2026', description: 'Our favourite designer bags.', headings: [], bodyText: '' };
const rel = scorePageRelevance(page, content, 'best souvenirs new zealand');
console.log('scorePageRelevance (irrelevant page) →', rel);
check("'best' adds nothing", rel.score, 0);

// ── Meta title / description finalisation ──────────────────────────────────

// 9. Missing keyword → rebuilt from keyword + the article's own opening
const d1 = finalizeMetaDescription(
  'A lovely piece about hot springs and slow mornings up north for wellness fans.',
  content,
  'Iceland spa retreats'
);
console.log('meta fallback →', JSON.stringify(d1));
check('fallback contains exact keyword', d1.toLowerCase().includes('iceland spa retreats'), true);
check('fallback ≤155 chars', d1.length <= 155, true);

// 10. Valid description with the keyword passes through untouched
const good =
  'Iceland spa retreats from geothermal pools to slow mornings, with tips on when to soak and what to pack for the cold.';
check('good meta kept as-is', finalizeMetaDescription(good, content, 'Iceland spa retreats'), good);

// 11. Overlong description trimmed at a SENTENCE boundary, keyword kept
const long =
  'Iceland spa retreats are the highlight of any trip to the north. ' +
  'We cover geothermal pools, wellness rituals and cold plunges in detail. ' +
  'Plus a full packing list for winter travellers heading out this season.';
const d2 = finalizeMetaDescription(long, content, 'iceland spa retreats');
console.log('meta trimmed →', JSON.stringify(d2));
check('trimmed ≤155 chars', d2.length <= 155, true);
check('trimmed keeps keyword', d2.toLowerCase().includes('iceland spa retreats'), true);
check('trimmed ends at sentence', /[.!?]$/.test(d2), true);

// 12. Brand suffix stripped from meta title, no mid-word cuts
check(
  'brand suffix stripped',
  finalizeMetaTitle('Best Spa Retreats in Iceland | House of Coco'),
  'Best Spa Retreats in Iceland'
);
const longTitle = finalizeMetaTitle('The Complete Winter Wellness and Geothermal Spa Guide for Iceland');
console.log('long title →', JSON.stringify(longTitle));
check('title ≤55 chars', longTitle.length <= 55, true);
check('title never ends mid-word', /[A-Za-z0-9]$/.test(longTitle) && !longTitle.endsWith(' '), true);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
