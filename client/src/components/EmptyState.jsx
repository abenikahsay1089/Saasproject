/**
 * Empty state pattern used on dashboards and list pages (Stripe/Linear style).
 */
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-8 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      {icon && <div className="mb-4 text-4xl" aria-hidden>{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
