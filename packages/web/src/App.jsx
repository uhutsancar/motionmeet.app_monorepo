import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import {
  HomePage,
  LoginPage,
  RegisterPage,
  ProfilePage,
  WorkoutsPage,
  FeedPage,
  MessagesPage,
} from './pages';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes (no layout) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Main Routes (with layout) */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/workouts" element={<Layout><WorkoutsPage /></Layout>} />
        <Route path="/feed" element={<Layout><FeedPage /></Layout>} />
        <Route path="/messages" element={<Layout><MessagesPage /></Layout>} />
        <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;

