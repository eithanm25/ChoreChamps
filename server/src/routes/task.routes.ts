import { Router, Response } from 'express';
import { stat, unlink } from 'fs/promises';
import { AppDataSource } from '../data-source';
import { Task, TaskStatus } from '../entities/Task';
import { Submission } from '../entities/Submission';
import { ChildProfile } from '../entities/ChildProfile';
import { UserRole, User } from '../entities/User';
import {
  AuthenticatedRequest,
  requireAuth,
  requireChild,
  requireParent,
} from '../middleware/auth';
import { canAcceptTask, canCancelSubmission } from '../services/taskGuardrails';
import { reviewChorePhoto } from '../services/aiVision';
import { resolveUploadPath } from '../utils/uploads';

const router = Router();

/**
 * POST /api/tasks/
 * Parent creates a new task for their family.
 */
router.post(
  '/',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const { title, description, basePrice, maxBonusPrice, assignedToId } = req.body as {
      title?: string;
      description?: string;
      basePrice?: unknown;
      maxBonusPrice?: unknown;
      assignedToId?: string | null; // חילוץ השדה החדש מהבקשה
    };

    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    if (typeof basePrice !== 'number' || typeof maxBonusPrice !== 'number') {
      res.status(400).json({ error: 'basePrice and maxBonusPrice are required and must be numbers' });
      return;
    }

    const parent = req.user!;
    if (!parent.family) {
      res.status(400).json({ error: 'You must belong to a family to create tasks' });
      return;
    }

    const taskRepo = AppDataSource.getRepository(Task);
    const userRepo = AppDataSource.getRepository(User);

    // הגדרת ערכי ברירת מחדל למשימה פתוחה לכולם
    let taskStatus = TaskStatus.OPEN;
    let assignedChild: User | null = null;

    // במידה וההורה בחר ילד ספציפי בטופס
    if (assignedToId) {
      const child = await userRepo.findOne({
        where: { id: assignedToId, family: { id: parent.family.id } }
      });

      if (!child) {
        res.status(404).json({ error: 'הילד שנבחר לא נמצא במשפחה זו' });
        return;
      }

      // משנים את הסטטוס ל-ACCEPTED ונועלים את המשימה על הילד
      taskStatus = TaskStatus.PENDING;
      assignedChild = child;
    }

    const task = taskRepo.create({
      title,
      description: description ?? '',
      basePrice: basePrice.toFixed(2),
      maxBonusPrice: maxBonusPrice.toFixed(2),
      status: taskStatus,
      family: parent.family,
      createdBy: parent,
      assignedTo: assignedChild,
    });

    await taskRepo.save(task);

    res.status(201).json({ task });
  },
);


/**
 * GET /api/tasks/open
 * Returns all open tasks for the logged-in user's family.
 */
router.get('/open', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (!user.family) {
    res.status(400).json({ error: 'You must belong to a family to view tasks' });
    return;
  }

  const taskRepo = AppDataSource.getRepository(Task);
  const tasks = await taskRepo.find({
    where: { status: TaskStatus.OPEN, family: { id: user.family.id } },
    relations: ['family'],
  });

  res.json({ tasks });
});

/**
 * GET /api/tasks/family-tasks
 * Returns all tasks for the logged-in user's family, with relations for UI grouping.
 */
router.get('/family-tasks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (!user.family) {
    res.status(400).json({ error: 'You must belong to a family to view tasks' });
    return;
  }

  const taskRepo = AppDataSource.getRepository(Task);
  const tasks = await taskRepo.find({
    where: { family: { id: user.family.id } },
    relations: ['assignedTo', 'submission', 'family', 'createdBy'],
    order: { createdAt: 'DESC' },
  });

  res.json({ tasks });
});

/**
 * GET /api/tasks/family-members
 * Returns family members with custom stats for parents and children.
 */
