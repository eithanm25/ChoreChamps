import React from 'react';

interface AvatarBadgeProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<AvatarBadgeProps['size']>, string> = {
  sm: 'w-9 h-9 text-lg',
  md: 'w-11 h-11 text-2xl',
  lg: 'w-20 h-20 text-4xl',
};

/** Circular profile avatar — the user's chosen emoji if set, otherwise their name's initial on a gradient badge. */
export default function AvatarBadge({ name, avatarUrl, size = 'md' }: AvatarBadgeProps): React.ReactNode {
  const initial = name.trim().charAt(0) || '?';
  return (
    <div
      className={`${SIZE_CLASSES[size]} shrink-0 rounded-full flex items-center justify-center font-black shadow-lg ring-2 ring-slate-700/60 ${
        avatarUrl ? 'bg-slate-800' : 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
      }`}
    >
      {avatarUrl ?? initial}
    </div>
  );
}
