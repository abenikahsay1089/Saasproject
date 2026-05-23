import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationsApi } from '../services/api.js';
import UserAvatar from './UserAvatar.jsx';

const routeTitles = {
  '/': 'Workspaces',
  '/people': 'Find people',
  '/messages': 'Messages',
  '/notifications': 'Inbox',
  '/profile': 'Account',
};

function pageTitle(pathname) {
  if (routeTitles[pathname]) return routeTitles[pathname];
  if (pathname.startsWith('/boards/')) return 'Board';
  if (pathname.startsWith('/messages/')) return 'Messages';
  return 'TaskFlow';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title = pageTitle(pathname);

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    refetchInterval: 60_000,
  });
  const unreadCount =
    notificationsData?.notifications?.filter((n) => !n.read_status).length ?? 0;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
      <div className="flex flex-1 items-center justify-end gap-3">
        <Link
          to="/notifications"
          className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={`Inbox${unreadCount ? `, ${unreadCount} unread` : ''}`}
        >
          <span aria-hidden>🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <UserAvatar user={user} size="sm" />
          <span className="hidden sm:inline">
            <span className="text-slate-500">Hi, </span>
            <strong className="text-slate-800 dark:text-slate-200">{user?.name?.split(' ')[0]}</strong>
          </span>
        </Link>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
