import { initialsFromName, resolveAvatarUrl } from '../utils/avatarUrl.js';

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
  xl: 'h-32 w-32 text-3xl',
};

/**
 * Profile image with initials fallback when no avatar_url is set.
 */
export default function UserAvatar({ user, size = 'md', className = '' }) {
  const src = resolveAvatarUrl(user?.avatar_url);
  const ring = sizes[size] || sizes.md;
  const initials = initialsFromName(user?.name);

  if (src) {
    return (
      <img
        src={src}
        alt={user?.name ? `${user.name} avatar` : 'Profile'}
        className={`rounded-full object-cover ring-2 ring-white dark:ring-slate-800 ${ring} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white ring-2 ring-white dark:ring-slate-800 ${ring} ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
