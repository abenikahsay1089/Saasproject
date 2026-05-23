/**
 * Consistent page title block used across app routes (Notion/Linear-style headers).
 */
export default function PageHeader({ title, subtitle, badge, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800/80">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
