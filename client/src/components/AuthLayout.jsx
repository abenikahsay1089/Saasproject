import { Link } from 'react-router-dom';
import { auth, brand } from '../content/copy.js';

/**
 * Split auth layout: marketing panel (left) + form (right), common on modern SaaS sign-in pages.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-800 p-10 text-white lg:flex">
        <div>
          <p className="text-xl font-bold tracking-tight">{brand.name}</p>
          <p className="mt-1 text-sm text-indigo-100">{brand.tagline}</p>
        </div>
        <div className="space-y-6">
          {auth.features.map((f) => (
            <div key={f.title}>
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-indigo-100">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-indigo-200">{brand.description}</p>
      </div>
      <div className="flex w-full flex-col justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950 lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-6 text-center text-lg font-bold text-indigo-600 lg:hidden dark:text-indigo-400">
            {brand.name}
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthFooterLink({ text, linkText, to }) {
  return (
    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
      {text}{' '}
      <Link to={to} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
        {linkText}
      </Link>
    </p>
  );
}
