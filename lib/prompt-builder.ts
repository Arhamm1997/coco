import { BuildPromptArgs } from '@/types';

export function buildPrompt({ content, primaryKeyword, liveURLs }: BuildPromptArgs): string {
  const urlList = liveURLs
    .map(
      (u, i) =>
        `${i + 1}. URL: ${u.url}\n   Suggested anchor text (exists in content): "${u.anchorText}"`
    )
    .join('\n');

  return `
You are an expert SEO content optimizer.

PRIMARY KEYWORD: "${primaryKeyword}"

USER'S CONTENT:
---
${content}
---

AVAILABLE INTERNAL LINKS (all verified live, anchor text confirmed to exist word-for-word in the content above):
${urlList}

---

YOUR TASK:

Generate SEO-optimised content and return it in the EXACT format specified below.
No explanations, no markdown code blocks, no extra text outside the format.

RULES:
1. H2 must be relevant to the content topic and include or relate to the primary keyword
2. H3 comes before Paragraph 2
3. Each paragraph must be approximately 100 words, well-written and natural
4. Meta title: MAXIMUM 55 characters — must include the primary keyword naturally
5. Meta description: MAXIMUM 145 characters — must include the primary keyword naturally
6. Select exactly 3 internal links from the provided list
7. CRITICAL: For each link, use only the EXACT anchor text shown next to the URL — do NOT invent new phrases
8. Only use URLs from the provided verified live list

---

OUTPUT FORMAT (copy this structure exactly):

H2: [heading here]

PARAGRAPH1: [~100 words]

H3: [heading here]

PARAGRAPH2: [~100 words]

META_TITLE: [max 55 chars]

META_DESC: [max 145 chars]

LINK1_ANCHOR: [exact anchor text from content]
LINK1_URL: [url]

LINK2_ANCHOR: [exact anchor text from content]
LINK2_URL: [url]

LINK3_ANCHOR: [exact anchor text from content]
LINK3_URL: [url]

PLACEMENT: [1-2 sentences recommending where in the article to insert this new content section]
`.trim();
}

export function buildSystemPrompt(): string {
  return `You are a professional SEO specialist and content writer.
You write clear, engaging, and SEO-optimised content.
You strictly follow all formatting instructions.
You never exceed character limits.
You only use anchor texts that are explicitly provided to you.
You always write in the same language and tone as the provided user content.
You return ONLY the formatted output — never add explanations or commentary.`;
}
