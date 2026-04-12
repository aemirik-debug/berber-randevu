import { useState, useEffect } from 'react';
import { useAuthStore } from '../contexts/AuthContext';
import { postsAPI } from '../api/client';
import Header from '../components/Header';
import Feed from '../components/Feed';

export default function FeedPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ category: 'all', location: 'nearby' });

  useEffect(() => {
    loadFeed();
  }, [filters]);

  const loadFeed = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await postsAPI.list(filters);
      setPosts(response.data.data || response.data);
    } catch (err) {
      setError('Feed yükleme başarısız oldu');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div>Yetkilendirilmemiş</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      <Header user={user} />
      
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Feed yükleniyor...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={loadFeed}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && posts.length > 0 && (
          <Feed posts={posts} />
        )}

        {!isLoading && !error && posts.length === 0 && (
          <div className="flex items-center justify-center h-full text-white text-center">
            <p>Henüz post yoktur</p>
          </div>
        )}
      </div>
    </div>
  );
}
