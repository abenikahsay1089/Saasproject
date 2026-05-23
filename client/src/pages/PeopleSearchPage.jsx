import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import UserSearch from '../components/UserSearch.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { people as copy } from '../content/copy.js';

export default function PeopleSearchPage() {
  const [profileUserId, setProfileUserId] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <UserSearch
          currentUserId={user?.id}
          onViewProfile={setProfileUserId}
          onMessageUser={(id) => navigate(`/messages?with=${id}`)}
        />
      </section>

      {profileUserId && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  );
}
