import { Router, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { User, UserRole } from '../entities/User';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signToken } from '../utils/token';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/signup
 * Parent-only registration with email and password.
 * Creates a parent user with familyId null until POST /api/family/create.
 */
router.post('/signup', async (req, res: Response) => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const displayName = name?.trim() || email.split('@')[0];

  const user = userRepo.create({
    name: displayName,
    email,
    password: hashPassword(password),
    role: UserRole.PARENT,
    family: null,
  });

  await userRepo.save(user);

  const token = signToken({
    userId: user.id,
    role: user.role,
    familyId: null,
  });

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      familyId: null,
    },
    token,
  });
});

/**
 * POST /api/auth/login
 * Email + password login for parents who signed up via /signup.
 */
router.post('/login', async (req, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({
    where: { email },
    relations: ['family'],
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!verifyPassword(password, user.password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    familyId: user.family?.id ?? null,
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      familyId: user.family?.id ?? null,
      familyCode: user.family?.familyCode ?? null,
    },
    token,
  });
});

/**
 * POST /api/auth/profile-login
 * familyCode + username + password login for children and other profiles
 * created in-app by a parent, which have no email to log in with.
 *
 * Device-agnostic by design: unlike a saved link keyed to a UUID, a household
 * code + name works from any device — a friend's phone, a school computer,
 * a new tablet — as long as the child remembers their family's code and name.
 *
 * Errors are deliberately generic ("Invalid credentials") regardless of
 * whether the family code, username, or password was wrong, to avoid leaking
 * which part of the input was incorrect.
 */
router.post('/profile-login', async (req, res: Response) => {
  const { familyCode, username, password } = req.body as {
    familyCode?: string;
    username?: string;
    password?: string;
  };

  if (!familyCode?.trim() || !username?.trim()) {
    res.status(400).json({ error: 'familyCode and username are required' });
    return;
  }

  const familyRepo = AppDataSource.getRepository(Family);
  const family = await familyRepo.findOne({ where: { familyCode: familyCode.trim() } });

  if (!family) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({
    where: { name: username.trim(), family: { id: family.id } },
    relations: ['family'],
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!password || !verifyPassword(password, user.password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    familyId: user.family?.id ?? null,
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      familyId: user.family?.id ?? null,
      familyCode: family.familyCode,
    },
    token,
  });
});

export default router;