router.get('/family-members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  if (!user.family) {
    res.status(400).json({ error: 'You must belong to a family to view members' });
    return;
  }

  // Use the loaded family ID from the authenticated user
  const familyId = typeof user.family === 'string' ? user.family : user.family.id;
  const userRepo = AppDataSource.getRepository(User);
  const taskRepo = AppDataSource.getRepository(Task);

  // Fetch all family members safely
  const members = await userRepo.find({
    where: { family: { id: familyId } },
    relations: ['family', 'childProfile'],
    order: { name: 'ASC' },
  });

  const results = await Promise.all(
    members.map(async (m) => {
      // Safe fallback: if m.family is missing, use the logged-in user's family name
      const currentFamilyName = m.family?.familyName ?? user.family?.familyName ?? 'Our Family';

      if (m.role === UserRole.PARENT) {
        // Count tasks in the family created SPECIFICALLY by this parent.
        const totalTasksUploaded = await taskRepo.count({
          where: { family: { id: familyId }, createdBy: { id: m.id } },
        });
        
        return {
          id: m.id,
          name: m.name,
          role: m.role,
          email: m.email ?? '',
          familyName: currentFamilyName,
          totalTasksUploaded,
        };
      }

      // If Child: Map fields and safely convert decimal strings to numbers for the frontend
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        email: m.email ?? '',
        familyName: currentFamilyName,
        lifetimeTasksCount: m.childProfile ? Number(m.childProfile.lifetimeTasksCount) : 0,
        lifetimeEarnings: m.childProfile ? Number(m.childProfile.lifetimeEarnings) : 0,
      };
    }),
  );

  res.json({ members: results });
});


/**
 * Money is stored as decimal strings; convert to integer cents for arithmetic so
 * bonus calculations never accumulate floating-point drift.
 */
function toCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * POST /api/tasks/:taskId/accept
 * Child accepts an open task in their family.
 *
 * Guardrail: child must NOT already have another task in 'pending' status.
 */
router.post(
  '/:taskId/accept',
  requireAuth,
  requireChild,
  async (req: AuthenticatedRequest, res: Response) => {
    const taskId = req.params.taskId as string;
    const child = req.user!;

    if (!child.family) {
      res.status(400).json({ error: 'You must belong to a family to accept tasks' });
      return;
    }

    const guard = await canAcceptTask(child.id);
    if (!guard.allowed) {
      res.status(409).json({ error: guard.reason });
      return;
    }

    const taskRepo = AppDataSource.getRepository(Task);
    const task = await taskRepo.findOne({
      where: { id: taskId },
      relations: ['family', 'assignedTo'],
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.family.id !== child.family.id) {
      res.status(403).json({ error: 'Task does not belong to your family' });
      return;
    }

    if (task.status !== TaskStatus.OPEN) {
      res.status(409).json({ error: 'Task is not open for acceptance' });
      return;
    }

    task.status = TaskStatus.PENDING;
    task.assignedTo = child;
    await taskRepo.save(task);

    res.json({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        assignedToId: child.id,
      },
    });
  },
);

/**
 * POST /api/tasks/:taskId/cancel-submission
 * Child withdraws their submission and reopens the task.
 *
 * Guardrail: on a completed task, cancellation is blocked if the child
 * already has another task in 'pending' status.
 */
