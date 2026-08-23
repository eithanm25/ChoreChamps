import { Router, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { User, UserRole } from '../entities/User';
import { ChildProfile } from '../entities/ChildProfile';
import {
  AuthenticatedRequest,
  requireAuth,
  requireParent,
} from '../middleware/auth';
import { generateInviteCode, generateFourDigitCode, hashPassword } from '../utils/crypto';
import { signToken } from '../utils/token';
import { Task, TaskStatus } from '../entities/Task';

const router = Router();

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:5173';

/** Postgres unique-violation error code, used to turn a duplicate name/code into a friendly 4xx. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Generate a family code that doesn't already exist. A bare random 4-digit
 * code collides often enough at real scale to need a check-and-retry loop —
 * this is not just theoretical, 10,000 total values is a small keyspace.
 * Falls back to a wider random range after repeated collisions rather than
 * looping forever.
 */
async function generateUniqueFamilyCode(): Promise<string> {
  const familyRepo = AppDataSource.getRepository(Family);

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateFourDigitCode();
    const existing = await familyRepo.findOne({ where: { familyCode: code } });
    if (!existing) {
      return code;
    }
  }

  // Extremely unlikely after 10 attempts, but widen the keyspace rather than
  // ever returning a colliding code.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await familyRepo.findOne({ where: { familyCode: code } });
    if (!existing) {
      return code;
    }
  }

  throw new Error('לא ניתן היה להנפיק קוד משפחה ייחודי, נסו שוב');
}

/**
 * POST /api/family/create
 * Authenticated parent creates a household, assigns themselves to it,
 * locks role as 'parent', and generates invite codes.
 */
router.post(
  '/create',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const { familyName } = req.body as { familyName?: string };
    const user = req.user!;

    if (!familyName?.trim()) {
      res.status(400).json({ error: 'familyName is required' });
      return;
    }

    if (user.family) {
      res.status(409).json({ error: 'You already belong to a family' });
      return;
    }

    const familyRepo = AppDataSource.getRepository(Family);
    const userRepo = AppDataSource.getRepository(User);

    const familyCode = await generateUniqueFamilyCode();

    const family = familyRepo.create({
      familyName: familyName.trim(),
      parentInviteCode: generateInviteCode(),
      childInviteCode: generateInviteCode(),
      familyCode,
    });

    await familyRepo.save(family);

    user.family = family;
    user.role = UserRole.PARENT;
    await userRepo.save(user);

    const token = signToken({
      userId: user.id,
      role: user.role,
      familyId: family.id,
    });

    res.status(201).json({
      family: {
        id: family.id,
        familyName: family.familyName,
        parentInviteCode: family.parentInviteCode,
        childInviteCode: family.childInviteCode,
        familyCode: family.familyCode,
      },
      token,
    });
  },
);

/**
 * GET /api/family/me
 * Any authenticated family member fetches their household's login code and
 * name — used by the parent dashboard header, and safe to re-fetch any time
 * (e.g. after a page refresh) rather than relying solely on the one-time
 * snapshot returned by /create.
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  if (!user.family) {
    res.status(400).json({ error: 'You must belong to a family' });
    return;
  }

  const family = await AppDataSource.getRepository(Family).findOne({
    where: { id: user.family.id },
  });

  if (!family) {
    res.status(404).json({ error: 'Family not found' });
    return;
  }

  res.json({
    family: {
      id: family.id,
      familyName: family.familyName,
      familyCode: family.familyCode,
    },
  });
});

/**
 * POST /api/family/add-co-parent
 * Parent creates a co-parent account (name + password, email null).
 * Returns a unique onboarding link for the co-parent.
 */
router.post(
  '/add-co-parent',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, password } = req.body as { name?: string; password?: string };
    const parent = req.user!;

    if (!name?.trim() || !password) {
      res.status(400).json({ error: 'name and password are required' });
      return;
    }

    if (!parent.family) {
      res.status(400).json({ error: 'Create a family before adding co-parents' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);

    const coParent = userRepo.create({
      name: name.trim(),
      email: null,
      password: hashPassword(password),
      role: UserRole.PARENT,
      family: parent.family,
    });

    try {
      await userRepo.save(coParent);
    } catch (err: any) {
      if (err?.code === PG_UNIQUE_VIOLATION) {
        res.status(409).json({ error: `כבר יש בן משפחה בשם "${name.trim()}" בקבוצה שלכם` });
        return;
      }
      throw err;
    }

    const uniqueLink = `${APP_BASE_URL}/login?family=${parent.family.familyCode}&username=${encodeURIComponent(coParent.name)}`;

    res.status(201).json({
      coParent: {
        id: coParent.id,
        name: coParent.name,
        role: coParent.role,
        familyId: parent.family.id,
      },
      uniqueLink,
    });
  },
);

