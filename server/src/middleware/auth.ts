import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { verifyToken, AuthTokenPayload } from '../utils/token';

export interface AuthenticatedRequest extends Request {
  auth?: AuthTokenPayload;
  user?: User;
}

/**
 * Bearer-token auth middleware.
 * Attaches decoded token payload and loaded User entity to the request.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({
    where: { id: payload.userId },
    relations: ['family', 'childProfile'],
  });

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.auth = payload;
  req.user = user;
  next();
}

/** Restrict route to users with role = parent. */
export function requireParent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== 'parent') {
    res.status(403).json({ error: 'Parent access required' });
    return;
  }
  next();
}

/** Restrict route to users with role = child. */
export function requireChild(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== 'child') {
    res.status(403).json({ error: 'Child access required' });
    return;
  }
  next();
}
