import { Router, Response, NextFunction } from 'express';
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
import { canAcceptTask, canCancelSubmission, childHasPendingTask } from '../services/taskGuardrails';
import { parseReviewAction, runReview } from '../services/taskReview';
import { reviewChorePhoto, MAX_EXECUTION_PHOTOS } from '../services/aiVision';
import { resolveUploadPath } from '../utils/uploads';
import { toTaskDto, toPublicPhotoUrl } from '../utils/serializers';
import multer from 'multer';
import path from 'path';


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_EXECUTION_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('רק קבצי תמונה מותרים'));
      return;
    }
    cb(null, true);
  },
});

function multerErrorMessage(err: unknown): string {
  return err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
    ? 'כל תמונה חייבת להיות עד 8MB'
    : err instanceof Error
      ? err.message
      : 'שגיאה בהעלאת הקבצים';
}

/**
 * Wraps upload.array so a rejected file (wrong type, too large, too many)
 * reaches the client as a 400 instead of falling through to Express's default
 * error handler, which would return an opaque 500 with a stack trace.
 */
function handlePhotoUpload(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  upload.array('photos', MAX_EXECUTION_PHOTOS)(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: multerErrorMessage(err) });
      return;
    }
    next();
  });
}

/**
 * Optional single-file upload for the parent's reference photo (blank
 * worksheet/test, or a golden-standard chore example) at task creation.
 * Absent is fine — req.file simply stays undefined.
 */
function handleReferencePhotoUpload(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  upload.single('referencePhoto')(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: multerErrorMessage(err) });
      return;
    }
    next();
  });
}

const router = Router();

/**
 * POST /api/tasks/
 * Parent creates a new task for their family. Accepts multipart/form-data with
 * an optional single 'referencePhoto' file (a blank worksheet/test to grade
 * against, or a "golden standard" example of a finished chore) — but a plain
 * JSON body still works too, since express.json() already parses it before
 * this route's multer middleware runs and multer skips non-multipart requests.
 */
