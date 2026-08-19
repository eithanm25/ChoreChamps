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
import { generateInviteCode, hashPassword } from '../utils/crypto';
import { signToken } from '../utils/token';

const router = Router();

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:5000';

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

    const family = familyRepo.create({
      familyName: familyName.trim(),
      parentInviteCode: generateInviteCode(),
      childInviteCode: generateInviteCode(),
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
      },
      token,
    });
  },
);

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

    await userRepo.save(coParent);

    const uniqueLink = `${APP_BASE_URL}/join/co-parent/${coParent.id}`;

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

    await userRepo.save(child);

    const profile = profileRepo.create({
      id: child.id,
      user: child,
      balance: '0',
      totalBonusEarned: '0',
    });

    await profileRepo.save(profile);

    const uniqueLink = `${APP_BASE_URL}/join/child/${child.id}`;

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

export default router;
