import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dmApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import DirectChat from '../components/DirectChat.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import UserSearch from '../components/UserSearch.jsx';
import { dm as dmCopy } from '../content/copy.js';

export default function MessagesPage() {
  const { conversationId: conversationIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const withParam = searchParams.get('with');
  const withUserId =
    withParam != null && withParam !== '' && Number.isFinite(Number(withParam))
      ? Number(withParam)
      : null;
  const activeConversationId = conversationIdParam ? Number(conversationIdParam) : null;
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');

  const { data: conversationsData, isLoading: listLoading } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => dmApi.conversations(),
  });

  const conversations = conversationsData?.conversations ?? [];

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  useEffect(() => {
    if (!withUserId || withUserId === Number(user?.id)) {
      setOpenError('');
      return undefined;
    }
    let cancelled = false;
    setOpening(true);
    setOpenError('');
    dmApi
      .open(withUserId)
      .then((res) => {
        if (cancelled) return;
        navigate(`/messages/${res.conversation.id}`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setOpenError(err.data?.error || err.message || 'Could not open conversation');
      })
      .finally(() => {
        if (!cancelled) setOpening(false);
      });
    return () => {
      cancelled = true;
    };
  }, [withUserId, user?.id, navigate]);

  function openWithUser(userId) {
    navigate(`/messages?with=${userId}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={dmCopy.title} subtitle={dmCopy.subtitle} />

      {opening && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {dmCopy.opening}
        </p>
      )}
      {openError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {openError}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-72">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {dmCopy.conversationsTitle}
            </h2>
          </div>
          <ul className="max-h-80 overflow-y-auto lg:max-h-[28rem]">
            {listLoading && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Loading…</li>
            )}
            {!listLoading && conversations.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {dmCopy.emptyConversations}
              </li>
            )}
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${c.id}`)}
                    className={[
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    <UserAvatar user={c.other_user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {c.other_user?.name}
                      </p>
                      {c.last_message ? (
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {Number(c.last_message.user_id) === Number(user?.id) ? 'You: ' : ''}
                          {c.last_message.body}
                        </p>
                      ) : (
                        <p className="text-xs italic text-slate-400">New conversation</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <DirectChat
          conversationId={activeConversationId}
          currentUserId={user?.id}
          otherUser={activeConversation?.other_user}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <UserSearch
          compact
          currentUserId={user?.id}
          onViewProfile={(id) => openWithUser(id)}
          onMessageUser={openWithUser}
        />
      </section>
    </div>
  );
}