router.post(
  '/',
  requireAuth,
  requireParent,
  handleReferencePhotoUpload,
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

    // basePrice/maxBonusPrice arrive as real numbers from a JSON body, or as
    // strings from multipart form fields (FormData always stringifies) — Number()
    // handles both, and NaN correctly rejects anything that's neither.
    const parsedBasePrice = Number(basePrice);
    const parsedMaxBonusPrice = Number(maxBonusPrice);
    if (!Number.isFinite(parsedBasePrice) || !Number.isFinite(parsedMaxBonusPrice)) {
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

    let taskStatus = TaskStatus.OPEN;
    let assignedChild: User | null = null;

    if (assignedToId && assignedToId.trim() !== '') {
      const childUser = await userRepo.findOne({
        where: { id: assignedToId, family: { id: parent.family.id } },
        relations: ['family'],
      });

      if (!childUser) {
        res.status(404).json({ error: 'הילד שנבחר לא נמצא במשפחה זו' });
        return;
      }

      // TaskStatus.PENDING is the equivalent of an actively-assigned task in this
      // app, so it must respect the same one-pending-task-per-child guardrail as
      // POST /:taskId/accept — otherwise a direct assignment silently gives the
      // child a second concurrent pending task.
      const hasPending = await childHasPendingTask(childUser.id);
      if (hasPending) {
        res.status(409).json({
          error: `${childUser.name} כבר מבצע/ת משימה אחרת. אפשר לשייך משימה חדשה רק אחרי שהמשימה הנוכחית תושלם.`,
        });
        return;
      }

      taskStatus = TaskStatus.PENDING;
      assignedChild = childUser;
    }

    const referencePhotoFile = req.file as Express.Multer.File | undefined;

    const task = taskRepo.create({
      title,
      description: description ?? '',
      basePrice: parsedBasePrice.toFixed(2),
      maxBonusPrice: parsedMaxBonusPrice.toFixed(2),
      status: taskStatus,
      family: parent.family,
      createdBy: parent,
      assignedTo: assignedChild,
      referencePhotoUrl: referencePhotoFile ? referencePhotoFile.filename : null,
    });

    await taskRepo.save(task);

    res.status(201).json({ task: toTaskDto(task) });
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
    relations: ['family', 'assignedTo', 'createdBy'],
  });

  res.json({ tasks: tasks.map(toTaskDto) });
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

  res.json({ tasks: tasks.map(toTaskDto) });
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

    if (task.assignedTo && task.assignedTo.id !== child.id) {
      res.status(403).json({ error: 'המשימה כבר משויכת לצ׳אמפ אחר' });
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

    const photoUrls = submission.photoUrls;
    await submissionRepo.remove(submission);
    // Best-effort: the submission row is already gone, so a failed delete here
    // only costs disk space and must not block the cancellation from completing.
    await deleteLocalPhotos(photoUrls);

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
 * Child submits a proof photo, moving the task from 'pending' (first submission)
 * or 'rejected' (resubmission after corrections) to 'completed'.
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
  handlePhotoUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    const taskId = req.params.taskId as string;
    const child = req.user!;
    const { childNotes } = req.body as { childNotes?: string };

    // וידוא שהועלו קבצים
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'חובה לצלם או להעלות לפחות תמונה אחת של המשימה' });
      return;
    }

    // Express 4 does not catch rejections from async handlers: an uncaught throw
    // here leaves the request hanging with no response, so the client spins
    // forever instead of showing an error. Everything below stays inside try.
    try {
      const taskRepo = AppDataSource.getRepository(Task);
      const submissionRepo = AppDataSource.getRepository(Submission);

      // The 'submission' relation is deliberately NOT loaded here. Saving a Task
      // whose one-to-one 'submission' was loaded as null, after a submission row
      // has since been inserted, makes TypeORM try to detach the old relation
      // with `UPDATE submissions SET "taskId" = NULL` — which violates the
      // not-null constraint and aborts the status update.
      const task = await taskRepo.findOne({
        where: { id: taskId },
        relations: ['family', 'assignedTo'],
      });

      if (!task) {
        res.status(404).json({ error: 'המשימה לא נמצאה' });
        return;
      }

      if (task.assignedTo?.id !== child.id) {
        res.status(403).json({ error: 'אינך משויך למשימה זו' });
        return;
      }

      const isResubmission = task.status === TaskStatus.REJECTED;
      if (task.status !== TaskStatus.PENDING && !isResubmission) {
        res.status(409).json({ error: 'ניתן לשלוח להורים רק משימה שבביצוע או שחזרה לתיקון' });
        return;
      }

      const alreadySubmitted = await submissionRepo.count({
        where: { task: { id: taskId } },
      });
      if (alreadySubmitted > 0) {
        res.status(409).json({ error: 'למשימה זו כבר הוגשה הוכחה בעבר' });
        return;
      }

      const savedPhotoNames = files.map((file) => file.filename);

      // Runs before the transaction: this is a ~6s network call and must not
      // hold a DB transaction open. reviewChorePhoto never throws — it returns
      // null when the review is unavailable.
      const aiSummary = await reviewChorePhoto({
        executionPhotoPaths: files.map((file) => file.path),
        referencePhotoPath: task.referencePhotoUrl
          ? resolveUploadPath(task.referencePhotoUrl)
          : null,
        title: task.title,
        description: task.description,
      });

      // Status flip and submission insert are one atomic unit, so the child can
      // never end up with a saved submission on a task still marked 'pending'.
      const submission = await AppDataSource.transaction(async (manager) => {
        // Compare-and-set: only the caller that flips 'pending' → 'completed'
        // gets to insert, so a double-click cannot create two submissions.
        const transition = await manager
          .createQueryBuilder()
          .update(Task)
          .set({ status: TaskStatus.COMPLETED, rejectionNote: null })
          .where('id = :taskId AND status = :expected', {
            taskId,
            expected: isResubmission ? TaskStatus.REJECTED : TaskStatus.PENDING,
          })
          .execute();

        if (!transition.affected) {
          return null;
        }

        const created = manager.create(Submission, {
          taskId: task.id,
          childId: child.id,
          photoUrls: savedPhotoNames,
          aiSummary,
        });
        await manager.save(created);
        return created;
      });

      if (!submission) {
        res.status(409).json({ error: 'המשימה כבר נשלחה להורים' });
        return;
      }

      res.status(201).json({
        task: {
          id: task.id,
          title: task.title,
          status: TaskStatus.COMPLETED,
          basePrice: task.basePrice,
          maxBonusPrice: task.maxBonusPrice,
        },
        submission: {
          id: submission.id,
          photoUrls: submission.photoUrls.map(toPublicPhotoUrl),
          aiSummary: submission.aiSummary,
          submittedAt: submission.submittedAt,
        },
        aiReviewAvailable: aiSummary !== null,
      });
    } catch (err) {
      console.error('[tasks/submit] נכשלה שליחת המשימה להורים:', err);
      res.status(500).json({ error: 'שגיאה בשמירת ההגשה. נסו שוב בעוד רגע.' });
    }
  },
);


