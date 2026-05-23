import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { authApi, uploadAvatarFile } from '../services/api.js';
import UserAvatar from '../components/UserAvatar.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { brand } from '../content/copy.js';

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-center backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/80">
      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{value ?? 0}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const { dark, toggle } = useTheme();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.me(),
  });

  const user = data?.user;
  const stats = data?.stats;

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const afterSave = async () => {
    await refreshUser();
    qc.invalidateQueries({ queryKey: ['profile'] });
    setMessage('Profile saved.');
    setTimeout(() => setMessage(''), 3000);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        bio: bio.trim(),
      }),
    onSuccess: afterSave,
    onError: (e) => setError(e.message),
  });

  const avatarMutation = useMutation({
    mutationFn: (file) => uploadAvatarFile(file),
    onSuccess: afterSave,
    onError: (e) => setError(e.message),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => authApi.deleteAvatar(),
    onSuccess: afterSave,
    onError: (e) => setError(e.message),
  });

  if (isLoading) {
    return <p className="text-slate-500 dark:text-slate-400">Loading profile…</p>;
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Your account"
        subtitle={`Manage how you appear on ${brand.name} and control your preferences.`}
      />
      {/* Cover + avatar header */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          className="h-32 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 sm:h-40"
          role="presentation"
        />
        <div className="relative px-6 pb-6">
          <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <UserAvatar user={user} size="xl" className="shadow-lg" />
                <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarMutation.isPending || removeAvatarMutation.isPending}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-indigo-400 dark:ring-slate-600"
                  >
                    {avatarMutation.isPending ? '…' : 'Change'}
                  </button>
                  {user?.avatar_url && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Remove your profile photo?')) {
                          setError('');
                          removeAvatarMutation.mutate();
                        }
                      }}
                      disabled={avatarMutation.isPending || removeAvatarMutation.isPending}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow ring-1 ring-slate-200 hover:bg-red-50 dark:bg-slate-800 dark:text-red-400 dark:ring-slate-600"
                    >
                      {removeAvatarMutation.isPending ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setError('');
                      avatarMutation.mutate(file);
                    }
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{user?.name}</h1>
                {user?.username && (
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    @{user.username}
                  </p>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                <p className="mt-1 text-xs text-slate-400">Member since {memberSince}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Boards" value={stats?.boards_count} />
        <StatCard label="Tasks assigned" value={stats?.tasks_assigned} />
        <StatCard label="Unread alerts" value={stats?.unread_notifications} />
      </div>

      {/* Edit details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">About you</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Update how you appear to teammates on boards.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              pattern="[a-zA-Z0-9_]{3,30}"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Shown as @{username || 'username'} to teammates on boards.
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="What you work on, timezone, role…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="mt-1 block text-right text-xs text-slate-400">{bio.length}/500</span>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Used to sign in. Must be unique across accounts.
            </span>
          </label>
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Preferences</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Dark mode</p>
              <p className="text-xs text-slate-500">Easier on the eyes at night</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              onClick={toggle}
              className={[
                'relative h-7 w-12 rounded-full transition-colors',
                dark ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                  dark ? 'left-6' : 'left-0.5',
                ].join(' ')}
              />
            </button>
          </div>
          <Link
            to="/notifications"
            className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-slate-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            View notifications
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <p className="text-center text-xs text-slate-400">
        Profile photos are stored on the server (max 2 MB, JPG/PNG/WebP/GIF).
      </p>
    </div>
  );
}
