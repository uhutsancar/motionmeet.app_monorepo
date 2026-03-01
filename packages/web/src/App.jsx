import React, { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Routines from "./pages/Routines";
import Exercises from "./pages/Exercises";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import Statistics from "./pages/Statistics";
import { useUser, useAuth } from "@clerk/clerk-react";
import Layout from "./pages/Layout";
import toast, { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { fetchUser } from "./features/user/userSlice";
import { fetchConnections } from "./features/connections/connectionsSlice";
import { addMessage } from "./features/messages/messagesSlice";
import Notification from "./components/Notification";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_BASEURL || "http://localhost:4000";

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
        const fromId = message.from_user_id?._id || message.from_user_id;

        if (pathnameRef.current === "/messages") {
          dispatch(addMessage(message));
        } else {
          // Show toast notification when on a different page
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
          <Route path="/routines" element={<Routines />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:profileId" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
