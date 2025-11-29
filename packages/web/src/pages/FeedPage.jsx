import React, { useState, useEffect } from 'react';

// Mock posts data - will be replaced with API data
const mockPosts = [
  {
    id: '1',
    author: {
      name: 'Sarah Johnson',
      username: '@sarah_fit',
    },
    content: 'Just completed my first marathon! 🏃‍♀️ 26.2 miles in 4:15:32. What an incredible journey!',
    likes: 245,
    comments: 32,
    shares: 12,
    createdAt: '2 hours ago',
    isLiked: false,
  },
  {
    id: '2',
    author: {
      name: 'Mike Chen',
      username: '@mike_lifts',
    },
    content: 'New PR on deadlift today! 💪 Hit 405lbs for the first time. Hard work pays off!',
    likes: 189,
    comments: 45,
    shares: 8,
    createdAt: '5 hours ago',
    isLiked: true,
  },
  {
    id: '3',
    author: {
      name: 'Emma Davis',
      username: '@yoga_emma',
    },
    content: 'Morning yoga session by the beach 🧘‍♀️ There\'s nothing like starting the day with mindfulness and movement.',
    likes: 312,
    comments: 28,
    shares: 15,
    createdAt: '8 hours ago',
    isLiked: false,
  },
  {
    id: '4',
    author: {
      name: 'James Wilson',
      username: '@james_crossfit',
    },
    content: 'WOD complete! Today\'s workout: 21-15-9 Thrusters and Pull-ups. Time: 8:42. Who else is training today?',
    likes: 156,
    comments: 67,
    shares: 5,
    createdAt: '1 day ago',
    isLiked: false,
  },
];

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPost, setNewPost] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setPosts(mockPosts);
      setIsLoading(false);
    }, 500);
  }, []);

  const handleLike = (postId) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1
          }
        : post
    ));
  };

  const handleSubmitPost = (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;
    
    const post = {
      id: Date.now().toString(),
      author: { name: 'You', username: '@me' },
      content: newPost,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: 'Just now',
      isLiked: false,
    };
    
    setPosts([post, ...posts]);
    setNewPost('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Feed</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Create Post */}
        <form onSubmit={handleSubmitPost} className="bg-white rounded-xl shadow-md p-4 mb-6">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-3 bg-gray-50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
            >
              Post
            </button>
          </div>
        </form>

        {/* Posts */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                {/* Author */}
                <div className="p-4 flex items-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {post.author.name.charAt(0)}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="font-semibold text-gray-800">{post.author.name}</p>
                    <p className="text-sm text-gray-500">{post.author.username} • {post.createdAt}</p>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">•••</button>
                </div>

                {/* Content */}
                <div className="px-4 pb-3">
                  <p className="text-gray-800 leading-relaxed">{post.content}</p>
                </div>

                {/* Stats */}
                <div className="px-4 py-2 border-t text-sm text-gray-500 flex gap-4">
                  <span>{post.likes} likes</span>
                  <span>{post.comments} comments</span>
                  <span>{post.shares} shares</span>
                </div>

                {/* Actions */}
                <div className="border-t flex">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition ${
                      post.isLiked ? 'text-red-500' : 'text-gray-600'
                    }`}
                  >
                    <span>{post.isLiked ? '❤️' : '🤍'}</span> Like
                  </button>
                  <button className="flex-1 py-3 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 transition">
                    💬 Comment
                  </button>
                  <button className="flex-1 py-3 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50 transition">
                    🔄 Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
