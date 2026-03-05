import React, { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Route, Routes, useLocation, Navigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import toast, { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { fetchUser } from "./features/user/userSlice";
import { fetchConnections } from "./features/connections/connectionsSlice";
import { addMessage } from "./features/messages/messagesSlice";
import Notification from "./components/Notification";
import { io } from "socket.io-client";

// ── Eager imports (public/auth pages — shown before login, must be fast) ──────
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Layout from "./pages/Layout";

// ── Lazy imports (only loaded when user navigates to those routes) ─────────────
const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Feed = lazy(() => import("./pages/Feed"));
const Profile = lazy(() => import("./pages/Profile"));
const Routines = lazy(() => import("./pages/Routines"));
const Exercises = lazy(() => import("./pages/Exercises"));
const Settings = lazy(() => import("./pages/Settings"));
const Messages = lazy(() => import("./pages/Messages"));
const Statistics = lazy(() => import("./pages/Statistics"));
const MuscleDistribution = lazy(() => import("./pages/MuscleDistribution"));
const ActiveWorkout = lazy(() => import("./pages/ActiveWorkout"));
const WorkoutSummary = lazy(() => import("./pages/WorkoutSummary"));
const WorkoutShare = lazy(() => import("./pages/WorkoutShare"));
const MonthlyReport = lazy(() => import("./pages/MonthlyReport"));
const WorkoutsDetail = lazy(() => import("./pages/WorkoutsDetail"));
const DurationDetail = lazy(() => import("./pages/DurationDetail"));
const VolumeDetail = lazy(() => import("./pages/VolumeDetail"));
const SetsDetail = lazy(() => import("./pages/SetsDetail"));

const SOCKET_URL = import.meta.env.VITE_BASEURL || "http://localhost:4000";

// ── Minimal page loading spinner ──────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center w-full h-screen bg-background">
    <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
  </div>
);

const App = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  const dispatch = useDispatch();
  const socketRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const token = await getToken();
      dispatch(fetchUser(token));
      dispatch(fetchConnections(token));
    };
    fetchData();
  }, [user, getToken, dispatch]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // ── Socket.io global connection for incoming message notifications ──────────
  useEffect(() => {
    if (!user) return;

    let socket = null;

    const init = async () => {
      const token = await getToken();
      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on("message_received", (message) => {
        if (pathnameRef.current === "/messages") {
          dispatch(addMessage(message));
        } else {
          setUnreadCount((c) => c + 1);
          toast.custom(
            (t) => <Notification t={t} message={message} />,
            { position: "bottom-right" }
          );
        }
      });
    };

    init();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user, getToken, dispatch]);

  // Clear unread count when navigating to /messages
  useEffect(() => {
    if (pathname === "/messages") setUnreadCount(0);
  }, [pathname]);

  return (
    <>
      <Toaster />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Landing />} />
          <Route path="/login" element={user ? <Navigate to="/feed" replace /> : <Login />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />

          {/* Protected Layout Routes */}
          <Route element={user ? <Layout unreadCount={unreadCount} /> : <Navigate to="/login" replace />}>
            <Route path="/feed" element={<Feed />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/statistics/muscle-distribution" element={<MuscleDistribution />} />
            <Route path="/statistics/history" element={<Statistics />} />
            <Route path="/statistics/records" element={<Statistics />} />
            <Route path="/statistics/monthly-report" element={<MonthlyReport />} />
            <Route path="/statistics/monthly-report/workouts" element={<WorkoutsDetail />} />
            <Route path="/statistics/monthly-report/duration" element={<DurationDetail />} />
            <Route path="/statistics/monthly-report/volume" element={<VolumeDetail />} />
            <Route path="/statistics/monthly-report/sets" element={<SetsDetail />} />
            <Route path="/active-workout" element={<ActiveWorkout />} />
            <Route path="/workout-summary" element={<WorkoutSummary />} />
            <Route path="/workout-share" element={<WorkoutShare />} />
            <Route path="/routines" element={<Routines />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:profileId" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

export default App;
