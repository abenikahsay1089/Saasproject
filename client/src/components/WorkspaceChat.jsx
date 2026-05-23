import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi } from '../services/api.js';
import { board as boardCopy } from '../content/copy.js';
import UserAvatar from './UserAvatar.jsx';

export default function WorkspaceChat({ boardId, currentUserId }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['board-chat', boardId],
    queryFn: () => boardsApi.messages(boardId, 150),
    enabled: Number.isFinite(boardId),
  });

  const messages = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (body) => boardsApi.sendMessage(boardId, body),
    onSuccess: (res) => {
      setDraft('');
      qc.setQueryData(['board-chat', boardId], (old) => {
        const prev = old?.messages ?? [];
        if (prev.some((m) => m.id === res.message.id)) return old;
        return { messages: [...prev, res.message] };
      });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{boardCopy.chatTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{boardCopy.chatSubtitle}</p>
      </div>

      <div
        ref={listRef}
        className="flex max-h-80 flex-col gap-3 overflow-y-auto px-5 py-4"
        aria-live="polite"
      >
        {isLoading && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">{boardCopy.chatEmpty}</p>
        )}
        {messages.map((msg) => {
          const isSelf = Number(msg.user_id) === Number(currentUserId);
          const author = msg.author || {
            id: msg.user_id,
            name: 'Unknown',
            username: null,
            avatar_url: null,
          };
          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}
            >
              <UserAvatar user={author} size="sm" className="mt-0.5" />
              <div
                className={`max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-sm ${
                  isSelf
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                <p
                  className={`text-xs font-semibold ${
                    isSelf ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isSelf ? boardCopy.chatYou : author.name}
                  {author.username && (
                    <span className="font-normal opacity-80"> @{author.username}</span>
                  )}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{msg.body}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    isSelf ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={boardCopy.chatPlaceholder}
          rows={2}
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="self-end rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {sendMutation.isPending ? boardCopy.chatSending : boardCopy.chatSend}
        </button>
      </form>
      {sendMutation.isError && (
        <p className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">
          {sendMutation.error?.data?.error || sendMutation.error?.message || 'Could not send message'}
        </p>
      )}
    </section>
  );
}
