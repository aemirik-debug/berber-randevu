import { useState } from 'react';
import { leadsAPI } from '../api/client';

export default function VideoCard({ post, isActive }) {
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
  };

  const handleWhatsAppClick = async () => {
    try {
      if (post.id) {
        await leadsAPI.trackWhatsApp(post.id);
      }
      // Open WhatsApp
      const whatsappUrl = `https://wa.me/${post.professional?.whatsapp}?text=Merhaba%2C%20postunuz%20hakkında%20soruşturmak%20istiyorum`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Lead tracking failed:', error);
    }
  };

  const handlePhoneView = async () => {
    try {
      if (post.id) {
        await leadsAPI.trackPhoneView(post.id);
      }
      setShowPhone(true);
    } catch (error) {
      console.error('Phone view tracking failed:', error);
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex flex-col">
      {/* Video/Image Background */}
      <div className="absolute inset-0">
        {post.rendered_video_path ? (
          <video
            src={post.rendered_video_path}
            autoPlay={isActive}
            muted
            loop
            className="w-full h-full object-cover"
          />
        ) : post.media?.[0]?.path ? (
          <img
            src={post.media[0].path}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
            <p className="text-white">No media</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-40"></div>
      </div>

      {/* Content Overlay */}
      <div className="relative h-full flex flex-col justify-between p-6 text-white">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
          <p className="text-gray-300 text-sm line-clamp-2">{post.description}</p>
        </div>

        {/* Footer - User & Actions */}
        <div className="flex items-end justify-between">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
            <div>
              <p className="font-semibold">{post.professional?.username}</p>
              <p className="text-xs text-gray-300">{post.category}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-4">
            {/* Like Button */}
            <button
              onClick={handleLike}
              className={`flex flex-col items-center gap-1 transition transform hover:scale-110 ${
                isLiked ? 'text-red-500' : 'text-white'
              }`}
            >
              <span className="text-2xl">{isLiked ? '❤️' : '🤍'}</span>
              <span className="text-xs font-semibold">{likes}</span>
            </button>

            {/* Comment Button */}
            <button className="flex flex-col items-center gap-1 transition transform hover:scale-110 text-white">
              <span className="text-2xl">💬</span>
              <span className="text-xs font-semibold">{post.comments_count || 0}</span>
            </button>

            {/* WhatsApp Button */}
            <button
              onClick={handleWhatsAppClick}
              className="flex flex-col items-center gap-1 transition transform hover:scale-110 text-white hover:text-green-400"
            >
              <span className="text-2xl">💬</span>
              <span className="text-xs font-semibold">İleti</span>
            </button>

            {/* Phone Button */}
            <button
              onClick={handlePhoneView}
              className="flex flex-col items-center gap-1 transition transform hover:scale-110 text-white"
            >
              <span className="text-2xl">📞</span>
              <span className="text-xs font-semibold">
                {showPhone ? 'Gösterildi' : 'Telefon'}
              </span>
            </button>

            {/* Share Button */}
            <button className="flex flex-col items-center gap-1 transition transform hover:scale-110 text-white">
              <span className="text-2xl">↗️</span>
              <span className="text-xs font-semibold">Paylaş</span>
            </button>
          </div>
        </div>
      </div>

      {/* Phone Display Modal */}
      {showPhone && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900">
              {post.professional?.username}
            </h3>
            <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded">
              <span className="text-2xl">☎️</span>
              <p className="text-lg font-semibold text-gray-900">
                {post.professional?.phone || 'Telefon bilgisi yok'}
              </p>
            </div>
            <button
              onClick={() => setShowPhone(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
