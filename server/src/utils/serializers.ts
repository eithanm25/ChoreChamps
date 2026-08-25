import { Task, TaskStatus } from '../entities/Task';

export interface PublicMember {
  id: string;
  name: string;
}

interface MemberLike {
  id: string;
  name: string;
}

/** Strip a User entity down to {id, name} — never forward password hashes to the client. */
export function toPublicMember(user: MemberLike | null | undefined): PublicMember | null {
  if (!user) {
    return null;
  }
  return { id: user.id, name: user.name };
}

/** Normalize a stored photo filename into a path servable from /uploads. */
export function toPublicPhotoUrl(filename: string): string {
  if (/^https?:\/\//i.test(filename) || filename.startsWith('/uploads/')) {
    return filename;
  }
  return `/uploads/${filename}`;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  basePrice: string;
  maxBonusPrice: string;
  awardedBonus: string | null;
  finalScore: number | null;
  rejectionNote: string | null;
  rejectionCount: number;
  status: Task['status'];
  createdAt: Date;
  assignedTo: PublicMember | null;
  createdBy: PublicMember | null;
  /**
   * The parent's reference/target photo, if the task has one — null once the
   * task is approved, since the file is deleted at that point (see
   * taskReview.ts) even though the DB column itself is left populated,
   * matching how Submission.photoUrls already behaves after approval.
   */
  referencePhotoUrl: string | null;
  submission: {
    id: string;
    photoUrls: string[];
    aiSummary: Task['submission']['aiSummary'] | null;
    submittedAt: Date;
  } | null;
}

/** Convert a Task entity into the client-safe shape. Only include relations that were loaded. */
export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    basePrice: task.basePrice,
    maxBonusPrice: task.maxBonusPrice,
    awardedBonus: task.awardedBonus,
    finalScore: task.finalScore,
    rejectionNote: task.rejectionNote,
    rejectionCount: task.rejectionCount,
    status: task.status,
    createdAt: task.createdAt,
    assignedTo: toPublicMember(task.assignedTo),
    createdBy: toPublicMember(task.createdBy),
    referencePhotoUrl:
      task.status !== TaskStatus.APPROVED && task.referencePhotoUrl
        ? toPublicPhotoUrl(task.referencePhotoUrl)
        : null,
    submission: task.submission
      ? {
          id: task.submission.id,
          photoUrls: task.submission.photoUrls.map(toPublicPhotoUrl),
          aiSummary: task.submission.aiSummary,
          submittedAt: task.submission.submittedAt,
        }
      : null,
  };
}
