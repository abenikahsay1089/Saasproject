import { activityActionLabels } from '../content/copy.js';

/**
 * Renders recent board activity from the API (create/move/comment events).
 */
export default function ActivityFeed({ activities }) {
  if (!activities?.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No team activity yet. Create tasks, move cards, or invite someone to see updates here.
      </p>
    );
  }
  return (
    <ul className="space-y-3 text-sm">
      {activities.map((a) => {
        const label = activityActionLabels[a.action] || a.action.replace(/_/g, ' ');
        const detail = a.details?.title || a.details?.boardTitle || a.details?.snippet;
        return (
          <li
            key={a.id}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-slate-800 dark:text-slate-200">
              <span className="font-medium">{a.user_name || 'Someone'}</span>{' '}
              <span className="text-slate-600 dark:text-slate-400">{label}</span>
              {detail && (
                <span className="text-slate-500 dark:text-slate-400"> — {detail}</span>
              )}
            </p>
            <p className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</p>
          </li>
        );
      })}
    </ul>
  );
}
