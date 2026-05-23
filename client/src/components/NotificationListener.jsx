import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import { createSocket } from '../services/socket.js';

/**
 * Subscribes to personal notification events and refreshes Inbox + profile stats.
 */
export default function NotificationListener() {
  const { token, user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!token || !user) return undefined;
    const socket = createSocket(token);
    socket.connect();

    const onNotification = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['pending-invites'] });
      qc.invalidateQueries({ queryKey: ['pending-ownership-transfers'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    };

    const onDmMessage = ({ message, conversationId }) => {
      if (!message || !conversationId) return;
      qc.setQueryData(['dm-messages', conversationId], (old) => {
        const prev = old?.messages ?? [];
        if (prev.some((m) => m.id === message.id)) return old;
        return {
          ...old,
          messages: [...prev, message],
        };
      });
      qc.invalidateQueries({ queryKey: ['dm-conversations'] });
    };

    socket.on('notification', onNotification);
    socket.on('dmMessage', onDmMessage);
    return () => {
      socket.off('notification', onNotification);
      socket.off('dmMessage', onDmMessage);
      socket.disconnect();
    };
  }, [token, user, qc]);

  return null;
}
