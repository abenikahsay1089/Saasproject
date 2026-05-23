import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../services/api.js';

/**
 * Inline form to create a task in the given list; invalidates task queries for that list.
 */
export default function CreateTaskForm({ listId }) {
  const [title, setTitle] = useState('');
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => tasksApi.create({ listId, title: title.trim() }),
    onSuccess: () => {
      setTitle('');
      qc.invalidateQueries({ queryKey: ['tasks', listId] });
    },
  });

  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        mutation.mutate();
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a card…"
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
      />
      <button
        type="submit"
        disabled={mutation.isPending || !title.trim()}
        className="rounded-lg bg-indigo-600 px-2 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
