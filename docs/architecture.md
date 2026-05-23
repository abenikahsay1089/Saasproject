# Architecture & folder map

## Top-level layout

```
saas/
├── client/          # React (Vite) SPA
├── server/          # Express API + Socket.io
├── database/        # SQL migrations / schema
└── docs/            # Deep-dive documentation
```

## `client/src`

| Path | Purpose |
| ---- | ------- |
| `components/` | Reusable UI: `Sidebar`, `Navbar`, `BoardCard`, `TaskCard`, `KanbanColumn`, `TaskModal`, `CreateTaskForm`, `ActivityFeed` |
| `pages/` | Route-level views: auth, dashboard, board (Kanban + activity + invite), notifications, profile |
| `layouts/` | `MainLayout` wraps authenticated pages (sidebar + navbar + `<Outlet />`) |
| `context/` | `AuthContext` (JWT user session), `ThemeContext` (dark mode class on `<html>`) |
| `services/` | `api.js` (fetch wrapper), `socket.js` (Socket.io factory) |
| `hooks/` | (Reserved) e.g. shared data hooks — socket join logic currently lives on `BoardPage` |
| `utils/` | (Reserved) shared helpers |
| `App.jsx` | React Router route tree + protected route gate |
| `main.jsx` | React Query + providers bootstrap |

### Component ↔ UI mapping (wireframe)

- **Sidebar** → left navigation (Boards, Notifications, Profile).
- **Navbar** → top bar (signed-in user, sign out).
- **DashboardPage** + **BoardCard** → grid of boards.
- **BoardPage** + **KanbanColumn** + **TaskCard** → columns and draggable cards.
- **TaskModal** → card detail, edit fields, comments.
- **ActivityFeed** → timeline under the board.

## `server/`

| Path | Purpose |
| ---- | ------- |
| `server.js` | HTTP server, Express app, Helmet/CORS/rate limit, attaches `io` via `app.set('io', io)` |
| `config/` | `env.js` (typed env access), `database.js` (`pg` pool) |
| `routes/index.js` | Mounts REST routes under `/api` |
| `controllers/` | Request handlers: validation → DB → optional Socket emit / notifications |
| `middleware/` | `auth.js` (JWT), `errorHandler.js` |
| `services/` | Cross-cutting helpers (e.g. `notificationService`) |
| `sockets/boardSocket.js` | JWT handshake, `user:<id>` + `board:<id>` rooms, `emitToBoard` helper |
| `utils/` | JWT signing, board access checks, activity insert helper |

## `database/schema.sql`

Defines `users`, `boards`, `lists`, `tasks`, `teams`, `notifications`, `activity_logs`, `task_comments` plus indexes and `updated_at` trigger on `tasks`.

## Real-time event flow

1. Client authenticates Socket.io with the same JWT as REST.
2. On entering a board, client emits `joinBoard` with `boardId`; server verifies membership and joins `board:<boardId>`.
3. When REST handlers change tasks or reorder lists, they call `emitToBoard(io, boardId, event, payload)`.
4. Notifications use `io.to('user:<assigneeId>').emit('notification', row)` after inserting into `notifications`.

This keeps HTTP as the source of truth for writes while WebSockets push invalidation hints to other tabs/users.
