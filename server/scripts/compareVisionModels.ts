/**
 * One-off comparison: for a handful of REAL recent submissions (read-only —
 * no writes to the DB, no wallet/task mutations), print the Sonnet result
 * already stored in the DB (from real production grading, zero extra cost)
 * side by side with a fresh Haiku call on the exact same photos, using the
 * exact same prompt/schema/image-building code path as production
 * (reviewChorePhoto in aiVision.ts, via its new optional `model` override —
 * see that file's docstring). Purpose: decide whether Haiku is cheap enough
 * and still good enough to become the default model for cost control on
 * Premium (see conversation — unlimited-AI abuse risk).
 *
 * Run: npx ts-node server/scripts/compareVisionModels.ts [count]
 * (defaults to 5 submissions if no count given)
 *
 * Only reads tasks still in 'completed' or 'rejected' status — an 'approved'
 * task has its photos already deleted from R2 (see taskReview.ts), so there
 * would be nothing left to download.
 */
import { AppDataSource } from '../src/data-source';
import { Submission } from '../src/entities/Submission';
import { Task, TaskStatus } from '../src/entities/Task';
import { downloadObject, contentTypeForKey } from '../src/services/storage';
import { reviewChorePhoto, isSupportedVisionImage, type ReviewImage } from '../src/services/aiVision';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

async function loadImages(keys: string[]): Promise<ReviewImage[]> {
  const images = await Promise.all(
    keys.map(async (key): Promise<ReviewImage | null> => {
      const mediaType = contentTypeForKey(key);
      if (!mediaType || !isSupportedVisionImage(mediaType)) {
        return null;
      }
      try {
        return { buffer: await downloadObject(key), mediaType };
      } catch (err) {
        console.warn(`  (could not download ${key}, skipping):`, err);
        return null;
      }
    }),
  );
  return images.filter((img): img is ReviewImage => img !== null);
}

async function main(): Promise<void> {
  const count = Number(process.argv[2]) || 5;

  await AppDataSource.initialize();
  console.log(`Connected. Fetching up to ${count} recent gradable submissions...\n`);

  const submissions = await AppDataSource.getRepository(Submission)
    .createQueryBuilder('submission')
    .innerJoinAndSelect('submission.task', 'task')
    .where('submission."aiSummary" IS NOT NULL')
    .andWhere('task.status IN (:...statuses)', { statuses: [TaskStatus.COMPLETED, TaskStatus.REJECTED] })
    .orderBy('submission.submittedAt', 'DESC')
    .limit(count)
    .getMany();

  if (submissions.length === 0) {
    console.log('No gradable submissions found (need status completed/rejected with a stored aiSummary). Nothing to compare.');
    await AppDataSource.destroy();
    return;
  }

  for (const [index, submission] of submissions.entries()) {
    const task = submission.task;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`#${index + 1} — Task: "${task.title}" (submitted ${submission.submittedAt.toISOString()})`);
    console.log('='.repeat(70));

    const executionPhotos = await loadImages(submission.photoUrls);
    const referencePhotos = await loadImages(task.referencePhotoUrls ?? []);

    if (executionPhotos.length === 0) {
      console.log('(execution photos already gone from R2 — skipping this one)');
      continue;
    }

    console.log('\n[SONNET — already stored in DB, no new API call]');
    console.log(`  score: ${submission.aiSummary?.recommendedScore}`);
    console.log(`  summary: ${submission.aiSummary?.summary}`);
    console.log(`  reasoning: ${submission.aiSummary?.reasoning}`);

    const start = Date.now();
    const haikuResult = await reviewChorePhoto({
      executionPhotos,
      referencePhotos,
      title: task.title,
      description: task.description,
      model: HAIKU_MODEL,
    });
    const elapsedMs = Date.now() - start;

    console.log(`\n[HAIKU — fresh call just now, ${elapsedMs}ms]`);
    if (!haikuResult) {
      console.log('  (call failed or was refused — see warnings above)');
    } else {
      console.log(`  score: ${haikuResult.recommendedScore}`);
      console.log(`  summary: ${haikuResult.summary}`);
      console.log(`  reasoning: ${haikuResult.reasoning}`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('Done. Eyeball each pair: is Haiku\'s score/reasoning close enough to Sonnet\'s to trust for real grading?');
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
