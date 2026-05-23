import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi, listsApi, tasksApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { createSocket } from '../services/socket.js';
import KanbanColumn from '../components/KanbanColumn.jsx';
import TaskModal from '../components/TaskModal.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import PageHeader from '../components/PageHeader.jsx';
import BoardMembers from '../components/BoardMembers.jsx';
import WorkspaceSettings from '../components/WorkspaceSettings.jsx';
import WorkspaceChat from '../components/WorkspaceChat.jsx';
import { board as boardCopy } from '../content/copy.js';
import { isRestrictedListTitle } from '../utils/taskPermissions.js';

export default function BoardPage() {
  const { boardId } = useParams();
  const id = Number(boardId);
  const qc = useQueryClient();
  const { token, user } = useAuth();
  const [modalTask, setModalTask] = useState(null);
  const [modalListId, setModalListId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeLoadingId, setRemoveLoadingId] = useState(null);
  const [roleLoadingId, setRoleLoadingId] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);

  const { data: boardData } = useQuery({
    queryKey: ['board', id],
    queryFn: () => boardsApi.get(id),
    enabled: Number.isFinite(id),
  });

  const { data: listsData } = useQuery({
    queryKey: ['board-lists', id],
    queryFn: () => listsApi.byBoard(id),
    enabled: Number.isFinite(id),
  });

  const { data: activityData } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => boardsApi.activity(id),
    enabled: Number.isFinite(id),
  });

  const {
    data: membersData,
    isError: membersError,
    error: membersQueryError,
  } = useQuery({
    queryKey: ['members', id],
    queryFn: () => boardsApi.members(id),
    enabled: Number.isFinite(id),
  });

  const lists = listsData?.lists || [];

  const tasksQueries = useQueries({
    queries: lists.map((l) => ({
      queryKey: ['tasks', l.id],
      queryFn: () => tasksApi.byList(l.id).then((r) => r.tasks),
      enabled: Number.isFinite(l.id),
    })),
  });

  const tasksByListId = useMemo(() => {
    const m = {};
    lists.forEach((l, i) => {
      m[l.id] = tasksQueries[i]?.data || [];
    });
    return m;
  }, [lists, tasksQueries]);

  const taskToList = useMemo(() => {
    const map = {};
    lists.forEach((l) => {
      (tasksByListId[l.id] || []).forEach((t) => {
        map[t.id] = l.id;
      });
    });
    return map;
  }, [lists, tasksByListId]);

  useEffect(() => {
    if (!token || !Number.isFinite(id)) return;
    const socket = createSocket(token);
    socket.connect();
    socket.emit('joinBoard', id, () => {});
    const invalidateTasks = () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    };
    socket.on('taskCreated', invalidateTasks);
    socket.on('taskUpdated', invalidateTasks);
    socket.on('taskMoved', invalidateTasks);
    socket.on('tasksReordered', invalidateTasks);
    socket.on('taskDeleted', invalidateTasks);
    socket.on('activityAdded', () => qc.invalidateQueries({ queryKey: ['activity', id] }));
    socket.on('chatMessage', ({ message, boardId: bid }) => {
      if (bid !== id || !message) return;
      qc.setQueryData(['board-chat', id], (old) => {
        const prev = old?.messages ?? [];
        if (prev.some((m) => m.id === message.id)) return old;
        return { messages: [...prev, message] };
      });
    });
    return () => {
      socket.emit('leaveBoard', id);
      socket.disconnect();
    };
  }, [token, id, qc]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const board = boardData?.board;
  const isFrozen = board?.status === 'frozen';
  const isOwner = Number(board?.owner_id) === Number(user?.id);

  const permissions = membersData?.permissions ?? {
    canInvite: Number(board?.owner_id) === Number(user?.id),
    canRemoveMembers: Number(board?.owner_id) === Number(user?.id),
    canManageRoles: Number(board?.owner_id) === Number(user?.id),
    canTransferOwnership: Number(board?.owner_id) === Number(user?.id),
    canCancelInvites: Number(board?.owner_id) === Number(user?.id),
    canManageTaskStatus: Number(board?.owner_id) === Number(user?.id),
  };

  const handleDragEnd = useCallback(
    async (event) => {
      if (isFrozen) return;
      const { active, over } = event;
      if (!over) return;
      const activeId = Number(active.id);
      const sourceListId = taskToList[activeId];
      if (!sourceListId) return;

      let targetListId;
      if (String(over.id).startsWith('col:')) {
        targetListId = Number(String(over.id).split(':')[1]);
      } else {
        targetListId = taskToList[Number(over.id)];
      }
      if (!targetListId) return;

      const targetList = lists.find((l) => l.id === targetListId);
      if (
        sourceListId !== targetListId &&
        targetList &&
        isRestrictedListTitle(targetList.title) &&
        !permissions.canManageTaskStatus
      ) {
        setInviteError(boardCopy.moveToProgressColumnDenied);
        return;
      }

      const sourceOrder = tasksByListId[sourceListId].map((t) => t.id);
      const destOrder = tasksByListId[targetListId].map((t) => t.id);

      try {
        if (sourceListId === targetListId) {
          const oldIndex = sourceOrder.indexOf(activeId);
          const newIndex = sourceOrder.indexOf(Number(over.id));
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
          const next = arrayMove(sourceOrder, oldIndex, newIndex);
          await listsApi.reorder(sourceListId, next);
        } else {
          const newSource = sourceOrder.filter((tid) => tid !== activeId);
          let newDest = [...destOrder];
          const overIsCol = String(over.id).startsWith('col:');
          if (overIsCol) {
            newDest.push(activeId);
          } else {
            const overIndex = newDest.indexOf(Number(over.id));
            if (overIndex === -1) newDest.push(activeId);
            else newDest.splice(overIndex, 0, activeId);
          }
          await Promise.all([
            listsApi.reorder(sourceListId, newSource),
            listsApi.reorder(targetListId, newDest),
          ]);
        }
        await qc.invalidateQueries({ queryKey: ['tasks'] });
      } catch (e) {
        setInviteError(e.data?.error || e.message || 'Could not move task');
        await qc.invalidateQueries({ queryKey: ['tasks'] });
      }
    },
    [isFrozen, taskToList, tasksByListId, lists, permissions.canManageTaskStatus, qc]
  );

  const openTask = useCallback((task) => {
    const lid = taskToList[task.id];
    setModalListId(lid);
    setModalTask(task);
  }, [taskToList]);

  async function sendInvite(payload) {
    setInviteLoading(true);
    setInviteError('');
    setInviteMessage('');
    try {
      const res = await boardsApi.invite(id, payload);
      setInviteMessage(res.message || (res.pending ? boardCopy.inviteSuccessPending : boardCopy.inviteSuccessAdded));
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not send invite');
    } finally {
      setInviteLoading(false);
    }
  }

  async function invite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    await sendInvite({ email: inviteEmail.trim() });
    setInviteEmail('');
  }

  async function inviteUser(userId) {
    await sendInvite({ userId });
  }

  async function handlePromoteAdmin(userId) {
    setRoleLoadingId(userId);
    setInviteError('');
    try {
      await boardsApi.updateMemberRole(id, userId, 'admin');
      setInviteMessage('Member is now an admin.');
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not update role');
    } finally {
      setRoleLoadingId(null);
    }
  }

  async function handleDemoteAdmin(userId) {
    setRoleLoadingId(userId);
    setInviteError('');
    try {
      await boardsApi.updateMemberRole(id, userId, 'member');
      setInviteMessage('Admin rights removed.');
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not update role');
    } finally {
      setRoleLoadingId(null);
    }
  }

  async function handleRequestOwnershipTransfer(email, onSuccess) {
    setTransferLoading(true);
    setInviteError('');
    try {
      const res = await boardsApi.requestOwnershipTransfer(id, email);
      setInviteMessage(res.message || 'Ownership transfer request sent.');
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      onSuccess?.();
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not send transfer request');
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleCancelOwnershipTransfer() {
    setTransferLoading(true);
    setInviteError('');
    try {
      await boardsApi.cancelOwnershipTransfer(id);
      setInviteMessage('Ownership transfer request cancelled.');
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not cancel transfer');
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleRemoveMember(userId) {
    setRemoveLoadingId(userId);
    setInviteError('');
    try {
      await boardsApi.removeMember(id, userId);
      setInviteMessage('Member removed from workspace.');
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not remove member');
    } finally {
      setRemoveLoadingId(null);
    }
  }

  async function handleCancelInvite(inviteId) {
    setRemoveLoadingId(`inv-${inviteId}`);
    setInviteError('');
    try {
      await boardsApi.cancelInvite(id, inviteId);
      setInviteMessage('Pending invite cancelled.');
      qc.invalidateQueries({ queryKey: ['members', id] });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (err) {
      setInviteError(err.data?.error || err.message || 'Could not cancel invite');
    } finally {
      setRemoveLoadingId(null);
    }
  }
  const totalTasks = Object.values(tasksByListId).reduce((n, arr) => n + arr.length, 0);
  const members = membersData?.members ?? [];
  const memberCount = members.length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={board?.title || 'Board'}
        subtitle={boardCopy.subtitle}
        badge={
          isFrozen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
              {boardCopy.frozenBadge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {boardCopy.liveBadge}
            </span>
          )
        }
        actions={
          <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {totalTasks} tasks
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {memberCount} members
            </span>
          </div>
        }
      />
      {isFrozen && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          {boardCopy.frozenBanner}
        </p>
      )}
      {inviteMessage && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {inviteMessage}
        </p>
      )}
      {inviteError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {inviteError}
        </p>
      )}
      {membersError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {membersQueryError?.data?.error || membersQueryError?.message || 'Could not load members.'}
        </p>
      )}

      <BoardMembers
        members={members}
        pendingInvites={membersData?.pendingInvites}
        pendingOwnershipTransfer={membersData?.pendingOwnershipTransfer}
        permissions={permissions}
        inviteEmail={inviteEmail}
        onInviteEmailChange={setInviteEmail}
        onInviteSubmit={invite}
        onInviteUser={permissions.canInvite ? inviteUser : undefined}
        inviteLoading={inviteLoading}
        onRemoveMember={permissions.canRemoveMembers ? handleRemoveMember : undefined}
        onCancelInvite={permissions.canCancelInvites ? handleCancelInvite : undefined}
        onPromoteAdmin={permissions.canManageRoles ? handlePromoteAdmin : undefined}
        onDemoteAdmin={permissions.canManageRoles ? handleDemoteAdmin : undefined}
        onRequestOwnershipTransfer={
          permissions.canTransferOwnership ? handleRequestOwnershipTransfer : undefined
        }
        onCancelOwnershipTransfer={
          permissions.canTransferOwnership ? handleCancelOwnershipTransfer : undefined
        }
        transferLoading={transferLoading}
        removeLoadingId={removeLoadingId}
        roleLoadingId={roleLoadingId}
        readOnly={isFrozen}
        currentUserId={user?.id}
      />

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {lists.map((list) => (
            <KanbanColumn
              key={list.id}
              list={list}
              tasks={tasksByListId[list.id] || []}
              onOpenTask={openTask}
              readOnly={isFrozen}
            />
          ))}
        </div>
      </DndContext>

      <WorkspaceChat boardId={id} currentUserId={user?.id} />

      {isOwner && (
        <WorkspaceSettings
          boardId={id}
          boardTitle={board?.title || 'Workspace'}
          isFrozen={isFrozen}
          isOwner={isOwner}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ['board', id] });
            qc.invalidateQueries({ queryKey: ['boards'] });
          }}
        />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{boardCopy.activityTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{boardCopy.activitySubtitle}</p>
        <div className="mt-4">
          <ActivityFeed activities={activityData?.activities} />
        </div>
      </section>

      {modalTask && modalListId && (
        <TaskModal
          task={modalTask}
          listId={modalListId}
          members={membersData?.members}
          readOnly={isFrozen}
          canManageTaskStatus={permissions.canManageTaskStatus}
          onClose={() => {
            setModalTask(null);
            setModalListId(null);
          }}
        />
      )}
    </div>
  );
}