/**
 * POST /api/tasks/:taskId/review
 * Parent reviews a completed task — either approves it (scores + pays out) or
 * rejects it (sends it back to the child for corrections).
 *
 * Body: { action: 'approve', finalScore: 0..100 } | { action: 'reject', note: string }
 *
 * Approve payout: basePrice + (finalScore / 100) * maxBonusPrice, credited to
 * the child's ChildProfile.balance (and lifetime totals). Reject moves the task
 * to 'rejected' — never back to 'pending' — so the child's pending count stays
 * capped at one even while a rejected chore awaits rework. Both transitions run
 * as a compare-and-set on status = 'completed', so a double-click can never pay
 * out twice or reject an already-approved task.
 *
 * The local proof photos are deleted after the transaction commits (approve
 * discards them for good; reject discards them because a fresh photo is
 * required on resubmission).
 */
router.post(
  '/:taskId/review',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const taskId = req.params.taskId as string;
    const parent = req.user!;

    if (!parent.family) {
      res.status(400).json({ error: 'עליך להשתייך למשפחה כדי לבדוק משימות' });
      return;
    }

    const review = parseReviewAction(req.body);
    if ('error' in review) {
      res.status(400).json({ error: review.error });
      return;
    }

    const familyId = parent.family.id;

    try {
      const outcome = await AppDataSource.transaction((manager) =>
        runReview(manager, taskId, familyId, review),
      );

      if (!outcome.ok) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }

      // Local cleanup runs after the transaction is committed: a failed delete
      // costs disk space and must never roll back a state change already saved.
      await deleteLocalPhotos(outcome.photoUrls);

      if (outcome.action === 'reject') {
        res.json({
          task: {
            id: outcome.taskId,
            status: TaskStatus.REJECTED,
            rejectionNote: outcome.rejectionNote,
            rejectionCount: outcome.rejectionCount,
          },
        });
        return;
      }

      const profile = await AppDataSource.getRepository(ChildProfile).findOne({
        where: { id: outcome.childId },
      });

      res.json({
        task: {
          id: taskId,
          status: TaskStatus.APPROVED,
          finalScore: outcome.finalScore,
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
          lifetimeEarnings: profile?.lifetimeEarnings ?? null,
          lifetimeTasksCount: profile?.lifetimeTasksCount ?? null,
        },
      });
    } catch (err) {
      console.error('[tasks/review] נכשלה בדיקת המשימה:', err);
      res.status(500).json({ error: 'שגיאה בבדיקת המשימה. נסו שוב בעוד רגע.' });
    }
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
        where: { id, family: { id: parent.family?.id } },
        relations: ['submission'],
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

      // A 'completed' or 'rejected' task still has a submission row — the DB
      // cascades that delete, but the proof photo files on disk are ours to clean up.
      // The parent's reference photo (if any) is cleaned up the same way.
      const photoUrls = [
        ...(task.submission?.photoUrls ?? []),
        ...(task.referencePhotoUrl ? [task.referencePhotoUrl] : []),
      ];

      await taskRepo.remove(task);
      await deleteLocalPhotos(photoUrls);
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
        relations: ['assignedTo', 'createdBy'],
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
          // אם הסטטוס היה תפוס או ממתין לתיקון, מחזירים אותה לפתוח
          if (task.status === TaskStatus.PENDING || task.status === TaskStatus.REJECTED) {
            task.status = TaskStatus.OPEN;
            task.rejectionNote = null;
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

          // אם המשימה הייתה פתוחה באוויר, היא עומדת להפוך לתפוסה עבורו — כאן
          // חייבים לאכוף את אותה הגבלה כמו בחטיפת משימה: לא לתת לילד שתי
          // משימות 'pending' בו-זמנית.
          if (task.status === TaskStatus.OPEN && child.id !== task.assignedTo?.id) {
            const hasPending = await childHasPendingTask(child.id, task.id);
            if (hasPending) {
              res.status(409).json({
                error: `${child.name} כבר מבצע/ת משימה אחרת. אפשר לשייך משימה חדשה רק אחרי שהמשימה הנוכחית תושלם.`,
              });
              return;
            }
          }

          task.assignedTo = child;
          if (task.status === TaskStatus.OPEN) {
            task.status = TaskStatus.PENDING;
          }
        }
      }

      await taskRepo.save(task);
      res.json({ task: toTaskDto(task) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);


export default router;
