import { Router, Response } from 'express';
import { Not } from 'typeorm';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';
import { Family } from '../entities/Family';
import { Task, TaskStatus } from '../entities/Task';
import { Reward } from '../entities/Reward';
import { WalletTransaction } from '../entities/WalletTransaction';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { deleteObjects } from '../services/storage';
import { broadcastFamilyUpdate } from '../services/realtime';

const router = Router();

/**
 * DELETE /api/users/purge-account
 * Self-service, irreversible account deletion for the currently logged-in
 * user (any role) — the danger-zone action in ProfileSettingsPanel.
 *
 * A child, or a parent with a surviving co-parent, is removed alone: their
 * ChildProfile cascades at the DB level, and every other reference (created
 * tasks, submissions, wallet ledger rows) is SET NULL by schema design —
 * exactly the same cleanup DELETE /api/family/member/:id already does when a
 * *different* parent removes them, reused here for self-service deletion.
 *
 * The LAST parent in a family has no one left to hand the household to, so
 * deleting their account takes the entire family down with it — see
 * purgeFamily below.
 */
router.delete('/purge-account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const userRepo = AppDataSource.getRepository(User);

  try {
    if (user.role === UserRole.CHILD) {
      await releaseChildTasks(user.id);
      await userRepo.remove(user);
      if (user.family) {
        broadcastFamilyUpdate(user.family.id);
      }
      res.json({ message: 'החשבון נמחק לצמיתות' });
      return;
    }

    if (!user.family) {
      // Signed up but never created/joined a household — nothing else to clean up.
      await userRepo.remove(user);
      res.json({ message: 'החשבון נמחק לצמיתות' });
      return;
    }

    const otherParents = await userRepo.count({
      where: { family: { id: user.family.id }, role: UserRole.PARENT, id: Not(user.id) },
    });

    if (otherParents > 0) {
      await userRepo.remove(user);
      broadcastFamilyUpdate(user.family.id);
      res.json({ message: 'החשבון נמחק לצמיתות' });
      return;
    }

    await purgeFamily(user.family.id);
    res.json({ message: 'החשבון וכל נתוני המשפחה נמחקו לצמיתות' });
  } catch (err) {
    console.error('[users/purge-account] failed:', err);
    res.status(500).json({ error: 'שגיאה במחיקת החשבון. נסו שוב בעוד רגע.' });
  }
});

/**
 * Same task-reopening logic as DELETE /api/family/member/:id: a departing
 * child's in-flight tasks go back to OPEN for another child to pick up;
 * already-approved history just loses its assignee link.
 */
async function releaseChildTasks(childId: string): Promise<void> {
  const taskRepo = AppDataSource.getRepository(Task);

  await taskRepo
    .createQueryBuilder()
    .update(Task)
    .set({ assignedTo: null, status: TaskStatus.OPEN, rejectionNote: null })
    .where('"assignedToId" = :id', { id: childId })
    .andWhere('status IN (:...statuses)', {
      statuses: [TaskStatus.OPEN, TaskStatus.PENDING, TaskStatus.COMPLETED, TaskStatus.REJECTED],
    })
    .execute();

  await taskRepo
    .createQueryBuilder()
    .update(Task)
    .set({ assignedTo: null })
    .where('"assignedToId" = :id', { id: childId })
    .andWhere('status = :approved', { approved: TaskStatus.APPROVED })
    .execute();
}

/**
 * Deletes an entire household in FK-safe order, inside one transaction:
 * tasks (submissions cascade at the DB level), rewards (contributions
 * cascade), wallet ledger rows, members (child_profiles cascade), then the
 * family row itself. R2 proof/reference photo keys are collected before the
 * transaction and purged from storage afterward — best-effort, matching
 * every other call site of deleteObjects in this codebase.
 */
async function purgeFamily(familyId: string): Promise<void> {
  const photoKeys: string[] = [];

  await AppDataSource.transaction(async (manager) => {
    const tasks = await manager.find(Task, {
      where: { family: { id: familyId } },
      relations: ['submission'],
    });
    for (const task of tasks) {
      if (task.referencePhotoUrls) {
        photoKeys.push(...task.referencePhotoUrls);
      }
      if (task.submission?.photoUrls) {
        photoKeys.push(...task.submission.photoUrls);
      }
    }

    if (tasks.length > 0) {
      await manager
        .createQueryBuilder()
        .delete()
        .from(Task)
        .where('"familyId" = :familyId', { familyId })
        .execute();
    }

    await manager
      .createQueryBuilder()
      .delete()
      .from(Reward)
      .where('"familyId" = :familyId', { familyId })
      .execute();

    await manager
      .createQueryBuilder()
      .delete()
      .from(WalletTransaction)
      .where('"familyId" = :familyId', { familyId })
      .execute();

    await manager
      .createQueryBuilder()
      .delete()
      .from(User)
      .where('"familyId" = :familyId', { familyId })
      .execute();

    await manager.createQueryBuilder().delete().from(Family).where('"id" = :familyId', { familyId }).execute();
  });

  await deleteObjects(photoKeys);
}

export default router;
