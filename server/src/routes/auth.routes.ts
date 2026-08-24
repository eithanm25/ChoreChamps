import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { User, UserRole } from '../entities/User';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signToken } from '../utils/token';
import { AuthenticatedRequest } from '../middleware/auth';
import { PG_UNIQUE_VIOLATION } from '../services/familyCode';

const router = Router();

// Note: the project's .env uses CLIENT_ID/CLIENT_SECRET, not GOOGLE_CLIENT_ID/
// GOOGLE_CLIENT_SECRET. Only CLIENT_ID is actually needed: verifying a Google
// ID token (the `credential` @react-oauth/google's login button returns) is
// audience-checked against the client ID alone — the secret is for
// server-side authorization-code exchanges, which this flow doesn't do.
const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;

let googleClient: OAuth2Client | null = null;

/** Constructed lazily so a missing CLIENT_ID degrades this one feature instead of crashing startup. */
function getGoogleClient(): OAuth2Client | null {
  if (googleClient) {
    return googleClient;
  }
  if (!GOOGLE_CLIENT_ID) {
    console.warn('[auth/google] CLIENT_ID is not set; Google sign-in is disabled');
    return null;
  }
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  return googleClient;
}

/**
 * POST /api/auth/signup
 * Parent registration with email and password.
 *
 *   - No inviteCode -> primary parent: familyId stays null until the /onboarding
 *     screen calls POST /api/family/create.
 *   - inviteCode provided -> co-parent joining an existing family (the
 *     email/password counterpart of Google Flow B): attaches directly to that
 *     family and the code is consumed (cleared) on success. This is the same
 *     ?inviteCode=... link used by the Google button on /signup — a co-parent
 *     must end up in the same family regardless of which method they choose.
 */
router.post('/signup', async (req, res: Response) => {
  const { email, password, name, inviteCode } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    inviteCode?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const familyRepo = AppDataSource.getRepository(Family);

  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'כתובת האימייל הזו כבר רשומה במערכת — נסו להתחבר במקום' });
    return;
  }

  const displayName = name?.trim() || email.split('@')[0];

  let family: Family | null = null;
  if (inviteCode?.trim()) {
    family = await familyRepo.findOne({ where: { parentInviteCode: inviteCode.trim() } });
    if (!family) {
      res.status(404).json({ error: 'קוד ההזמנה אינו תקין או שכבר נוצל' });
      return;
    }
  }

  const user = userRepo.create({
    name: displayName,
    email,
    password: hashPassword(password),
    role: UserRole.PARENT,
    family,
  });

  try {
    await userRepo.save(user);
  } catch (err: any) {
    if (err?.code === PG_UNIQUE_VIOLATION) {
      res.status(409).json({ error: `כבר יש בן משפחה בשם "${displayName}" בקבוצה שלכם` });
      return;
    }
    throw err;
  }

  if (family) {
    // הקוד חד-פעמי: מנטרלים אותו מיד כדי שאף אחד אחר לא יוכל להשתמש בו שוב.
    family.parentInviteCode = null;
    await familyRepo.save(family);
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    familyId: family?.id ?? null,
  });

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      familyId: family?.id ?? null,
      familyCode: family?.familyCode ?? null,
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

/**
 * POST /api/auth/google
 * Google Sign-In for parents only — never used for children, who always use
 * familyCode + PIN. Verifies the Google ID token, then:
 *
 *   1. Email already registered here -> always log in, regardless of intent
 *      (inviteCode, if any, is ignored; an existing account is never
 *      re-parented into a different family).
 *   2. New email + intent 'login' -> reject. The /login page's Google button
 *      authenticates existing accounts only — it must never silently create
 *      one just because someone clicked it with an unregistered Google account.
 *   3. New email + intent 'signup' + inviteCode -> Flow B: join the existing
 *      family the code belongs to as a co-parent. The code is single-use —
 *      consumed (cleared) on success.
 *   4. New email + intent 'signup', no inviteCode -> Flow A: register a bare
 *      primary-parent account with no family yet, exactly like POST /signup.
 *      Family creation stays a deliberate, separate step (POST
 *      /api/family/create via /onboarding).
 */