router.post(
  '/:taskId/cancel-submission',
  requireAuth,
  requireChild,
  async (req: AuthenticatedRequest, res: Response) => {
    const taskId = req.params.taskId as string;
    const child = req.user!;

    const taskRepo = AppDataSource.getRepository(Task);
    const submissionRepo = AppDataSource.getRepository(Submission);

    const task = await taskRepo.findOne({
      where: { id: taskId },
      relations: ['family', 'assignedTo', 'submission'],
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.assignedTo?.id !== child.id) {
      res.status(403).json({ error: 'You are not assigned to this task' });
      return;
    }

    if (child.role !== UserRole.CHILD) {
      res.status(403).json({ error: 'Only children can cancel submissions' });
      return;
    }

    const guard = await canCancelSubmission(child.id, task.status);
    if (!guard.allowed) {
      res.status(409).json({ error: guard.reason });
      return;
    }

    const submission = await submissionRepo.findOne({ where: { taskId: task.id } });
    if (!submission) {
      res.status(404).json({ error: 'No submission found for this task' });
      return;
    }

    await submissionRepo.remove(submission);

    task.status = TaskStatus.PENDING;
    task.awardedBonus = null;
    task.finalScore = null;
    await taskRepo.save(task);

    res.json({
      message: 'Submission cancelled',
      task: {
        id: task.id,
        status: task.status,
      },
    });
  },
);

/**
 * POST /api/tasks/:taskId/submit
 * Child submits a proof photo, moving the task from 'pending' to 'completed'.
 *
 * photoUrl is a local path under the uploads directory. The photo is sent to
 * Anthropic vision for a structured review (summary + recommended score +
 * reasoning) which is stored on the submission for the parent to see. A failed
 * review is not fatal — the submission is saved with aiSummary null.
 */
router.post(
  '/:taskId/submit',
  requireAuth,
  requireChild,
  async (req: AuthenticatedRequest, res: Response) => {
    const taskId = req.params.taskId as string;
    const child = req.user!;
    const { photoUrl } = req.body as { photoUrl?: string };

    if (!photoUrl) {
      res.status(400).json({ error: 'photoUrl is required' });
      return;
    }

    const absolutePath = resolveUploadPath(photoUrl);
    if (!absolutePath) {
      res.status(400).json({ error: 'photoUrl must be a file inside the uploads directory' });
      return;
    }

    const taskRepo = AppDataSource.getRepository(Task);
    const submissionRepo = AppDataSource.getRepository(Submission);

    const task = await taskRepo.findOne({
      where: { id: taskId },
      relations: ['family', 'assignedTo', 'submission'],
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.assignedTo?.id !== child.id) {
      res.status(403).json({ error: 'You are not assigned to this task' });
      return;
    }

    if (task.status !== TaskStatus.PENDING) {
      res.status(409).json({ error: 'Only a pending task can be submitted' });
      return;
    }

    if (task.submission) {
      res.status(409).json({ error: 'This task already has a submission' });
      return;
    }

    // Fail loudly on a missing photo rather than silently producing no review.
    try {
      const stats = await stat(absolutePath);
      if (!stats.isFile()) {
        res.status(400).json({ error: 'photoUrl does not point to a file' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Photo not found in the uploads directory' });
      return;
    }

    const aiSummary = await reviewChorePhoto({
      absolutePath,
      title: task.title,
      description: task.description,
    });

    const submission = submissionRepo.create({
      taskId: task.id,
      childId: child.id,
      photoUrls: [photoUrl],
      aiSummary,
    });
    await submissionRepo.save(submission);

    task.status = TaskStatus.COMPLETED;
    await taskRepo.save(task);

    res.status(201).json({
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
      },
      submission: {
        id: submission.id,
        photoUrls: submission.photoUrls,
        aiSummary: submission.aiSummary,
        submittedAt: submission.submittedAt,
      },
      aiReviewAvailable: aiSummary !== null,
    });
  },
);

/**
 * POST /api/tasks/:taskId/approve
 * Parent approves a completed task, scores it, and pays out.
 *
 * Payout: basePrice + (finalScore / 100) * maxBonusPrice, credited to the
 * child's ChildProfile.balance. The status transition and the balance update run
 * in one transaction, with the transition written as a compare-and-set on
 * status = 'completed' so two concurrent approvals cannot pay out twice.
 *
 * The local proof photos are deleted after the transaction commits.
 */
router.post(
  '/:taskId/approve',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const taskId = req.params.taskId as string;
    const parent = req.user!;
    const { finalScore } = req.body as { finalScore?: unknown };

    if (typeof finalScore !== 'number' || !Number.isInteger(finalScore)) {
      res.status(400).json({ error: 'finalScore must be an integer' });
      return;
    }

    if (finalScore < 0 || finalScore > 100) {
      res.status(400).json({ error: 'finalScore must be between 0 and 100' });
      return;
    }

    if (!parent.family) {
      res.status(400).json({ error: 'You must belong to a family to approve tasks' });
      return;
    }

    const familyId = parent.family.id;

    type ApproveOutcome =
      | {
          ok: true;
          awardedBonus: string;
          totalPayout: string;
          childId: string;
          photoUrls: string[];
        }
      | { ok: false; status: number; error: string };

    const outcome: ApproveOutcome = await AppDataSource.transaction(
      async (manager): Promise<ApproveOutcome> => {
        const task = await manager.findOne(Task, {
          where: { id: taskId },
          relations: ['family', 'assignedTo', 'submission'],
        });

        if (!task) {
          return { ok: false, status: 404, error: 'Task not found' };
        }

        if (task.family.id !== familyId) {
          return { ok: false, status: 403, error: 'Task does not belong to your family' };
        }

        if (task.status !== TaskStatus.COMPLETED) {
          return { ok: false, status: 409, error: 'Only a completed task can be approved' };
        }

        if (!task.assignedTo) {
          return { ok: false, status: 409, error: 'Task has no assigned child' };
        }

        const childId = task.assignedTo.id;

        const profile = await manager.findOne(ChildProfile, { where: { id: childId } });
        if (!profile) {
          return { ok: false, status: 409, error: 'Assigned child has no allowance profile' };
        }

        const bonusCents = Math.round((toCents(task.maxBonusPrice) * finalScore) / 100);
        const totalCents = toCents(task.basePrice) + bonusCents;
        const awardedBonus = fromCents(bonusCents);
        const totalPayout = fromCents(totalCents);

        // Compare-and-set: only the caller that flips 'completed' → 'approved'
        // proceeds, so a double-submit cannot credit the balance twice.
        const transition = await manager
          .createQueryBuilder()
          .update(Task)
          .set({ status: TaskStatus.APPROVED, finalScore, awardedBonus })
          .where('id = :taskId AND status = :expected', {
            taskId,
            expected: TaskStatus.COMPLETED,
          })
          .execute();

        if (!transition.affected) {
          return { ok: false, status: 409, error: 'Task was already approved' };
        }

        // Increment in SQL rather than read-modify-write so concurrent approvals
        // of different tasks for the same child cannot lose an update.
        await manager
          .createQueryBuilder()
          .update(ChildProfile)
          .set({
            // הנתונים החודשיים (המתאפסים ב-Leaderboard)
            balance: () => '"balance" + CAST(:totalPayout AS numeric)',
            totalBonusEarned: () => '"totalBonusEarned" + CAST(:awardedBonus AS numeric)',
            
            // 🔥 שני השדות ההיסטוריים החדשים (שנשמרים מאז ומעולם לתעודת הזהות של הילד)
            lifetimeTasksCount: () => '"lifetimeTasksCount" + 1', // מקפיץ ב-1 את כמות המשימות שביצע
            lifetimeEarnings: () => '"lifetimeEarnings" + CAST(:totalPayout AS numeric)', // מוסיף את סך הרווח לתמיד
          })
          .where('id = :childId', { childId })
          .setParameters({ totalPayout, awardedBonus })
          .execute();

        return {
          ok: true,
          awardedBonus,
          totalPayout,
          childId,
          photoUrls: task.submission?.photoUrls ?? [],
        };
      },
    );

    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    // Local cleanup runs after the payout is committed: a failed delete costs
    // disk space, and must never roll back money the child has already earned.
    await deleteLocalPhotos(outcome.photoUrls);

    const profile = await AppDataSource.getRepository(ChildProfile).findOne({
      where: { id: outcome.childId },
    });

    res.json({
      task: {
        id: taskId,
        status: TaskStatus.APPROVED,
        finalScore,
        awardedBonus: outcome.awardedBonus,
      },
      payout: {
        awardedBonus: outcome.awardedBonus,
        totalPayout: outcome.totalPayout,
      },
      childProfile: {
        id: outcome.childId,
        balance: profile?.balance ?? null,
        totalBonusEarned: profile?.totalBonusEarned ?? null,
      },
    });
  },
);

/**
 * Delete proof photos from the local uploads folder to save disk space.
 * Best-effort: a photo that is already gone or unreadable is logged, not thrown.
 */
async function deleteLocalPhotos(photoUrls: string[]): Promise<void> {
  await Promise.all(
    photoUrls.map(async (photoUrl) => {
      const absolutePath = resolveUploadPath(photoUrl);
      if (!absolutePath) {
        return;
      }

      try {
        await unlink(absolutePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          console.error(`[tasks] Failed to delete ${absolutePath}:`, error);
        }
      }
    }),
  );
}

// 1. ראוט מחיקת משימה (רק להורים של אותה משפחה)
router.delete(
  '/:id',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const parent = req.user!;

    try {
      const taskRepo = AppDataSource.getRepository(Task);
      
      // מוודאים שהמשימה קיימת ושייכת למשפחה של ההורה המבקש
      const task = await taskRepo.findOne({
        where: { id, family: { id: parent.family?.id } }
      });

      if (!task) {
        res.status(404).json({ error: 'המשימה לא נמצאה או שאינה שייכת למשפחתך' });
        return;
      }

      // מותר למחוק משימה רק אם היא עדיין לא פורסמה/אושרה סופית (רק open, accepted או submitted)
      if (task.status === TaskStatus.APPROVED) {
        res.status(400).json({ error: 'לא ניתן למחוק משימה שכבר אושרה והועבר עליה תשלום' });
        return;
      }

      await taskRepo.remove(task);
      res.json({ message: 'המשימה נמחקה בהצלחה' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 2. ראוט עדכון ועריכת משימה
router.put(
  '/:id',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    const parent = req.user!;
    const { title, description, basePrice, maxBonusPrice, assignedToId } = req.body as {
      title?: string;
      description?: string;
      basePrice?: number;
      maxBonusPrice?: number;
      assignedToId?: string | null;
    };

    try {
      const taskRepo = AppDataSource.getRepository(Task);
      const userRepo = AppDataSource.getRepository(User);

      // שליפת המשימה עם וידוא משפחה
      const task = await taskRepo.findOne({
        where: { id, family: { id: parent.family?.id } },
        relations: ['assignedTo']
      });

      if (!task) {
        res.status(404).json({ error: 'המשימה לא נמצאה' });
        return;
      }

      if (task.status === TaskStatus.APPROVED) {
        res.status(400).json({ error: 'לא ניתן לערוך משימה שכבר אושרה ונסגרה' });
        return;
      }

      // עדכון שדות טקסט אם נשלחו
      if (title && typeof title === 'string') task.title = title.trim();
      if (description !== undefined) task.description = description.trim();
      
      // עדכון שדות כסף (ממירים לסטרינג קבוע עם 2 ספרות אחרי הנקודה)
      if (typeof basePrice === 'number') task.basePrice = basePrice.toFixed(2);
      if (typeof maxBonusPrice === 'number') task.maxBonusPrice = maxBonusPrice.toFixed(2);

      // לוגיקת שיוך דינמית ומורכבת
      if (assignedToId !== undefined) {
        if (assignedToId === null || assignedToId === '') {
          // אם ההורה החזיר את המשימה למצב "פתוח לכולם"
          task.assignedTo = null;
          // אם הסטטוס היה תפוס, מחזירים אותו לפתוח
          if (task.status === TaskStatus.PENDING) {
            task.status = TaskStatus.OPEN;
          }
        } else {
          // שיוך לילד חדש/אחר
          const child = await userRepo.findOne({
            where: { id: assignedToId, family: { id: parent.family?.id } }
          });
          if (!child) {
            res.status(404).json({ error: 'הילד המבוקש לא נמצא במשפחה זו' });
            return;
          }
          task.assignedTo = child;
          // אם המשימה הייתה פתוחה באוויר, היא הופכת לתפוסה עבורו
          if (task.status === TaskStatus.OPEN) {
            task.status = TaskStatus.PENDING;
          }
        }
      }

      await taskRepo.save(task);
      res.json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);


export default router;
