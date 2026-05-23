/** Product copy — tuned for clarity like Trello / Linear / Notion-style SaaS. */

export const brand = {
  name: 'TaskFlow',
  tagline: 'Plan together. Ship faster.',
  description:
    'Kanban boards, real-time updates, and team invites in one workspace — built for product teams who outgrow spreadsheets.',
};

export const auth = {
  loginTitle: 'Welcome back',
  loginSubtitle: 'Pick up where your team left off.',
  registerTitle: 'Start your workspace',
  registerSubtitle: 'Free to use locally. Set up boards in under a minute.',
  features: [
    {
      title: 'Visual boards',
      body: 'Columns for To Do, In Progress, and Done — the Trello-style flow teams already know.',
    },
    {
      title: 'Live collaboration',
      body: 'See task moves and updates instantly, like Slack notifications for your board.',
    },
    {
      title: 'Built for teams',
      body: 'Invite teammates by email and assign work — similar to Asana, without the clutter.',
    },
  ],
};

export const people = {
  title: 'Find people',
  subtitle: 'Search everyone on TaskFlow by name or @username — no workspace required.',
  hint: 'Each account has one unique username. Results include people who are not on your boards yet.',
  placeholder: 'Search name or @username…',
  searchCta: 'Search',
  searching: 'Searching…',
  empty: 'No users matched. Try another name or username.',
  minChars: 'Enter at least 2 characters.',
  viewProfile: 'View profile',
  invite: 'Invite',
  onWorkspace: 'On workspace',
  invitePending: 'Invite pending',
  message: 'Message',
};

export const dm = {
  title: 'Messages',
  subtitle: 'Private chats with anyone on TaskFlow — even if you do not share a workspace.',
  conversationsTitle: 'Conversations',
  emptyConversations: 'No conversations yet. Search someone on Find people and send a message.',
  selectConversation: 'Select a conversation or start one from Find people.',
  placeholder: 'Write a private message…',
  send: 'Send',
  sending: 'Sending…',
  chatEmpty: 'No messages yet. Say hello.',
  you: 'You',
  opening: 'Opening conversation…',
  messageUser: 'Message privately',
};

export const dashboard = {
  title: 'Workspaces',
  subtitle: 'Every board is a project space. Open one to manage tasks with your team.',
  createPlaceholder: 'e.g. Product launch, Q2 roadmap, Design sprint…',
  createCta: 'Create workspace',
  templates: [
    { title: 'Product roadmap', hint: 'Ship features on a timeline' },
    { title: 'Sprint board', hint: 'Agile delivery for dev teams' },
    { title: 'Marketing launch', hint: 'Campaign tasks in one view' },
  ],
  emptyTitle: 'Your first board is one click away',
  emptyBody:
    'Boards organize work into lists and cards. Create one from scratch or start from a template below.',
};

