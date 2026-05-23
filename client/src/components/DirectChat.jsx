import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dmApi } from '../services/api.js';
import { dm as dmCopy } from '../content/copy.js';
import UserAvatar from './UserAvatar.jsx';

export default function DirectChat({ conversationId, currentUserId, otherUser }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dm-messages', conversationId],
    queryFn: () => dmApi.messages(conversationId, 150),
    enabled: Number.isFinite(conversationId),
  });

  const messages = data?.messages ?? [];
  const peer = otherUser || data?.conversation?.other_user;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationId]);

  const sendMutation = useMutation({
    mutationFn: (body) => dmApi.send(conversationId, body),
    onSuccess: (res) => {
      setDraft('');
      qc.setQueryData(['dm-messages', conversationId], (old) => {
        const prev = old?.messages ?? [];
        if (prev.some((m) => m.id === res.message.id)) return old;
        return {
          ...old,
          conversation: res.conversation || old?.conversation,
          messages: [...prev, res.message],
        };
      });
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
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

  if (!Number.isFinite(conversationId)) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <p className="max-w-sm text-center text-sm text-slate-500 dark:text-slate-400">
          {dmCopy.selectConversation}
        </p>
      </div>
    );
  }

  return (
    <section className="flex min-h-[28rem] flex-1 flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {peer && (
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <UserAvatar user={peer} size="sm" />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{peer.name}</h2>
            {peer.username && (
              <p className="text-sm text-indigo-600 dark:text-indigo-400">@{peer.username}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {isLoading && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">{dmCopy.chatEmpty}</p>
        )}
        {messages.map((msg) => {
          const isSelf = Number(msg.user_id) === Number(currentUserId);
          const author = msg.author || { id: msg.user_id, name: 'Unknown' };
          return (
            <div key={msg.id} className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}>
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
                  {isSelf ? dmCopy.you : author.name}
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
          placeholder={dmCopy.placeholder}
          rows={2}
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMutation.isPending}
          className="self-end rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {sendMutation.isPending ? dmCopy.sending : dmCopy.send}
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
