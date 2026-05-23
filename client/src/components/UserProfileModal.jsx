import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { dm as dmCopy } from '../content/copy.js';
import UserAvatar from './UserAvatar.jsx';

export default function UserProfileModal({ userId, onClose }) {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => usersApi.getProfile(userId),
    enabled: Number.isFinite(userId),
  });

  const user = data?.user;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-24 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ) : isError || !user ? (
          <p className="py-6 text-center text-sm text-red-600">Could not load profile.</p>
        ) : (
          <div className="flex flex-col items-center text-center">
            <UserAvatar user={user} size="xl" />
            <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">{user.name}</h3>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">@{user.username}</p>
            {user.bio ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{user.bio}</p>
            ) : (
              <p className="mt-4 text-sm italic text-slate-400">No bio yet.</p>
            )}
            <dl className="mt-6 w-full space-y-2 border-t border-slate-100 pt-4 text-left text-sm dark:border-slate-800">
              {user.email && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="truncate font-medium text-slate-800 dark:text-slate-200">{user.email}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Member since</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(user.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {user && Number(user.id) !== Number(me?.id) && (
            <button
              type="button"
              onClick={() => {
                navigate(`/messages?with=${user.id}`);
                onClose();
              }}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {dmCopy.messageUser}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
