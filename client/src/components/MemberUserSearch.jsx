import UserSearch from './UserSearch.jsx';
import { board as boardCopy } from '../content/copy.js';

/** Workspace-scoped search with invite actions (also uses global user directory). */
export default function MemberUserSearch({
  members = [],
  pendingInvites = [],
  inviteLoading,
  onInviteUser,
  onViewProfile,
  onMessageUser,
  currentUserId,
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
        {boardCopy.searchUsersTitle}
      </p>
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{boardCopy.searchUsersHint}</p>
      <UserSearch
        compact
        memberIds={members.map((m) => m.id)}
        pendingUserIds={pendingInvites.map((p) => p.user_id).filter(Boolean)}
        inviteLoading={inviteLoading}
        onInviteUser={onInviteUser}
        onViewProfile={onViewProfile}
        onMessageUser={onMessageUser}
        currentUserId={currentUserId}
      />
    </div>
  );
}
