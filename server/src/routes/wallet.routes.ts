import { Router, Response, NextFunction } from 'express';
import { AppDataSource } from '../data-source';
import { AuthenticatedRequest, requireAuth, requireParent } from '../middleware/auth';
import { ChildProfile } from '../entities/ChildProfile';
import { User, UserRole } from '../entities/User';
import { SubscriptionTier } from '../entities/Family';
import { WalletTransaction, WalletTransactionType } from '../entities/WalletTransaction';
import { toCents, fromCents } from '../utils/money';

const router = Router();

/** Blocks every route below unless the requester's household is on the ACADEMY tier. */
function requireAcademyTier(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.family?.tier !== SubscriptionTier.ACADEMY) {
    res.status(403).json({
      error: 'העברות ותיקוני ארנק זמינות רק במסלול האקדמיה 🎓 שדרגו כדי לפתוח את הפיצ׳ר',
    });
    return;
  }
  next();
}

router.use(requireAuth, requireAcademyTier);

type WalletOutcome<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

/**
 * POST /api/wallet/transfer-sibling
 * Moves ChoreCoins from one child's wallet to a sibling's, in the same family.
 * A child may only ever send from their own wallet (sourceChildId must match
 * the caller); a parent may direct a transfer between any two of their
 * children. Both ChildProfile rows are locked in a fixed id order (not
 * source-then-target) so two concurrent opposite-direction transfers between
 * the same pair of siblings can never deadlock on each other's locks.
 */
router.post('/transfer-sibling', async (req: AuthenticatedRequest, res: Response) => {
  const requester = req.user!;
  if (!requester.family) {
    res.status(400).json({ error: 'עליך להשתייך למשפחה' });
    return;
  }

  const { sourceChildId, targetChildId, amount, reason } = req.body as {
    sourceChildId?: string;
    targetChildId?: string;
    amount?: unknown;
    reason?: string;
  };

  if (!sourceChildId || !targetChildId) {
    res.status(400).json({ error: 'יש לציין ילד/ה מקור וילד/ה יעד' });
    return;
  }
  if (sourceChildId === targetChildId) {
    res.status(400).json({ error: 'לא ניתן להעביר מטבעות לאותו ילד/ה' });
    return;
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: 'סכום ההעברה חייב להיות מספר חיובי' });
    return;
  }
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    res.status(400).json({ error: 'חובה לציין סיבה להעברה' });
    return;
  }
  if (requester.role === UserRole.CHILD && requester.id !== sourceChildId) {
    res.status(403).json({ error: 'ילד/ה יכולים להעביר מטבעות רק מהארנק של עצמם' });
    return;
  }

  const familyId = requester.family.id;
  const amountCents = Math.round(amountNum * 100);
  const amountStr = fromCents(amountCents);

  try {
    const result = await AppDataSource.transaction(
      async (
        manager,
      ): Promise<WalletOutcome<{ transactionId: string; newSourceBalance: string; newTargetBalance: string }>> => {
        const userRepo = manager.getRepository(User);
        const [sourceUser, targetUser] = await Promise.all([
          userRepo.findOne({ where: { id: sourceChildId, family: { id: familyId }, role: UserRole.CHILD } }),
          userRepo.findOne({ where: { id: targetChildId, family: { id: familyId }, role: UserRole.CHILD } }),
        ]);
        if (!sourceUser || !targetUser) {
          return { ok: false, status: 404, error: 'אחד הילדים לא נמצא במשפחה זו' };
        }

        const [firstId, secondId] = [sourceChildId, targetChildId].sort();
        const first = await manager.findOne(ChildProfile, {
          where: { id: firstId },
          lock: { mode: 'pessimistic_write' },
        });
        const second = await manager.findOne(ChildProfile, {
          where: { id: secondId },
          lock: { mode: 'pessimistic_write' },
        });
        const sourceProfile = firstId === sourceChildId ? first : second;
        const targetProfile = firstId === sourceChildId ? second : first;

        if (!sourceProfile || !targetProfile) {
          return { ok: false, status: 404, error: 'לא נמצא ארנק עבור אחד הילדים' };
        }

        const sourceCents = toCents(sourceProfile.balance);
        if (amountCents > sourceCents) {
          return { ok: false, status: 409, error: 'אין מספיק מטבעות בארנק של הילד/ה השולח/ת' };
        }

        const newSourceBalance = fromCents(sourceCents - amountCents);
        const newTargetBalance = fromCents(toCents(targetProfile.balance) + amountCents);
        await manager.update(ChildProfile, { id: sourceChildId }, { balance: newSourceBalance });
        await manager.update(ChildProfile, { id: targetChildId }, { balance: newTargetBalance });

        const transaction = manager.create(WalletTransaction, {
          familyId,
          type: WalletTransactionType.SIBLING_TRANSFER,
          amount: amountStr,
          reason: trimmedReason,
          fromChildId: sourceChildId,
          toChildId: targetChildId,
          initiatedById: requester.id,
        });
        await manager.save(transaction);

        return { ok: true, transactionId: transaction.id, newSourceBalance, newTargetBalance };
      },
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json({
      message: 'ההעברה בוצעה בהצלחה 💸',
      transactionId: result.transactionId,
      newSourceBalance: result.newSourceBalance,
      newTargetBalance: result.newTargetBalance,
    });
  } catch (err) {
    console.error('[wallet/transfer-sibling] נכשלה ההעברה:', err);
    res.status(500).json({ error: 'שגיאה בביצוע ההעברה. נסו שוב בעוד רגע.' });
  }
});

