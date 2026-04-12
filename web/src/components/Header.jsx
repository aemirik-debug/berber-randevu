import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../contexts/AuthContext';

export default function Header({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-blue-600">ReelUsta</h1>
          {user && (
            <p className="text-gray-600">
              Hoşgeldin, <span className="font-semibold">{user.username}</span>
            </p>
          )}
        </div>

        <nav className="flex items-center gap-4">
          {user?.role === 'professional' && (
            <>
              <button
                onClick={() => navigate('/feed')}
                className="text-gray-600 hover:text-blue-600 font-semibold"
              >
                Feed
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 hover:text-blue-600 font-semibold"
              >
                Dashboard
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
          >
            Çıkış Yap
          </button>
        </nav>
      </div>
    </header>
  );
}