router.post('/google', async (req, res: Response) => {
  const { credentialToken, inviteCode, intent } = req.body as {
    credentialToken?: string;
    inviteCode?: string;
    intent?: 'signup' | 'login';
  };

  if (!credentialToken) {
    res.status(400).json({ error: 'credentialToken is required' });
    return;
  }

  const client = getGoogleClient();
  if (!client) {
    res.status(500).json({ error: 'ההתחברות עם Google אינה מוגדרת בשרת כרגע' });
    return;
  }

  let email: string;
  let name: string;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credentialToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      res.status(401).json({ error: 'לא ניתן לאמת את חשבון ה-Google (אימייל לא מאומת)' });
      return;
    }

    email = payload.email;
    name = payload.name?.trim() || email.split('@')[0];
  } catch (err) {
    console.error('[auth/google] token verification failed:', err);
    res.status(401).json({ error: 'אימות Google נכשל, נסו שוב' });
    return;
  }

  try {
    const userRepo = AppDataSource.getRepository(User);
    const familyRepo = AppDataSource.getRepository(Family);

    // משתמש חוזר: מתחברים בלבד. inviteCode מתעלמים ממנו במכוון — חשבון קיים
    // לעולם לא "עובר" למשפחה אחרת דרך התחברות חוזרת.
    const existing = await userRepo.findOne({ where: { email }, relations: ['family'] });
    if (existing) {
      if (existing.role !== UserRole.PARENT) {
        res.status(403).json({ error: 'חשבון זה אינו חשבון הורה' });
        return;
      }

      const token = signToken({
        userId: existing.id,
        role: existing.role,
        familyId: existing.family?.id ?? null,
      });

      res.json({
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          familyId: existing.family?.id ?? null,
          familyCode: existing.family?.familyCode ?? null,
        },
        token,
      });
      return;
    }

    // חשבון חדש: כניסה מ-/login לעולם לא יוצרת משתמש — רק מ-/signup.
    if (intent === 'login') {
      res.status(404).json({ error: 'המשתמש לא קיים במערכת' });
      return;
    }

    // חשבון זה מתחבר אך ורק דרך Google — סיסמה אקראית שאף אחד לא רואה,
    // שמונעת כל אפשרות התחברות בסיסמה על החשבון הזה.
    const placeholderPassword = hashPassword(randomBytes(32).toString('hex'));

    if (inviteCode?.trim()) {
      // Flow B: הצטרפות כהורה נוסף למשפחה קיימת
      const family = await familyRepo.findOne({ where: { parentInviteCode: inviteCode.trim() } });
      if (!family) {
        res.status(404).json({ error: 'קוד ההזמנה אינו תקין או שכבר נוצל' });
        return;
      }

      const coParent = userRepo.create({
        name,
        email,
        password: placeholderPassword,
        role: UserRole.PARENT,
        family,
      });

      try {
        await userRepo.save(coParent);
      } catch (err: any) {
        if (err?.code === PG_UNIQUE_VIOLATION) {
          res.status(409).json({ error: `כבר יש בן משפחה בשם "${name}" בקבוצה שלכם` });
          return;
        }
        throw err;
      }

      // הקוד חד-פעמי: מנטרלים אותו מיד כדי שאף אחד אחר לא יוכל להשתמש בו שוב.
      family.parentInviteCode = null;
      await familyRepo.save(family);

      const token = signToken({ userId: coParent.id, role: coParent.role, familyId: family.id });

      res.status(201).json({
        user: {
          id: coParent.id,
          name: coParent.name,
          email: coParent.email,
          role: coParent.role,
          familyId: family.id,
          familyCode: family.familyCode,
        },
        token,
      });
      return;
    }

    // Flow A: הורה ראשי חדש — בדיוק כמו הרשמה רגילה עם אימייל+סיסמה, יוצרים
    // רק את המשתמש עם family: null. הקמת המשפחה היא תמיד צעד מודע ונפרד
    // (POST /api/family/create דרך מסך ה-onboarding), לא משהו שקורה מאליו עם
    // שם שהומצא אוטומטית — בין אם לוחצים Google מ-/signup ובין אם מ-/login.
    const parent = userRepo.create({
      name,
      email,
      password: placeholderPassword,
      role: UserRole.PARENT,
      family: null,
    });
    await userRepo.save(parent);

    const token = signToken({ userId: parent.id, role: parent.role, familyId: null });

    res.status(201).json({
      user: {
        id: parent.id,
        name: parent.name,
        email: parent.email,
        role: parent.role,
        familyId: null,
        familyCode: null,
      },
      token,
    });
  } catch (err) {
    console.error('[auth/google] failed to complete Google sign-in:', err);
    res.status(500).json({ error: 'שגיאה בהתחברות עם Google, נסו שוב בעוד רגע' });
  }
});

export default router;
