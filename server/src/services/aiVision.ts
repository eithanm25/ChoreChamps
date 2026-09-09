import Anthropic from '@anthropic-ai/sdk';
import { AiReview } from '../entities/Submission';

/**
 * Anthropic vision review of a chore/learning-task submission.
 *
 * Handles two kinds of tasks, distinguished by whether the parent attached a
 * reference photo when creating the task:
 * - Learning tasks: the reference photo is a blank worksheet/test/quiz; the
 *   child's execution photos show it filled in. The model grades it like a
 *   teacher, answer by answer.
 * - Chore tasks: no reference photo (the common case), or a reference photo
 *   showing a "golden standard" finished state to compare the child's result
 *   against.
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

/** Image media types Anthropic vision accepts. */
export type VisionMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const SUPPORTED_MEDIA_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** One image handed to the review, already in memory (compressed on upload). */
export interface ReviewImage {
  buffer: Buffer;
  mediaType: VisionMediaType;
}

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
      description: 'משפט אחד בעברית שמתאר מה בוצע בתמונה, בטון מעודד לילד.',
    },
    recommendedScore: {
      type: 'integer',
      description:
        'Quality/grade score between 0 and 100, where 0 is not done at all or entirely wrong, and 100 is done perfectly or a perfect score.',
    },
    reasoning: {
      type: 'string',
      description:
        'הסבר בעברית עבור ההורה: בציון על מבחן/דף עבודה — פירוט לפי שאלה מה היה נכון ומה טעות; במטלת בית — הסבר קצר על הציון.',
    },
  },
  required: ['summary', 'recommendedScore', 'reasoning'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  'You review proof photos a child submitted for a task their parent assigned in a family chores-and-learning app, and recommend a quality/grade score for the parent.',
  '',
  'You may receive two kinds of images in the message, each clearly introduced by a text label right before it:',
  '  - A REFERENCE photo the parent uploaded when creating the task (optional — may be absent).',
  '  - One to three EXECUTION photos the child submitted as proof of their work (always present).',
  '',
  'Decide which of these three modes applies, and follow it:',
  '',
  '1. LEARNING MODE — the reference photo is a worksheet, test, or quiz containing questions to answer (blank or partially filled). Act as a strict but encouraging teacher: compare the child\'s handwritten answers visible in the execution photos against what the reference sheet asks, check every answer for correctness, and calculate an exact recommendedScore out of 100 equal to the percentage of correct answers (e.g. 8 correct out of 10 questions = 80). In the reasoning, go through the answers and say precisely which ones were right and which were wrong and why — the parent needs the specific breakdown, not just a vibe.',
  '2. CHORE-COMPARISON MODE — the reference photo shows a target "golden standard" for a household chore (e.g. a tidied room, a cleaned surface, a properly folded item) rather than questions to answer. Evaluate how closely the child\'s finished work in the execution photos matches that standard — same area, same level of tidiness/cleanliness/correctness — and score accordingly. Note specific differences from the standard in the reasoning.',
  '3. STANDARD MODE — no reference photo was provided. Judge the execution photos against the chore title and description alone, exactly as if grading ordinary chore proof with no comparison target.',
  '',
  'Respond ONLY with a valid JSON object matching this structure, and nothing else:',
  '{ "summary": "Hebrew sentence, short and encouraging, written for the child", "recommendedScore": number between 0 and 100, "reasoning": "Hebrew text for the parent — the per-answer breakdown in learning mode, otherwise a sentence explaining the score" }',
  'The summary and reasoning fields must be written in Hebrew. Keep the summary to a single sentence; the reasoning may be longer only in learning mode, where a real breakdown is expected.',
  'Be fair and encouraging: this is a child\'s work, and the score suggests a bonus payout.',
  'If the execution photos do not show any attempt matching the task (or the reference sheet/standard, when present), say so in the summary and recommend a low score.',
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
  /** The child's proof photos, already compressed on upload (1–3, at least one required). */
  executionPhotos: ReviewImage[];
  /**
   * The parent's optional reference/target photo(s) (blank worksheet or
   * "golden standard" chore example) — how many there can be is tier-gated
   * (see subscriptionLimits.ts). Callers pass images only; PDFs are dropped
   * before this point since the vision call can't read them. Omit or pass an
   * empty array when the task has no reference photos.
   */
  referencePhotos?: ReviewImage[];
  title: string;
  description: string;
}

/** Build one Anthropic image block from an in-memory image. */
function buildImageBlock({ buffer, mediaType }: ReviewImage): Anthropic.ImageBlockParam {
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
  };
}

/** Keep only images with a media type Anthropic vision accepts. */
export function isSupportedVisionImage(mediaType: string): mediaType is VisionMediaType {
  return SUPPORTED_MEDIA_TYPES.includes(mediaType);
}

/**
 * Ask Claude to review 1–3 execution photos (optionally against a reference
 * photo) and recommend a score. Returns null if the review could not be
 * produced for any reason — a review needs at least one execution photo to say
 * anything meaningful. Reference photos are optional and simply omitted if none
 * are usable, with the review proceeding in STANDARD MODE.
 */
export async function reviewChorePhoto({
  executionPhotos,
  referencePhotos,
  title,
  description,
}: ReviewChorePhotoParams): Promise<AiReview | null> {
  if (executionPhotos.length === 0) {
    console.warn('[aiVision] No execution photos provided');
    return null;
  }

  const anthropic = getClient();
  if (!anthropic) {
    return null;
  }

  try {
    const executionBlocks = executionPhotos.map(buildImageBlock);

    const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];

    const referenceBlocks = (referencePhotos ?? []).map(buildImageBlock);

    if (referenceBlocks.length > 0) {
      content.push({
        type: 'text',
        text: `REFERENCE photo${referenceBlocks.length > 1 ? 's' : ''} the parent uploaded when creating this task (a blank worksheet/test to grade against, or a golden-standard example of the finished chore):`,
      });
      content.push(...referenceBlocks);
    }

    content.push({
      type: 'text',
      text: `EXECUTION photo${executionBlocks.length > 1 ? 's' : ''} the child submitted as proof of their work:`,
    });
    content.push(...executionBlocks);

    content.push({
      type: 'text',
      text: [
        `Chore title: ${title}`,
        `Chore description: ${description}`,
        'Review the attached photo(s) for this task, following the mode rules in your system instructions, and return the JSON object.',
      ].join('\n'),
    });

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
      messages: [{ role: 'user', content }],
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
