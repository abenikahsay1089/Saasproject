import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../services/api.js';
import { brand } from '../content/copy.js';

const linkClass = ({ isActive }) =>
  [
    'flex flex-col rounded-lg px-3 py-2.5 text-sm transition-colors',
    isActive
      ? 'bg-indigo-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  ].join(' ');

const nav = [
  { to: '/', end: true, label: 'Workspaces', hint: 'All your boards', icon: '📋' },
  { to: '/people', label: 'Find people', hint: 'Search anyone on TaskFlow', icon: '🔍' },
  { to: '/messages', label: 'Messages', hint: 'Private chats with anyone', icon: '💬' },
  { to: '/notifications', label: 'Inbox', hint: 'Alerts & assignments', icon: '🔔' },
  { to: '/profile', label: 'Account', hint: 'Profile & settings', icon: '👤' },
];

export default function Sidebar() {
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });
  const unreadCount =
    notificationsData?.notifications?.filter((n) => !n.read_status).length ?? 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            TF
          </span>
          <div>
            <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {brand.name}
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">{brand.tagline}</span>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <span className="flex items-center gap-2 font-medium">
              <span aria-hidden>{item.icon}</span>
              {item.label}
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span
              className={[
                'mt-0.5 pl-7 text-[11px] font-normal',
                'opacity-70',
              ].join(' ')}
            >
              {item.hint}
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Tip: find people globally, message anyone privately, or invite them into a workspace.
        </p>
      </div>
    </aside>
  );
}
