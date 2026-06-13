# TaskFlow — SaaS task management (Trello-style)

Production-oriented full-stack demo: **React + Vite + Tailwind**, **Express + PostgreSQL**, **JWT auth**, **Socket.io** real-time board updates, **Kanban** with **@dnd-kit**, notifications, comments, team chat, private messages, and an activity timeline.

**Repository:** [github.com/abenikahsay1089/Saasproject](https://github.com/abenikahsay1089/Saasproject)

## Features

- Register / login with bcrypt-hashed passwords and JWT sessions
- Workspaces with default lists (To Do, In Progress, Done); invite members by email or username
- Roles: owner, admin, member — with ownership transfer and workspace freeze/delete
- Tasks with assignee, priority, status, due date, description; status syncs with kanban columns
- Drag-and-drop between columns with order persisted via `POST /api/lists/:listId/reorder`
- Real-time board updates and personal inbox notifications
- Team chat per workspace and private DMs between any users
- Global people search by name or @username
- Task comments, activity log, and dark mode

## Architecture

| Layer        | Role |
| ------------ | ---- |
| `client/`    | SPA: React Router, TanStack Query, Socket.io client, @dnd-kit |
| `server/`    | REST API, auth middleware, validation, rate limiting, Socket.io namespaces/rooms |
| `database/`  | `schema.sql` for PostgreSQL |

See [docs/architecture.md](docs/architecture.md) for folder-by-folder notes and the event map.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local, Docker, Supabase, or managed Postgres)

## Installation

1. **Database**

   ```bash
   psql "$DATABASE_URL" -f database/schema.sql
   ```

2. **API server**

   ```bash
   cd server
   cp .env.example .env
   # Edit .env — set DATABASE_URL, JWT_SECRET, CLIENT_URL
   npm install
   npm run dev
   ```

3. **Client**

   ```bash
   cd client
   cp .env.example .env
   npm install
   npm run dev
   ```

   With the default Vite proxy, leave `VITE_API_URL` empty and open [http://localhost:5173](http://localhost:5173).

## Environment variables

### Server (`server/.env`)

| Variable       | Example                         | Purpose                          |
| -------------- | ------------------------------- | -------------------------------- |
| `PORT`         | `4000`                          | HTTP + Socket.io port            |
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Postgres connection string       |
| `JWT_SECRET`   | long random string              | Signs access tokens              |
| `JWT_EXPIRES_IN` | `7d`                          | Token lifetime                   |
| `CLIENT_URL`   | `http://localhost:5173`         | CORS + Socket.io origin          |
| `NODE_ENV`     | `development` / `production`    | Logging / error detail           |

### Client (`client/.env`)

| Variable            | Example                    | Purpose                                |
| ------------------- | -------------------------- | -------------------------------------- |
| `VITE_API_URL`      | empty (dev) or API URL     | JSON API base; empty uses Vite proxy   |
| `VITE_SOCKET_URL`   | `http://localhost:4000`    | Socket.io server origin in development |

## API summary

Base path: `/api`

| Method & path | Description |
| ------------- | ----------- |
| `POST /auth/register` | Create user, returns `{ user, token }` |
| `POST /auth/login` | Login |
| `GET /auth/me` | Current user (Bearer token) |
| `GET /boards` | Boards you own or are a member of |
| `POST /boards` | Create board (+ default lists) |
| `GET /boards/:id` | Board metadata |
| `PUT /boards/:id` | Update title (owner) |
| `DELETE /boards/:id` | Delete board (owner) |
| `GET /boards/:boardId/activity` | Activity feed |
| `GET /boards/:boardId/members` | Members |
| `POST /boards/:boardId/members` | Invite by `{ email, role? }` |
| `GET /lists/:boardId` | Lists on board |
| `POST /lists` | Create list `{ boardId, title, position? }` |
| `PUT /lists/:id` | Update list |
| `DELETE /lists/:id` | Delete list |
| `POST /lists/:listId/reorder` | `{ taskIds: number[] }` — persist order / same-board moves |
| `GET /tasks/:listId` | Tasks in list |
| `POST /tasks` | Create task |
| `PUT /tasks/:id` | Update task (camelCase body: `listId`, `assignedTo`, `dueDate`, …) |
| `DELETE /tasks/:id` | Delete task |
| `GET /notifications` | Your notifications |
| `PUT /notifications/:id/read` | Mark read |
| `GET /comments/:taskId` | Comments |
| `POST /comments/:taskId` | `{ body }` — add comment |

## Socket.io

- Connect with `auth: { token: '<JWT>' }`.
- Emit `joinBoard` with `boardId` (server verifies membership).
- Board room receives: `taskCreated`, `taskUpdated`, `taskMoved`, `tasksReordered`, `taskDeleted`, `activityAdded`.
- User room `user:<id>` receives `notification` payloads when rows are inserted server-side.

## Deployment (typical)

| Piece    | Suggested host | Notes |
| -------- | -------------- | ----- |
| Frontend | [Vercel](https://vercel.com) | Build `client/` with `VITE_API_URL` + `VITE_SOCKET_URL` pointing to your API (same host as API is easiest for cookies-free JWT + sockets if you proxy `/socket.io`). |
| Backend  | [Render](https://render.com) | Web service; set env vars; use same `CLIENT_URL` as Vercel domain. |
| Database | [Supabase](https://supabase.com) Postgres | Run `schema.sql` in SQL editor; put connection string in `DATABASE_URL`. |

Ensure production `CLIENT_URL` matches your deployed SPA origin exactly (scheme + host) for CORS and Socket.io.

## UI wireframe

A simple board-layout wireframe (sidebar, navbar, Kanban columns, cards) is in [docs/board-wireframe.png](docs/board-wireframe.png). Map it to React as described in [docs/architecture.md](docs/architecture.md).

Add your own runtime screenshots under `docs/screenshots/` for your portfolio if you like.

## Scripts

| Location | Command | Purpose |
| -------- | ------- | ------- |
| `server` | `npm run dev` | API + sockets with `--watch` (Node 18+) |
| `server` | `npm start` | Production start |
| `client` | `npm run dev` | Vite dev server |
| `client` | `npm run build` | Static production build |

## License

MIT — suitable for learning and portfolio use. Replace branding and secrets before any public production deployment.
