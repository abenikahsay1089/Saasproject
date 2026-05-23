import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout, { AuthFooterLink } from '../components/AuthLayout.jsx';
import { auth } from '../content/copy.js';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';

export default function RegisterPage() {
  const { register, token } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await register(name, username, email, password);
    } catch (err) {
      setError(err.data?.error || err.message || 'Registration failed. Try a different email.');
    }
  }

  return (
    <AuthLayout
      title={auth.registerTitle}
      subtitle={auth.registerSubtitle}
      footer={<AuthFooterLink text="Already have an account?" linkText="Sign in" to="/login" />}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Full name
          <input
            required
            autoComplete="name"
            placeholder="Alex Morgan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Username
          <input
            required
            autoComplete="username"
            placeholder="alex_morgan"
            pattern="[a-zA-Z0-9_]{3,30}"
            title="3–30 characters: letters, numbers, underscore"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Work email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
        >
          Create my workspace
        </button>
        <p className="text-center text-xs text-slate-400">
          By creating an account you agree to use TaskFlow responsibly on your own infrastructure.
        </p>
      </form>
    </AuthLayout>
  );
}
