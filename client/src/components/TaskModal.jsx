import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsApi, tasksApi } from '../services/api.js';
import { board as boardCopy } from '../content/copy.js';

/**
 * Modal: edit task fields, thread comments, mark complete.
 */
export default function TaskModal({
  task,
  listId,
  members,
  onClose,
  readOnly = false,
  canManageTaskStatus = true,
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status || 'open');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [dueDate, setDueDate] = useState(
    task.due_date ? task.due_date.slice(0, 16) : ''
  );
  const [assignTo, setAssignTo] = useState(task.assigned_to ? String(task.assigned_to) : '');
  const [comment, setComment] = useState('');

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status || 'open');
    setPriority(task.priority || 'medium');
    setDueDate(task.due_date ? task.due_date.slice(0, 16) : '');
    setAssignTo(task.assigned_to ? String(task.assigned_to) : '');
  }, [task]);

  const { data: commentsData } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => commentsApi.list(task.id),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      tasksApi.update(task.id, {
        title,
        description,
        ...(canManageTaskStatus ? { status } : {}),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assignedTo: assignTo ? Number(assignTo) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => commentsApi.add(task.id, comment.trim()),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['comments', task.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={readOnly || !canManageTaskStatus}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="open">Open</option>
                {(canManageTaskStatus || status === 'in_progress') && (
                  <option value="in_progress">In progress</option>
                )}
                {(canManageTaskStatus || status === 'done') && (
                  <option value="done">Done</option>
                )}
              </select>
              {!canManageTaskStatus && !readOnly && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {boardCopy.statusOwnerAdminOnly}
                </p>
              )}
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Due</span>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Assign to</span>
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Unassigned</option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Comments</h3>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
            {(commentsData?.comments || []).map((c) => (
              <li
                key={c.id}
                className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/80"
              >
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  {c.author_name}
                </span>
                <p className="text-slate-700 dark:text-slate-300">{c.body}</p>
                <p className="text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <div className="mt-2 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                disabled={!comment.trim() || commentMutation.isPending}
                onClick={() => commentMutation.mutate()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-900 dark:bg-slate-600"
              >
                Post
              </button>
            </div>
          )}
        </div>
        {!readOnly && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this task?')) deleteMutation.mutate();
              }}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
