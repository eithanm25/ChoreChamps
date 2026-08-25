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
import { generateInviteCode, generateShortInviteCode, hashPassword } from '../utils/crypto';
import { signToken } from '../utils/token';
import { Task, TaskStatus } from '../entities/Task';
import { generateUniqueFamilyCode, PG_UNIQUE_VIOLATION } from '../services/familyCode';

const router = Router();

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:5173';

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
      // Co-parent invite codes are generated on demand (POST /co-parent-invite)
      // when the parent actually wants to invite someone — not eagerly here.
      parentInviteCode: null,
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
      // Grants "join as co-parent via Google" — sensitive, so only parents
      // (who can already see and reshare it) get it back, never children.
      parentInviteCode: user.role === UserRole.PARENT ? family.parentInviteCode : undefined,
    },
  });
});

/**
 * POST /api/family/co-parent-invite
 * Generates a fresh, short, single-use invite code for a co-parent to join
 * this family via Google Sign-In (POST /api/auth/google, Flow B). The parent
 * never types a name, email, or password for the co-parent — that all comes
 * from the co-parent's own verified Google account when they use the link.
 *
 * Calling this again before the previous code is used simply overwrites it
 * (the old one stops working) — there is always at most one valid code per
 * family. The code is consumed (cleared) automatically the moment someone
 * successfully joins with it.
 */
router.post(
  '/co-parent-invite',
  requireAuth,
  requireParent,
  async (req: AuthenticatedRequest, res: Response) => {
    const parent = req.user!;

    if (!parent.family) {
      res.status(400).json({ error: 'Create a family before inviting a co-parent' });
      return;
    }

    const familyRepo = AppDataSource.getRepository(Family);
    const inviteCode = generateShortInviteCode();

    await familyRepo.update({ id: parent.family.id }, { parentInviteCode: inviteCode });

    res.status(201).json({
      inviteCode,
      uniqueLink: `${APP_BASE_URL}/signup?inviteCode=${inviteCode}`,
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
    });

    await profileRepo.save(profile);

    const uniqueLink = `${APP_BASE_URL}/login?family=${parent.family.familyCode}&username=${encodeURIComponent(child.name)}`;

    res.status(201).json({
      child: {
        id: child.id,
        name: child.name,
        role: child.role,
        familyId: parent.family.id,
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
