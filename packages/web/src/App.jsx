import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useAuthContext } from "./context/AuthProvider";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Notification from "./components/Notification";
import { SocketProvider } from "./context/SocketProvider";
import { fetchConnections } from "./features/connections/connectionsSlice";
import { addMessage } from "./features/messages/messagesSlice";
import { fetchUser } from "./features/user/userSlice";
import { useSocket } from "./hooks/useSocket";

const Landing = lazy(() => import("./pages/Landing"));
const Layout = lazy(() => import("./pages/Layout"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
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
const AdvancedStatistics = lazy(() => import("./pages/AdvancedStatistics"));
const MuscleDistribution = lazy(() => import("./pages/MuscleDistribution"));
const PersonalRecords = lazy(() => import("./pages/PersonalRecords"));
const ActiveWorkout = lazy(() => import("./pages/ActiveWorkout"));
const WorkoutSummary = lazy(() => import("./pages/WorkoutSummary"));
const WorkoutShare = lazy(() => import("./pages/WorkoutShare"));
const MonthlyReport = lazy(() => import("./pages/MonthlyReport"));
const WorkoutsDetail = lazy(() => import("./pages/WorkoutsDetail"));
const DurationDetail = lazy(() => import("./pages/DurationDetail"));
const VolumeDetail = lazy(() => import("./pages/VolumeDetail"));
const SetsDetail = lazy(() => import("./pages/SetsDetail"));

const PageLoader = () => (
  <Box sx={{ alignItems: "center", display: "flex", height: "100dvh", justifyContent: "center" }}>
    <CircularProgress size={34} />
  </Box>
);

const NotFound = ({ authenticated }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", minHeight: "100dvh", justifyContent: "center", p: 3, textAlign: "center" }}>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>404</Typography>
      <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>Page not found</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>The page you requested does not exist or has moved.</Typography>
      <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => navigate(authenticated ? "/feed" : "/")}>
        {authenticated ? "Go to feed" : "Go home"}
      </Button>
    </Box>
  );
};

const AppContent = () => {
  const { user } = useAuthContext();
  const { getToken } = useAuthContext();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  const dispatch = useDispatch();
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const token = await getToken();
      if (!token) return;
      dispatch(fetchUser(token));
      dispatch(fetchConnections(token));
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, user]);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (pathname.startsWith("/messages")) setUnreadCount(0);
  }, [pathname]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleMessage = (message) => {
      dispatch(addMessage(message));
      if (pathnameRef.current.startsWith("/messages")) return;

      setUnreadCount((count) => count + 1);
      toast.custom(
        (toastInstance) => <Notification toastInstance={toastInstance} message={message} />,
        { position: "bottom-right" },
      );
    };

    socket.on("message_received", handleMessage);
    return () => socket.off("message_received", handleMessage);
  }, [dispatch, socket]);

  return (
    <>
      <Toaster />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/feed" replace /> : <Landing />} />
          <Route path="/login/*" element={user ? <Navigate to="/feed" replace /> : <Login />} />
          <Route path="/signup/*" element={user ? <Navigate to="/feed" replace /> : <Signup />} />
          <Route path="/sign-in/*" element={<Navigate to="/login" replace />} />
          <Route path="/sign-up/*" element={<Navigate to="/signup" replace />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />

          <Route element={user ? <Layout unreadCount={unreadCount} /> : <Navigate to="/login" replace />}>
            <Route path="/feed" element={<Feed />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:userId" element={<Messages />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/statistics/muscle-distribution" element={<MuscleDistribution />} />
            <Route path="/statistics/history" element={<AdvancedStatistics />} />
            <Route path="/statistics/records" element={<PersonalRecords />} />
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

          <Route path="*" element={<NotFound authenticated={Boolean(user)} />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => {
  const { isLoaded } = useAuthContext();

  if (!isLoaded) return <PageLoader />;

  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
};

export default App;
