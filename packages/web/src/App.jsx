import React, { useEffect, useRef } from "react";
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
import { useUser, useAuth } from "@clerk/clerk-react";
import Layout from "./pages/Layout";
import toast, { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { fetchUser } from "./features/user/userSlice";
import { fetchConnections } from "./features/connections/connectionsSlice";
import { addMessage } from "./features/messages/messagesSlice";
import Notification from "./components/Notification";

const App = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  const dispatch = useDispatch();

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

  useEffect(() => {
    if (!user) return;

    const eventSource = new EventSource(
      import.meta.env.VITE_BASEURL + "/api/message/" + user.id
    );

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (
          pathnameRef.current ===
          "/messages/" + message.from_user_id._id
        ) {
          dispatch(addMessage(message));
        } else {
          toast.custom(
            (t) => <Notification t={t} message={message} />,
            { position: "bottom-right" }
          );
        }
      } catch (er) {
        // connected / ping ignore
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [user, dispatch]);

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
        <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route path="/feed" element={<Feed />} />
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
