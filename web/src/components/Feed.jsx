import { useState } from 'react';
import VideoCard from './VideoCard';

export default function Feed({ posts }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (direction) => {
    if (direction === 'up' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (direction === 'down' && currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Handle mouse wheel scrolling
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleScroll('up');
    } else {
      handleScroll('down');
    }
  };

  return (
    <div
      className="relative h-full overflow-hidden"
      onWheel={handleWheel}
      style={{ touchAction: 'pan-x' }}
    >
      {/* Video Container */}
      <div
        className="transition-transform duration-500 ease-out"
        style={{
          transform: `translateY(-${currentIndex * 100}vh)`,
          height: `${posts.length * 100}vh`,
        }}
      >
        {posts.map((post, index) => (
          <div key={post.id} className="w-full h-screen flex items-center justify-center">
            <VideoCard post={post} isActive={index === currentIndex} />
          </div>
        ))}
      </div>

      {/* Navigation Scrollbar */}
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2">
        {posts.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex ? 'bg-white w-8' : 'bg-gray-500 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
