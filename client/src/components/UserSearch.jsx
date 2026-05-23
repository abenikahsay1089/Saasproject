import { useState } from 'react';
import { usersApi } from '../services/api.js';
import UserAvatar from './UserAvatar.jsx';
import { people as peopleCopy } from '../content/copy.js';

/**
 * Search any TaskFlow user by display name or @username (not limited to a workspace).
 */
export default function UserSearch({
  compact = false,
  memberIds = [],
  pendingUserIds = [],
  inviteLoading = false,
  currentUserId,
  onViewProfile,
  onInviteUser,
  onMessageUser,
  renderAction,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const memberSet = new Set(memberIds);
  const pendingSet = new Set(pendingUserIds);

  async function runSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setSearchError(peopleCopy.minChars);
      return;
    }
    setSearching(true);
    setSearchError('');
    setHasSearched(true);
    try {
      const data = await usersApi.search(q);
      setResults(data.users || []);
    } catch (err) {
      setResults([]);
      setSearchError(err.data?.error || err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  function defaultAction(user) {
    const isSelf = Number(user.id) === Number(currentUserId);
    const actions = [];

    if (onMessageUser && !isSelf) {
      actions.push(
        <button
          key="message"
          type="button"
          onClick={() => onMessageUser(user.id)}
          className="shrink-0 rounded-md border border-indigo-200 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
        >
          {peopleCopy.message}
        </button>
      );
    }

    if (onInviteUser) {
      if (memberSet.has(user.id)) {
        actions.push(
          <span
            key="on-ws"
            className="shrink-0 text-[10px] font-semibold uppercase text-slate-400"
          >
            {peopleCopy.onWorkspace}
          </span>
        );
      } else if (pendingSet.has(user.id)) {
        actions.push(
          <span
            key="pending"
            className="shrink-0 text-[10px] font-semibold uppercase text-amber-600"
          >
            {peopleCopy.invitePending}
          </span>
        );
      } else if (!isSelf) {
        actions.push(
          <button
            key="invite-invite"
            type="button"
            disabled={inviteLoading}
            onClick={() => onInviteUser(user.id)}
            className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {peopleCopy.invite}
          </button>
        );
      }
    } else if (!isSelf) {
      actions.push(
        <button
          key="profile"
          type="button"
          onClick={() => onViewProfile?.(user.id)}
          className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {peopleCopy.viewProfile}
        </button>
      );
    }

    if (actions.length === 0) return null;
    return <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>;
  }

  const shellClass = compact
    ? 'rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40'
    : '';

  return (
    <div className={shellClass}>
      {!compact && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">{peopleCopy.hint}</p>
        </>
      )}
      <form
        className={compact ? 'mt-3 flex flex-col gap-2 sm:flex-row' : 'mt-4 flex flex-col gap-3 sm:flex-row'}
        onSubmit={runSearch}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder={peopleCopy.placeholder}
          disabled={searching || inviteLoading}
          className={
            compact
              ? 'min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'
              : 'min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm dark:border-slate-700 dark:bg-slate-900'
          }
        />
        <button
          type="submit"
          disabled={searching || inviteLoading}
          className={
            compact
              ? 'shrink-0 rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-600'
              : 'shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50'
          }
        >
          {searching ? peopleCopy.searching : peopleCopy.searchCta}
        </button>
      </form>
      {searchError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{searchError}</p>
      )}
      {hasSearched && !searching && results.length === 0 && !searchError && (
        <p className="mt-4 text-sm text-slate-500">{peopleCopy.empty}</p>
      )}
      {results.length > 0 && (
        <ul
          className={
            compact
              ? 'mt-3 max-h-56 space-y-2 overflow-y-auto'
              : 'mt-6 space-y-2'
          }
        >
          {results.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => onViewProfile?.(user.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
              >
                <UserAvatar user={user} size={compact ? 'sm' : 'md'} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{user.name}</p>
                  <p className="truncate text-sm text-indigo-600 dark:text-indigo-400">
                    @{user.username}
                  </p>
                </div>
              </button>
              {renderAction ? renderAction(user) : defaultAction(user)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
