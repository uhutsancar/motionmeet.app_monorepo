import React, { useState, useEffect } from 'react';

// Mock conversations data
const mockConversations = [
  {
    id: '1',
    user: {
      name: 'Sarah Johnson',
      online: true,
    },
    lastMessage: 'Hey! Want to join our workout group tomorrow?',
    timestamp: '2 min ago',
    unread: 2,
  },
  {
    id: '2',
    user: {
      name: 'Mike Chen',
      online: false,
    },
    lastMessage: 'Great job on your PR! 🎉',
    timestamp: '1 hour ago',
    unread: 0,
  },
  {
    id: '3',
    user: {
      name: 'Emma Davis',
      online: true,
    },
    lastMessage: 'Thanks for the yoga tips!',
    timestamp: '3 hours ago',
    unread: 0,
  },
  {
    id: '4',
    user: {
      name: 'James Wilson',
      online: false,
    },
    lastMessage: 'See you at the CrossFit box!',
    timestamp: '1 day ago',
    unread: 0,
  },
  {
    id: '5',
    user: {
      name: 'Fitness Group Chat',
      isGroup: true,
    },
    lastMessage: 'Alex: Who\'s up for a run this weekend?',
    timestamp: '2 days ago',
    unread: 5,
  },
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      setConversations(mockConversations);
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredConversations = conversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="flex h-[calc(100vh-8rem)]">
            {/* Conversations List */}
            <div className="w-full md:w-1/3 border-r">
              {/* Header */}
              <div className="p-4 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h1 className="text-xl font-bold text-gray-800">Messages</h1>
                  <button className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition">
                    ✏️
                  </button>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full px-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Online Users */}
              <div className="p-4 border-b">
                <p className="text-sm text-gray-600 mb-3">Online Now</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {conversations.filter(c => c.user.online).map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className="flex flex-col items-center"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold border-2 border-green-500">
                          {conv.user.name.charAt(0)}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      <span className="text-xs text-gray-600 mt-1 max-w-[60px] truncate">
                        {conv.user.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conversations */}
              <div className="overflow-y-auto h-[calc(100%-200px)]">
                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  filteredConversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full p-4 flex items-center hover:bg-gray-50 transition border-b ${
                        conv.unread > 0 ? 'bg-blue-50' : ''
                      } ${selectedConversation?.id === conv.id ? 'bg-gray-100' : ''}`}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                          {conv.user.name.charAt(0)}
                        </div>
                        {conv.user.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div className="ml-3 flex-1 text-left">
                        <div className="flex justify-between items-center">
                          <span className={`font-semibold ${conv.unread > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                            {conv.user.name}
                          </span>
                          <span className="text-xs text-gray-400">{conv.timestamp}</span>
                        </div>
                        <p className={`text-sm truncate ${conv.unread > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                          {conv.lastMessage}
                        </p>
                      </div>
                      {conv.unread > 0 && (
                        <span className="ml-2 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="hidden md:flex flex-1 flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b flex items-center">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                        {selectedConversation.user.name.charAt(0)}
                      </div>
                      {selectedConversation.user.online && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="font-semibold text-gray-800">{selectedConversation.user.name}</p>
                      <p className="text-sm text-gray-500">
                        {selectedConversation.user.online ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <p className="text-center text-gray-400 text-sm">
                      Start a conversation with {selectedConversation.user.name}
                    </p>
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition">
                        ➤
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-5xl mb-4">💬</div>
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
