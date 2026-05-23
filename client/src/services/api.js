const BASE = import.meta.env.VITE_API_URL ?? '';

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

/**
 * Authenticated JSON fetch to `/api/*`. Attaches Bearer token from localStorage.
 */
export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const boardsApi = {
  list: () => api('/boards'),
  get: (id) => api(`/boards/${id}`),
  create: (title) => api('/boards', { method: 'POST', body: JSON.stringify({ title }) }),
  update: (id, title) => api(`/boards/${id}`, { method: 'PUT', body: JSON.stringify({ title }) }),
  remove: (id) => api(`/boards/${id}`, { method: 'DELETE' }),
  freeze: (id) => api(`/boards/${id}/freeze`, { method: 'POST' }),
  unfreeze: (id) => api(`/boards/${id}/unfreeze`, { method: 'POST' }),
  activity: (boardId) => api(`/boards/${boardId}/activity`),
  members: (boardId) => api(`/boards/${boardId}/members`),
  invite: (boardId, payload) =>
    api(`/boards/${boardId}/members`, {
      method: 'POST',
      body: JSON.stringify(
        typeof payload === 'string' ? { email: payload } : payload
      ),
    }),
  updateMemberRole: (boardId, userId, role) =>
    api(`/boards/${boardId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  requestOwnershipTransfer: (boardId, email) =>
    api(`/boards/${boardId}/ownership-transfer`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  cancelOwnershipTransfer: (boardId) =>
    api(`/boards/${boardId}/ownership-transfer`, { method: 'DELETE' }),
  removeMember: (boardId, userId) =>
    api(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),
  cancelInvite: (boardId, inviteId) =>
    api(`/boards/${boardId}/invites/${inviteId}`, { method: 'DELETE' }),
  messages: (boardId, limit) =>
    api(`/boards/${boardId}/messages${limit ? `?limit=${limit}` : ''}`),
  sendMessage: (boardId, body) =>
    api(`/boards/${boardId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
};

export const listsApi = {
  byBoard: (boardId) => api(`/lists/${boardId}`),
  create: (boardId, title) =>
    api('/lists', { method: 'POST', body: JSON.stringify({ boardId, title }) }),
  reorder: (listId, taskIds) =>
    api(`/lists/${listId}/reorder`, { method: 'POST', body: JSON.stringify({ taskIds }) }),
};

export const tasksApi = {
  byList: (listId) => api(`/tasks/${listId}`),
  create: (body) => api('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => api(`/tasks/${id}`, { method: 'DELETE' }),
};

export const commentsApi = {
  list: (taskId) => api(`/comments/${taskId}`),
  add: (taskId, body) =>
    api(`/comments/${taskId}`, { method: 'POST', body: JSON.stringify({ body }) }),
};

export const notificationsApi = {
  list: () => api('/notifications'),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'PUT' }),
};

export const invitesApi = {
  pending: () => api('/invites/pending'),
  accept: (id) => api(`/invites/${id}/accept`, { method: 'POST' }),
  decline: (id) => api(`/invites/${id}/decline`, { method: 'POST' }),
};

export const ownershipTransfersApi = {
  pending: () => api('/ownership-transfers/pending'),
  accept: (id) => api(`/ownership-transfers/${id}/accept`, { method: 'POST' }),
  decline: (id) => api(`/ownership-transfers/${id}/decline`, { method: 'POST' }),
};

export const usersApi = {
  search: (q) => api(`/users/search?q=${encodeURIComponent(q)}`),
  getProfile: (userId) => api(`/users/${userId}/profile`),
};

export const dmApi = {
  conversations: () => api('/dm/conversations'),
  open: (userId) => api('/dm/conversations', { method: 'POST', body: JSON.stringify({ userId }) }),
  messages: (conversationId, limit) =>
    api(`/dm/conversations/${conversationId}/messages${limit ? `?limit=${limit}` : ''}`),
  send: (conversationId, body) =>
    api(`/dm/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};

export const authApi = {
  register: (name, username, email, password) =>
    api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password }),
    }),
  login: (email, password) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => api('/auth/me'),
  updateProfile: (body) =>
    api('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  deleteAvatar: () => api('/auth/avatar', { method: 'DELETE' }),
};

export async function uploadAvatarFile(file) {
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch(`${BASE}/api/auth/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Upload failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