/**
 * POST /api/family/add-child
 * Parent creates a child account and auto-provisions a ChildProfile ledger.
 */
router.post(
  '/add-child',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, password } = req.body as { name?: string; password?: string };
    const parent = req.user!;

    if (!name?.trim() || !password) {
      res.status(400).json({ error: 'name and password are required' });
      return;
    }

    if (!parent.family) {
      res.status(400).json({ error: 'Create a family before adding children' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const profileRepo = AppDataSource.getRepository(ChildProfile);

    const child = userRepo.create({
      name: name.trim(),
      email: null,
      password: hashPassword(password),
      role: UserRole.CHILD,
      family: parent.family,
    });

    try {
      await userRepo.save(child);
    } catch (err: any) {
      if (err?.code === PG_UNIQUE_VIOLATION) {
        res.status(409).json({ error: `כבר יש בן משפחה בשם "${name.trim()}" בקבוצה שלכם` });
        return;
      }
      throw err;
    }

    const profile = profileRepo.create({
      id: child.id,
      user: child,
      balance: '0',
      totalBonusEarned: '0',
    });

    await profileRepo.save(profile);

    const uniqueLink = `${APP_BASE_URL}/login?family=${parent.family.familyCode}&username=${encodeURIComponent(child.name)}`;

    res.status(201).json({
      child: {
        id: child.id,
        name: child.name,
        role: child.role,
        familyId: parent.family.id,
        balance: profile.balance,
      },
      uniqueLink,
    });
  },
);

// ראוט מחיקת בן משפחה (הורה נוסף או ילד) מהקבוצה
router.delete(
  '/member/:id',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const memberId = req.params.id as string;
    const parent = req.user!;

    // הגנה 1: מניעת התאבדות של מנהל המערכת - אסור להורה למחוק את עצמו!
    if (memberId === parent.id) {
      res.status(400).json({ error: 'אינך יכול למחוק את עצמך מהקבוצה המשפחתית' });
      return;
    }

    try {
        
      const userRepo = AppDataSource.getRepository(User);
      const taskRepo = AppDataSource.getRepository(Task);
      
      const memberToDelete = await userRepo.findOne({
        where: { id: memberId, family: { id: parent.family?.id } }
      });

      if (!memberToDelete) {
        res.status(404).json({ error: 'בן המשפחה לא נמצא או שאינו שייך לקבוצה שלך' });
        return;
      }

      // 🔥 שלב א': טיפול חכם במשימות המשויכות לילד לפני מחיקתו!
      // (משימות שנוצרו על ידי ההורה הנמחק, וסאבמישנים ששלח ילד שנמחק, מנותקים
      // אוטומטית ברמת ה-DB דרך onDelete: 'SET NULL' על הישויות — כאן מטפלים רק
      // בהיגיון העסקי הנוסף: פתיחה מחדש של משימות שהילד היה אחראי עליהן.)
      if (memberToDelete.role === 'child') {
        // 1. משימות פתוחות/בתהליך/ממתינות לתיקון -> מנתקים מהילד ומחזירים למצב פתוח לכולם
        await taskRepo
          .createQueryBuilder()
          .update(Task)
          .set({ assignedTo: null, status: TaskStatus.OPEN, rejectionNote: null })
          .where('"assignedToId" = :id', { id: memberId })
          .andWhere('status IN (:...statuses)', {
            statuses: [TaskStatus.OPEN, TaskStatus.PENDING, TaskStatus.COMPLETED, TaskStatus.REJECTED],
          })
          .execute();

        // 2. משימות שכבר אושרו נשארות בהיסטוריה, רק מנתקים את הקישור לילד שהוסר
        await taskRepo
          .createQueryBuilder()
          .update(Task)
          .set({ assignedTo: null })
          .where('"assignedToId" = :id', { id: memberId })
          .andWhere('status = :approved', { approved: TaskStatus.APPROVED })
          .execute();
      }

      // שלב ב': עכשיו מותר למחוק את המשתמש בבטחה מלאה מהדאטהבייס!
      // משימות שההורה הנמחק פרסם, וסאבמישנים ששלח ילד שנמחק, לא חוסמים את
      // המחיקה — שני היחסים מוגדרים כ-onDelete: 'SET NULL' ברמת הסכמה.
      await userRepo.remove(memberToDelete);
      
      res.json({ message: 'בן המשפחה הוסר בהצלחה, והמשימות שלו טופלו בהתאם' });

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);


export default router;
