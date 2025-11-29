import React, { useState } from 'react';

export default function ProfilePage() {
  // Mock user data - will be replaced with actual API data
  const [user] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    bio: 'Fitness enthusiast | Marathon runner | Personal trainer',
    location: 'New York, USA',
    followers: 1250,
    following: 340,
    workouts: 156,
    joinedDate: 'January 2024',
    avatar: null,
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Profile Header */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center text-white text-5xl font-bold">
              {user.name.charAt(0)}
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-gray-800">{user.name}</h1>
              <p className="text-gray-500 mt-1">{user.email}</p>
              {user.bio && <p className="text-gray-600 mt-3">{user.bio}</p>}
              {user.location && (
                <p className="text-gray-500 mt-2 flex items-center justify-center md:justify-start">
                  <span className="mr-1">📍</span> {user.location}
                </p>
              )}

              {/* Stats */}
              <div className="flex justify-center md:justify-start gap-8 mt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{user.workouts}</p>
                  <p className="text-sm text-gray-500">Workouts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{user.followers}</p>
                  <p className="text-sm text-gray-500">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-800">{user.following}</p>
                  <p className="text-sm text-gray-500">Following</p>
                </div>
              </div>
            </div>

            {/* Edit Button */}
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md">
          <h2 className="text-lg font-semibold text-gray-600 px-6 py-4 border-b">Settings</h2>
          
          <div className="divide-y">
            <button className="w-full px-6 py-4 flex items-center hover:bg-gray-50 transition">
              <span className="text-xl mr-4">🔔</span>
              <span className="flex-1 text-left text-gray-800">Notifications</span>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full px-6 py-4 flex items-center hover:bg-gray-50 transition">
              <span className="text-xl mr-4">🔒</span>
              <span className="flex-1 text-left text-gray-800">Privacy</span>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full px-6 py-4 flex items-center hover:bg-gray-50 transition">
              <span className="text-xl mr-4">🎨</span>
              <span className="flex-1 text-left text-gray-800">Appearance</span>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full px-6 py-4 flex items-center hover:bg-gray-50 transition">
              <span className="text-xl mr-4">❓</span>
              <span className="flex-1 text-left text-gray-800">Help & Support</span>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full px-6 py-4 flex items-center hover:bg-gray-50 transition">
              <span className="text-xl mr-4">ℹ️</span>
              <span className="flex-1 text-left text-gray-800">About</span>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* Logout Button */}
        <button className="w-full mt-6 py-4 border border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-50 transition">
          Logout
        </button>

        <p className="text-center text-gray-400 text-sm mt-6">
          Member since {user.joinedDate}
        </p>
      </div>
    </div>
  );
}
