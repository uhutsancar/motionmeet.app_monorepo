import React, { useState, useEffect } from 'react';

// Mock workout data - will be replaced with API data
const mockWorkouts = [
  {
    id: '1',
    title: 'Morning HIIT',
    description: 'High-intensity interval training to start the day',
    duration: '30 min',
    difficulty: 'Hard',
    exercises: 8,
    calories: 350,
  },
  {
    id: '2',
    title: 'Upper Body Strength',
    description: 'Focus on chest, back, and arms',
    duration: '45 min',
    difficulty: 'Medium',
    exercises: 10,
    calories: 280,
  },
  {
    id: '3',
    title: 'Core Workout',
    description: 'Strengthen your core and improve stability',
    duration: '20 min',
    difficulty: 'Easy',
    exercises: 6,
    calories: 150,
  },
  {
    id: '4',
    title: 'Leg Day',
    description: 'Complete lower body workout',
    duration: '50 min',
    difficulty: 'Hard',
    exercises: 12,
    calories: 400,
  },
  {
    id: '5',
    title: 'Yoga Flow',
    description: 'Relaxing yoga session for flexibility',
    duration: '40 min',
    difficulty: 'Easy',
    exercises: 15,
    calories: 120,
  },
];

const getDifficultyColor = (difficulty) => {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'bg-green-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'hard':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setWorkouts(mockWorkouts);
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredWorkouts = filter === 'all' 
    ? workouts 
    : workouts.filter(w => w.difficulty.toLowerCase() === filter);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">My Workouts</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-blue-700 transition">
            + New Workout
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'easy', 'medium', 'hard'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 rounded-full font-medium capitalize transition ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      {/* Workouts Grid */}
      <div className="container mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{workout.title}</h3>
                    <span className={`${getDifficultyColor(workout.difficulty)} text-white text-xs px-2 py-1 rounded-full`}>
                      {workout.difficulty}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{workout.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 border-t pt-4">
                    <span>⏱️ {workout.duration}</span>
                    <span>💪 {workout.exercises} exercises</span>
                    <span>🔥 {workout.calories} cal</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredWorkouts.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏋️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No workouts found</h3>
            <p className="text-gray-600">Create your first workout to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