/**
 * POST /api/wallet/parent-adjust
 * Parent manually credits ('give') or debits ('take') one child's wallet —
 * a bonus, an allowance top-up, or a behavioral fine. Locked and atomic like
 * every other balance mutation in the app; 'take' is rejected if it would
 * overdraw the child below zero.
 */
router.post('/parent-adjust', requireParent, async (req: AuthenticatedRequest, res: Response) => {
  const parent = req.user!;
  if (!parent.family) {
    res.status(400).json({ error: 'עליך להשתייך למשפחה' });
    return;
  }

  const { childId, action, amount, reason } = req.body as {
    childId?: string;
    action?: string;
    amount?: unknown;
    reason?: string;
  };

  if (!childId) {
    res.status(400).json({ error: 'יש לציין ילד/ה' });
    return;
  }
  if (action !== 'give' && action !== 'take') {
    res.status(400).json({ error: "action must be 'give' or 'take'" });
    return;
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: 'הסכום חייב להיות מספר חיובי' });
    return;
  }
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    res.status(400).json({ error: 'חובה לציין סיבה' });
    return;
  }

  const familyId = parent.family.id;
  const amountCents = Math.round(amountNum * 100);
  const amountStr = fromCents(amountCents);

  try {
    const result = await AppDataSource.transaction(
      async (manager): Promise<WalletOutcome<{ transactionId: string; newBalance: string }>> => {
        const child = await manager.findOne(User, {
          where: { id: childId, family: { id: familyId }, role: UserRole.CHILD },
        });
        if (!child) {
          return { ok: false, status: 404, error: 'הילד/ה לא נמצא/ה במשפחה זו' };
        }

        const profile = await manager.findOne(ChildProfile, {
          where: { id: childId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!profile) {
          return { ok: false, status: 404, error: 'לא נמצא ארנק עבור ילד/ה זו' };
        }

        const balanceCents = toCents(profile.balance);
        if (action === 'take' && amountCents > balanceCents) {
          return { ok: false, status: 409, error: 'אין לילד/ה מספיק מטבעות בארנק לביצוע הפעולה' };
        }

        const newBalanceCents = action === 'give' ? balanceCents + amountCents : balanceCents - amountCents;
        const newBalance = fromCents(newBalanceCents);
        await manager.update(ChildProfile, { id: childId }, { balance: newBalance });

        const transaction = manager.create(WalletTransaction, {
          familyId,
          type: action === 'give' ? WalletTransactionType.PARENT_GIVE : WalletTransactionType.PARENT_TAKE,
          amount: amountStr,
          reason: trimmedReason,
          fromChildId: action === 'take' ? childId : null,
          toChildId: action === 'give' ? childId : null,
          initiatedById: parent.id,
        });
        await manager.save(transaction);

        return { ok: true, transactionId: transaction.id, newBalance };
      },
    );

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(201).json({
      message: action === 'give' ? 'המטבעות נוספו בהצלחה 🎁' : 'המטבעות נוכו בהצלחה',
      transactionId: result.transactionId,
      newBalance: result.newBalance,
    });
  } catch (err) {
    console.error('[wallet/parent-adjust] נכשל עדכון הארנק:', err);
    res.status(500).json({ error: 'שגיאה בעדכון הארנק. נסו שוב בעוד רגע.' });
  }
});

export default router;
