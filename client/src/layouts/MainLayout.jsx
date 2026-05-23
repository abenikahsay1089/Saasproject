import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import NotificationListener from '../components/NotificationListener.jsx';

/**
 * Shell: fixed sidebar + top bar + scrollable main (board / dashboard).
 */
export default function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <NotificationListener />
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col pl-60">
        <Navbar />
        <main className="app-shell flex-1 overflow-auto p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
