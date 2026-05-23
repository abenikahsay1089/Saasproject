import { pool } from '../config/database.js';

const MEMBER_COLS_FULL =
  'u.id, u.name, u.username, u.email, u.avatar_url, u.bio';
const MEMBER_COLS_LEGACY = 'u.id, u.name, u.email, u.avatar_url, u.bio';

function roleRank(role) {
  if (role === 'owner') return 0;
  if (role === 'admin') return 1;
  return 2;
}

function sortMembers(rows) {
  return [...rows].sort((a, b) => {
    const r = roleRank(a.role) - roleRank(b.role);
    if (r !== 0) return r;
    return (a.name || '').localeCompare(b.name || '');
  });
}

/** Loads workspace members (owner + team), deduped with owner role winning. */
export async function loadBoardMembers(boardId) {
  let teamRows = [];
  let ownerRow = null;

  const runQueries = async (cols) => {
    const team = await pool.query(
      `SELECT ${cols}, t.role
       FROM teams t
       JOIN users u ON u.id = t.user_id
       WHERE t.board_id = $1`,
      [boardId]
    );
    const owner = await pool.query(
      `SELECT ${cols}, 'owner' AS role
       FROM boards b
       JOIN users u ON u.id = b.owner_id
       WHERE b.id = $1`,
      [boardId]
    );
    return { team: team.rows, owner: owner.rows[0] || null };
  };

  try {
    const result = await runQueries(MEMBER_COLS_FULL);
    teamRows = result.team;
    ownerRow = result.owner;
  } catch (e) {
    if (e.code !== '42703') throw e;
    const result = await runQueries(MEMBER_COLS_LEGACY);
    teamRows = result.team.map((r) => ({ ...r, username: r.email?.split('@')[0] || 'user' }));
    ownerRow = result.owner
      ? { ...result.owner, username: result.owner.email?.split('@')[0] || 'user' }
      : null;
  }

  const byId = new Map();
  if (ownerRow) byId.set(ownerRow.id, ownerRow);
  for (const m of teamRows) {
    if (byId.get(m.id)?.role === 'owner') continue;
    byId.set(m.id, m);
  }
  return sortMembers([...byId.values()]);
}
