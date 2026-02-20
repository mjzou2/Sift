import Anthropic from '@anthropic-ai/sdk';
import { getPhrases } from './embeddings';

const TAGS = [
  'piano', 'guitar',
  'sad', 'melancholic', 'nostalgic', 'hopeful', 'peaceful', 'dark', 'lonely',
  'slow', 'mellow', 'sleepy', 'upbeat', 'groovy', 'bossa nova',
  'vinyl crackle', 'ambient', 'spacey', 'bass-heavy', 'minimal',
  'rain', 'ocean', 'night', 'cafe', 'winter', 'home', 'nature', 'space',
  'cozy', 'warm', 'dreamy', 'focus', 'jazz', 'chill',
] as const;

const TAG_SET = new Set<string>(TAGS);

const SYSTEM_PROMPT = `You are a music tag extractor for a lofi music discovery app. Given a user's description, pick 2-5 tags from this vocabulary that best match their vibe:

${TAGS.join(', ')}

Respond with ONLY a JSON array of tags, nothing else. Example: ["sad", "piano", "rain"]`;

/**
 * Call Claude Haiku to extract relevant tags from a user prompt.
 * Returns empty array on any failure (missing key, API error, bad response).
 * Never throws.
 */
export async function extractTags(prompt: string): Promise<string[]> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[claude] No ANTHROPIC_API_KEY set, skipping');
      return [];
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const tags: unknown = JSON.parse(text);

    // Validate: must be an array of strings that exist in our vocabulary
    if (!Array.isArray(tags)) {
      console.log('[claude] Response is not an array:', text);
      return [];
    }

    const validTags = tags.filter(
      (t): t is string => typeof t === 'string' && TAG_SET.has(t)
    );

    console.log(`[claude] Extracted tags: ${JSON.stringify(validTags)} from "${prompt}"`);
    return validTags;

  } catch (error) {
    console.log(`[claude] Failed: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

/**
 * Find the best matching pre-embedded phrase given a set of tags.
 * Scores each phrase by counting how many tags appear as substrings.
 * Returns phrase index, or -1 if no phrase matches any tag.
 */
export function findClosestPhraseByTags(tags: string[]): number {
  const phrases = getPhrases();

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i].toLowerCase();
    let score = 0;

    for (const tag of tags) {
      if (phrase.includes(tag.toLowerCase())) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    console.log(`[claude] Matched tags ${JSON.stringify(tags)} to phrase "${phrases[bestIndex]}" (score: ${bestScore}/${tags.length})`);
  }

  return bestIndex;
}
