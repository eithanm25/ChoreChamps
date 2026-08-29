import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AppDataSource } from '../data-source';
import { Family } from '../entities/Family';
import { User, UserRole, AuthProvider } from '../entities/User';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { signToken } from '../utils/token';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { PG_UNIQUE_VIOLATION } from '../services/familyCode';
import { AVAILABLE_AVATARS } from '../utils/avatars';

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
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
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

  // A Google-authenticated account's password column is a random,
  // unrecoverable placeholder (see AuthProvider docstring) — no password
  // typed here will ever match it, including the account's real Gmail
  // password, which this app never receives from Google in the first place.
  // Telling the user that specifically (rather than a generic "wrong
  // password") isn't a security leak — it doesn't help anyone guess a
  // credential — and it's the one piece of information that actually gets
  // them logged in, via the Google button instead.
  if (user.authProvider === AuthProvider.GOOGLE) {
    res.status(401).json({ error: 'חשבון זה נרשם עם Google — התחברו עם כפתור ה-Google למעלה, לא ניתן להתחבר עם סיסמה' });
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
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
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
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
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

      // Self-heals accounts created before authProvider existed (or created
      // via Google some other way that left it unset): logging in with a
      // verified Google token IS proof this account is Google-authenticated,
      // so mark it — this is what makes the wallet's security gate correctly
      // ask these users to reconfirm via Google instead of a password they
      // were never given and can never know (see AuthProvider docstring).
      if (existing.authProvider !== AuthProvider.GOOGLE) {
        existing.authProvider = AuthProvider.GOOGLE;
        await userRepo.save(existing);
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
          authProvider: existing.authProvider,
      avatarUrl: existing.avatarUrl,
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
        authProvider: AuthProvider.GOOGLE,
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
          authProvider: coParent.authProvider,
      avatarUrl: coParent.avatarUrl,
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
      authProvider: AuthProvider.GOOGLE,
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
        authProvider: parent.authProvider,
      avatarUrl: parent.avatarUrl,
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

/**
 * POST /api/auth/verify-password
 * Re-checks the currently-authenticated user's own password without issuing a
 * new token — a lightweight "step-up" confirmation gate for a sensitive
 * in-session action (see wallet.routes.ts's transfer/adjust endpoints), not a
 * login. Never reveals which part failed; a wrong password is just 401.
 */
router.post('/verify-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { password } = req.body as { password?: string };
  const user = req.user!;

  if (!password || !verifyPassword(password, user.password)) {
    res.status(401).json({ error: 'הסיסמה שגויה' });
    return;
  }

  res.json({ verified: true });
});

/**
 * POST /api/auth/verify-google
 * The Google-account counterpart of /verify-password — a sensitive in-session
 * action's "step-up" confirmation for a user who signed in via Google, whose
 * `password` column is an unusable random placeholder (see AuthProvider
 * docstring) and so can never complete a password prompt. Re-verifies a fresh
 * Google ID token and requires it to match the currently-authenticated user's
 * own email — proving "you can still sign into this exact Google account
 * right now" the same way a password re-entry would prove "you still know
 * your password".
 */
router.post('/verify-google', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { credentialToken } = req.body as { credentialToken?: string };
  const user = req.user!;

  if (!credentialToken) {
    res.status(400).json({ error: 'credentialToken is required' });
    return;
  }

  const client = getGoogleClient();
  if (!client) {
    res.status(500).json({ error: 'אימות Google אינו מוגדר בשרת כרגע' });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({ idToken: credentialToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified || payload.email !== user.email) {
      res.status(401).json({ error: 'האימות לא תואם את חשבון ה-Google שלך' });
      return;
    }

    res.json({ verified: true });
  } catch (err) {
    console.error('[auth/verify-google] token verification failed:', err);
    res.status(401).json({ error: 'אימות Google נכשל, נסו שוב' });
  }
});

/**
 * POST /api/auth/change-password
 * Self-service password (parent) / PIN (child) change. Requires the current
 * value, same as any password-change form. Rejected outright for a
 * Google-authenticated parent — see AuthProvider docstring; there is no
 * current password for them to prove they know, since none was ever set by
 * them or shown to them.
 */
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (user.authProvider === AuthProvider.GOOGLE) {
    res.status(400).json({ error: 'חשבון זה מחובר עם Google בלבד — אין סיסמה לניהול כאן' });
    return;
  }
  if (!newPassword?.trim()) {
    res.status(400).json({ error: 'יש להזין ערך חדש' });
    return;
  }
  if (!currentPassword || !verifyPassword(currentPassword, user.password)) {
    res.status(401).json({ error: 'הערך הנוכחי שגוי' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  user.password = hashPassword(newPassword);
  await userRepo.save(user);

  res.json({ message: 'העדכון בוצע בהצלחה' });
});

/**
 * PATCH /api/auth/avatar
 * Sets the caller's profile avatar. Must be one of the fixed emoji in
 * utils/avatars.ts — never an arbitrary string/URL, which keeps this a
 * zero-storage, zero-cloud-cost feature with no upload surface to secure.
 */
router.patch('/avatar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { avatarUrl } = req.body as { avatarUrl?: string };

  if (!avatarUrl || !AVAILABLE_AVATARS.includes(avatarUrl)) {
    res.status(400).json({ error: 'אווטאר לא תקין' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  user.avatarUrl = avatarUrl;
  await userRepo.save(user);

  res.json({ avatarUrl: user.avatarUrl });
});

export default router;
