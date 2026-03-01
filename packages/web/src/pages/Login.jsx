import { SignIn } from "@clerk/clerk-react";
import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context/ThemeContext";
import { Globe, Sun, Moon, Dumbbell, TrendingUp, Users } from "lucide-react";
import motionmeetLogo from "../assets/motionmeet_logo.svg";

/* ── Clerk dark theme override ── */
const clerkDark = {
  rootBox: "w-full mx-auto",
  card: "bg-transparent shadow-none w-full border-0 p-0",
  headerTitle: "text-2xl font-extrabold text-white mb-1",
  headerSubtitle: "text-slate-400 text-sm",
  socialButtonsBlockButton: "w-full border border-slate-700 text-slate-100 font-semibold bg-slate-800 hover:bg-slate-700 mb-2 h-11 rounded-xl transition",
  dividerRow: "my-5",
  dividerText: "text-slate-500 text-xs",
  formFieldLabel: "text-slate-300 font-medium mb-1 text-sm",
  formFieldInput: "w-full h-11 rounded-xl border border-slate-700 bg-slate-800 text-white focus:border-blue-500 focus:ring-blue-500 text-sm",
  formButtonPrimary: "w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base mt-2 transition",
  footerAction: "mt-5 text-center text-slate-400 text-sm",
  footerActionLink: "text-blue-400 hover:text-blue-300 font-semibold",
  identityPreviewText: "text-white",
  identityPreviewEditButton: "text-blue-400",
};

const clerkLight = {
  rootBox: "w-full mx-auto",
  card: "bg-transparent shadow-none w-full border-0 p-0",
  headerTitle: "text-2xl font-extrabold text-gray-900 mb-1",
  headerSubtitle: "text-gray-500 text-sm",
  socialButtonsBlockButton: "w-full border border-gray-200 text-gray-700 font-semibold bg-gray-50 hover:bg-gray-100 mb-2 h-11 rounded-xl transition",
  dividerRow: "my-5",
  dividerText: "text-gray-400 text-xs",
  formFieldLabel: "text-gray-700 font-medium mb-1 text-sm",
  formFieldInput: "w-full h-11 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm",
  formButtonPrimary: "w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base mt-2 transition",
  footerAction: "mt-5 text-center text-gray-500 text-sm",
  footerActionLink: "text-blue-500 hover:text-blue-400 font-semibold",
};

/* ── Mini stat badge ── */
const StatBadge = ({ icon: Icon, value, label }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="font-extrabold text-white text-sm leading-none">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
    </div>
  </div>
);

const Login = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language.startsWith("tr") ? "en" : "tr";
    i18n.changeLanguage(next);
    localStorage.setItem("appLanguage", next);
  };

  const isDark = theme === "dark";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg-base)]">

      {/* ── Left: Sign In Form ── */}
      <div className="flex-1 flex flex-col pt-8 md:pt-0 px-6 sm:px-12 lg:px-20 relative">
        {/* Top bar */}
        <div className="flex items-center justify-between py-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={motionmeetLogo} alt="MotionMeet" className="h-8 w-auto" />
            <span className="font-bold text-lg text-[var(--text-primary)] hidden sm:block tracking-tight">MotionMeet</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Lang toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-light)] transition"
            >
              <Globe className="w-4 h-4" />
              {i18n.language.startsWith("tr") ? "TR" : "EN"}
            </button>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-light)] transition"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex flex-col items-center justify-center pb-10">
          <div className="w-full max-w-md">
            <SignIn
              appearance={{
                elements: isDark ? clerkDark : clerkLight,
                variables: isDark
                  ? { colorBackground: "#141417", colorText: "#F3F4F6", colorPrimary: "#60A5FA" }
                  : { colorBackground: "#FFFFFF", colorText: "#111827", colorPrimary: "#3B82F6" },
              }}
              routing="path"
              path="/login"
              signUpUrl="/signup"
              fallbackRedirectUrl="/feed"
            />
          </div>
        </div>
      </div>

      {/* ── Right: Branding panel (only desktop) ── */}
      <div className="hidden md:flex flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 items-center justify-center p-12">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-indigo-600/20 blur-3xl" />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #60a5fa 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-md text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="flex items-center gap-3">
              <img src={motionmeetLogo} alt="MotionMeet" className="h-12 w-auto brightness-0 invert" />
              <span className="text-2xl font-extrabold text-white tracking-tight">MotionMeet</span>
            </div>
          </div>

          {/* Headline */}
          <div>
            <h2 className="text-4xl font-extrabold text-white leading-tight mb-3">
              Train smarter,<br />
              <span className="text-blue-400">together.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Join thousands of athletes already tracking their progress with MotionMeet.
            </p>
          </div>

          {/* Stat badges */}
          <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto">
            <StatBadge icon={Users} value="50,000+" label="Active athletes" />
            <StatBadge icon={Dumbbell} value="1M+" label="Workouts logged" />
            <StatBadge icon={TrendingUp} value="4.9 ★" label="App rating" />
          </div>

          {/* Mockup workout card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500/30 flex items-center justify-center text-blue-400">
                <Dumbbell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">Push Day A</p>
                <p className="text-slate-400 text-xs">Active • 01:12:34</p>
              </div>
              <div className="ml-auto bg-blue-500 text-white text-[11px] font-bold px-3 py-1 rounded-full">Live</div>
            </div>
            {[
              { name: 'Bench Press', val: '85 kg × 6', done: true, pr: true },
              { name: 'Squat', val: '100 kg × 5', done: true, pr: false },
              { name: 'Deadlift', val: '120 kg × 3', done: false, pr: false },
            ].map((s, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 last:mb-0 ${s.done ? 'bg-green-500/10 border border-green-500/20' : 'bg-white/5 border border-white/10'}`}>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${s.done ? 'text-green-400' : 'text-white/60'}`}>{s.name}</p>
                  {s.pr && <span className="text-[10px] font-bold text-amber-400">🏆 PR!</span>}
                </div>
                <span className={`text-sm font-bold ${s.done ? 'text-green-300' : 'text-white/40'}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
