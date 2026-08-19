import { readFile } from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { AiReview } from '../entities/Submission';

/**
 * Anthropic vision review of a chore proof photo.
 *
 * Returns a structured { summary, recommendedScore, reasoning } object so the
 * parent gets a recommended score alongside the description, instead of the
 * plain-text summary this used to produce.
 *
 * Every failure path returns null rather than throwing: an AI outage, a missing
 * API key, or a malformed response must not block a child from submitting work.
 */

const MODEL = 'claude-sonnet-5';

/**
 * Generous enough for adaptive thinking plus the JSON payload — max_tokens caps
 * thinking and response text together, so a tight budget truncates the answer.
 */
const MAX_TOKENS = 4096;

const REQUEST_TIMEOUT_MS = 60_000;

/** Vision-supported image types, keyed by file extension. */
const MEDIA_TYPES: Record<
  string,
  'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * Schema handed to structured outputs, which guarantees the response parses as
 * this shape. Note that numeric bounds are not supported in structured-output
 * schemas, so the 0–100 range is stated in the description and clamped below.
 */
const REVIEW_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'משפט אחד בעברית שמתאר מה בוצע בתמונה.',
    },
    recommendedScore: {
      type: 'integer',
      description:
        'Quality score between 0 and 100, where 0 is not done at all and 100 is done perfectly.',
    },
    reasoning: {
      type: 'string',
      description: 'משפט אחד בעברית שמסביר את הניקוד שניתן.',
    },
  },
  required: ['summary', 'recommendedScore', 'reasoning'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  'You review photos of household chores completed by children and recommend a quality score for their parent.',
  'Judge only what is visible in the photo, against the chore title and description you are given.',
  'Respond ONLY with a valid JSON object matching this structure, and nothing else:',
  '{ "summary": "Hebrew sentence describing what was done", "recommendedScore": number between 0 and 100, "reasoning": "Hebrew sentence explaining the score" }',
  'The summary and reasoning fields must be written in Hebrew. Keep each to a single sentence.',
  'Be fair and encouraging: this is a child\'s work, and the score suggests a bonus payout.',
  'If the photo does not show the chore described, say so in the summary and recommend a low score.',
].join('\n');

let client: Anthropic | null = null;

/**
 * Construct the client lazily so a missing ANTHROPIC_API_KEY degrades this one
 * feature instead of crashing server startup, and so dotenv has run first.
 */
function getClient(): Anthropic | null {
  if (client) {
    return client;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[aiVision] ANTHROPIC_API_KEY is not set; skipping AI review');
    return null;
  }

  client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return client;
}

export interface ReviewChorePhotoParams {
  /** Absolute path to the local image, already confined to the uploads dir. */
  absolutePath: string;
  title: string;
  description: string;
}

/**
 * Ask Claude to describe a proof photo and recommend a score for it.
 * Returns null if the review could not be produced for any reason.
 */
export async function reviewChorePhoto({
  absolutePath,
  title,
  description,
}: ReviewChorePhotoParams): Promise<AiReview | null> {
  const mediaType = MEDIA_TYPES[path.extname(absolutePath).toLowerCase()];
  if (!mediaType) {
    console.warn(`[aiVision] Unsupported image type for ${absolutePath}`);
    return null;
  }

  const anthropic = getClient();
  if (!anthropic) {
    return null;
  }

  try {
    const imageData = (await readFile(absolutePath)).toString('base64');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      // Low effort keeps this fast; adaptive thinking stays on, which is
      // preferred over disabling it on this model.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: REVIEW_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData },
            },
            {
              type: 'text',
              text: [
                `Chore title: ${title}`,
                `Chore description: ${description}`,
                'Review the attached photo of this chore and return the JSON object.',
              ].join('\n'),
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      console.warn('[aiVision] Model declined to review the photo');
      return null;
    }

    if (response.stop_reason === 'max_tokens') {
      console.warn('[aiVision] Response truncated before the JSON was complete');
      return null;
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!text) {
      console.warn('[aiVision] Response contained no text block');
      return null;
    }

    return parseReview(text);
  } catch (error) {
    // Covers file-read failures, timeouts, rate limits, and API errors alike —
    // the caller only needs to know a review is unavailable.
    if (error instanceof Anthropic.APIError) {
      console.error(`[aiVision] Anthropic API error ${error.status}:`, error.message);
    } else {
      console.error('[aiVision] Failed to review photo:', error);
    }
    return null;
  }
}

/**
 * Validate and normalize the model's JSON. Structured outputs make a schema
 * mismatch very unlikely, but this stays defensive so a bad payload can never
 * reach the database or the payout calculation.
 */
function parseReview(text: string): AiReview | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn('[aiVision] Response was not valid JSON');
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const { summary, recommendedScore, reasoning } = parsed as Record<string, unknown>;

  if (typeof summary !== 'string' || typeof reasoning !== 'string') {
    console.warn('[aiVision] Response was missing summary or reasoning');
    return null;
  }

  const score = Number(recommendedScore);
  if (!Number.isFinite(score)) {
    console.warn('[aiVision] Response had a non-numeric recommendedScore');
    return null;
  }

  return {
    summary: summary.trim(),
    recommendedScore: Math.min(100, Math.max(0, Math.round(score))),
    reasoning: reasoning.trim(),
  };
}
