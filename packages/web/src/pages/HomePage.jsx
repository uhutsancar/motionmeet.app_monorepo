import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        const data = await api.checkHealth();
        setHealthStatus(data);
      } catch (err) {
        setError('Unable to connect to server');
        console.log('Health check failed:', err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHealthStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">MotionMeet</h1>
          <p className="text-xl mb-8 opacity-90">
            Social Media for Athletes
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/register"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Get Started
            </a>
            <a
              href="/login"
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>

      {/* Server Status */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Server Status</h2>
          {isLoading ? (
            <div className="flex items-center text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Checking connection...
            </div>
          ) : error ? (
            <div className="flex items-center text-red-500">
              <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
              {error}
            </div>
          ) : healthStatus ? (
            <div className="flex items-center text-green-600">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              {healthStatus.service} - {healthStatus.status}
            </div>
          ) : null}
        </div>

        {/* Features Grid */}
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">💪</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Custom Workouts</h3>
            <p className="text-gray-600">Create and share your workout routines with the community</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Media Sharing</h3>
            <p className="text-gray-600">Upload images and videos of your fitness progress</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Connect</h3>
            <p className="text-gray-600">Find and follow other athletes in your area</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Messages</h3>
            <p className="text-gray-600">Chat with your fitness community in real-time</p>
          </div>
        </div>
      </div>
    </div>
  );
}