export const board = {
  subtitle: 'Drag cards between lists. Updates sync live for everyone on this board.',
  invitePlaceholder: 'teammate@company.com',
  inviteCta: 'Invite teammate',
  searchUsersTitle: 'Find people on TaskFlow',
  searchUsersHint:
    'Quick search while inviting. For full directory search, use Find people in the sidebar.',
  searchUsersPlaceholder: 'Name or @username…',
  searchUsersCta: 'Search',
  searchUsersEmpty: 'No users matched. Try another name or username.',
  searchInvite: 'Invite',
  searchOnWorkspace: 'On workspace',
  searchInvitePending: 'Invite pending',
  inviteHint:
    'Owners and admins can invite new members (as members only). Teammates must accept from their Inbox before the board appears on Workspaces.',
  inviteHintMember: 'Only the workspace owner or an admin can invite teammates.',
  makeAdmin: 'Make admin',
  removeAdmin: 'Remove admin',
  transferOwnership: 'Transfer ownership',
  transferOwnershipHint:
    'Enter the email of a current member. They must accept from their Inbox before the transfer completes. You will become an admin after they accept.',
  transferOwnershipEmailPlaceholder: 'new.owner@company.com',
  transferOwnershipConfirm:
    'Are you sure you want to transfer ownership? The recipient must accept from their Inbox. You will become an admin once they accept.',
  transferOwnershipAcceptConfirm:
    'Accept ownership of this workspace? You will become the owner and can manage members and settings.',
  transferOwnershipDeclineConfirm:
    'Decline this ownership transfer? The current owner will stay in charge.',
  transferOwnershipPending: 'Ownership transfer pending',
  transferOwnershipCancel: 'Cancel transfer request',
  transferOwnershipCancelConfirm: 'Cancel the pending ownership transfer?',
  promoteAdminConfirm: 'Grant admin rights? They can invite members but cannot remove people or manage admins.',
  demoteAdminConfirm: 'Remove admin rights? They will remain a regular member.',
  inviteSuccessAdded: 'Invite sent — they must accept from their Inbox.',
  inviteSuccessPending: 'Invite saved — they will accept after registering with that email.',
  inviteAccept: 'Accept',
  inviteDecline: 'Decline',
  inviteInboxHint: 'Workspace invites require your approval before you can access the board.',
  removeMember: 'Remove',
  cancelInvite: 'Cancel invite',
  removeMemberConfirm: 'Remove this person from the workspace? They will lose access to this board.',
  cancelInviteConfirm: 'Cancel this pending invite?',
  inviteErrorOwner: 'Only the workspace owner or an admin can invite teammates.',
  chatTitle: 'Team chat',
  chatSubtitle: 'Group conversation for everyone on this workspace — like a channel for your taskflow.',
  chatPlaceholder: 'Message the team…',
  chatSend: 'Send',
  chatSending: 'Sending…',
  chatEmpty: 'No messages yet. Say hello to your teammates.',
  chatYou: 'You',
  activityTitle: 'Team activity',
  activitySubtitle: 'Recent moves, invites, and comments — your board audit trail.',
  liveBadge: 'Live',
  frozenBadge: 'Frozen',
  frozenBanner:
    'This workspace is frozen. Tasks and invites are read-only until the owner unfreezes it.',
  workspaceSettingsTitle: 'Workspace settings',
  workspaceSettingsHint: 'Only the owner can freeze, unfreeze, or permanently delete this workspace.',
  freezeWorkspace: 'Freeze workspace',
  unfreezeWorkspace: 'Unfreeze workspace',
  deleteWorkspace: 'Delete workspace',
  freezeWorkspaceConfirm:
    'Freeze "{title}"? Nobody can edit tasks or invites until you unfreeze it. You can still view everything.',
  deleteWorkspaceConfirm:
    'Permanently delete "{title}"? All tasks, lists, and members will be removed. This cannot be undone.',
  statusOwnerAdminOnly:
    'Only the workspace owner or an admin can set In progress or Done.',
  moveToProgressColumnDenied:
    'Only the workspace owner or an admin can move cards to In progress or Done.',
};

export const notifications = {
  title: 'Inbox',
  subtitle: 'Tasks, workspace updates, chat, invites, and assignments — all in one place.',
  emptyTitle: 'Inbox zero',
  emptyBody: 'When someone assigns you work, comments on a task, or posts in team chat, it will show up here.',
  markRead: 'Mark as read',
  viewBoard: 'Open workspace',
  viewMessages: 'Open chat',
  markAllRead: 'Mark all read',
};

export const notificationTypeLabels = {
  task_created: 'New task',
  task_assigned: 'Assignment',
  task_updated: 'Update',
  task_moved: 'Moved',
  task_status_changed: 'Status',
  task_completed: 'Completed',
  task_unassigned: 'Unassigned',
  task_deleted: 'Deleted',
  task_comment: 'Comment',
  workspace_chat: 'Team chat',
  dm_message: 'Direct message',
  board_invite: 'Invite',
  invite_accepted: 'Invite accepted',
  invite_declined: 'Invite declined',
  invite_cancelled: 'Invite cancelled',
  board_removed: 'Removed',
  role_changed: 'Role change',
  ownership_transferred: 'Ownership',
  ownership_transfer: 'Ownership offer',
  workspace_frozen: 'Frozen',
  workspace_unfrozen: 'Unfrozen',
  workspace_deleted: 'Deleted',
};
