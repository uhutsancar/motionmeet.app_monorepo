import React, { useState } from "react";
import { Dumbbell, Calendar as CalendarIcon, LogOut, LineChart, User as UserIcon, Share2, TrendingUp, Trophy, Target } from "lucide-react";
import { useSelector } from "react-redux";
import { useClerk, useAuth } from "@clerk/clerk-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTranslation } from "react-i18next";
import ProfileModal from "../components/ProfileModal";
import api from "~/api/axios";
import { useEffect } from "react";
import moment from "moment";
import toast from "react-hot-toast";

const Profile = () => {
  const user = useSelector((state) => state.user.value);
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { t, i18n } = useTranslation();

  const [activeStatTab, setActiveStatTab] = useState("duration");
  const [showEdit, setShowEdit] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [chartData, setChartData] = useState([]);

  // Set moment locale
  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const { data } = await api.get("/api/workout", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.success) {
          setWorkouts(data.workouts || []);
        }
      } catch (error) {
        console.error("Error fetching workouts", error);
      }
    };
    fetchWorkouts();
  }, [getToken]);

  useEffect(() => {
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const startOfWeek = moment().subtract(i, 'weeks').startOf('isoWeek');
      weeks.push({
        start: startOfWeek,
        end: moment(startOfWeek).endOf('isoWeek'),
        name: startOfWeek.format("MMM DD"),
        amt: 0
      });
    }

    workouts.forEach(workout => {
      const workoutDate = moment(workout.startTime);
      const week = weeks.find(w => workoutDate.isBetween(w.start, w.end));
      if (week) {
        if (activeStatTab === "duration") {
          week.amt += workout.durationMinutes || 0;
        } else if (activeStatTab === "volume") {
          week.amt += workout.volumeKg || 0;
        } else if (activeStatTab === "reps") {
          let totalReps = 0;
          workout.exercises?.forEach(e => {
            e.sets?.forEach(s => {
              totalReps += s.reps || 0;
            });
          });
          week.amt += totalReps;
        }
      }
    });

    setChartData(weeks.map(({ name, amt }) => ({ name, amt })));
  }, [workouts, activeStatTab]);

  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen pt-4 pb-20 sm:pb-0 text-text-primary bg-background overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 space-y-6">

        {/* User Header Card */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-6 animate-in">
          <div className="flex items-center gap-5 mb-4 sm:mb-0">
            <div className="relative group">
              <div className="w-20 h-20 bg-surface rounded-3xl flex items-center justify-center text-3xl font-bold cursor-pointer overflow-hidden border border-border-subtle shadow-lg transition-transform group-hover:scale-105">
                {user.profile_picture ? (
                  <img src={user.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.full_name?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-background rounded-full"></div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{user.full_name || user.username}</h1>
              <div className="flex gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-xl font-black text-accent-primary leading-none">{workouts.length}</span>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('profile.workouts')}</span>
                </div>
                <div className="w-px h-8 bg-border-subtle mx-1"></div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-text-primary leading-none">{user.followers?.length || 0}</span>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('profile.followers')}</span>
                </div>
                <div className="w-px h-8 bg-border-subtle mx-1"></div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-text-primary leading-none">{user.following?.length || 0}</span>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{t('profile.following')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowEdit(true)}
              className="flex-1 sm:flex-none bg-surface border border-border-subtle hover:border-accent-primary px-6 py-2.5 rounded-2xl text-sm font-bold transition-all text-text-primary shadow-sm hover:shadow-md active:scale-95"
            >
              {t('profile.edit_profile')}
            </button>
          </div>
        </div>

        {/* Dynamic Chart Area */}
        <div className="glass rounded-3xl p-6 border border-border-subtle shadow-sm animate-in" style={{ animationDelay: '0.05s' }}>
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-accent-primary/10 rounded-2xl">
                <TrendingUp className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">{t('profile.weekly_activity')}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-text-primary tracking-tighter">
                    {chartData.length > 0 ? chartData[chartData.length - 1].amt : 0}
                  </span>
                  <span className="text-sm font-bold text-text-muted">
                    {activeStatTab === "duration" ? t('common.minutes_short') : activeStatTab === "volume" ? t('common.kg') : t('profile.reps')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickMargin={10} />
                <Tooltip
                  cursor={{ fill: 'var(--bg-surface-light)', radius: 8 }}
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="amt" fill="var(--accent-primary)" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? 'var(--accent-primary)' : 'var(--accent-primary)'} fillOpacity={index === chartData.length - 1 ? 1 : 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2 mt-8 bg-surface-light p-1 rounded-2xl border border-border-subtle max-w-fit">
            {["duration", "volume", "reps"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveStatTab(tab)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeStatTab === tab ? "bg-surface text-accent-primary shadow-sm border border-border-subtle scale-100" : "text-text-muted hover:text-text-primary"}`}
              >
                {t(`profile.${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="animate-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-xs font-black text-text-muted mb-4 px-2 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-4 h-4" />
            {t('profile.insights')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button className="flex flex-col items-center justify-center gap-3 glass hover:bg-surface transition-all rounded-3xl p-5 border border-border-subtle shadow-sm group active:scale-95">
              <div className="p-3 bg-surface-light rounded-2xl group-hover:bg-accent-primary/10 transition-colors">
                <LineChart className="w-5 h-5 text-text-muted group-hover:text-accent-primary" />
              </div>
              <span className="font-bold text-xs text-text-secondary group-hover:text-text-primary uppercase tracking-tighter">{t('profile.stats')}</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 glass hover:bg-surface transition-all rounded-3xl p-5 border border-border-subtle shadow-sm group active:scale-95">
              <div className="p-3 bg-surface-light rounded-2xl group-hover:bg-accent-primary/10 transition-colors">
                <Dumbbell className="w-5 h-5 text-text-muted group-hover:text-accent-primary" />
              </div>
              <span className="font-bold text-xs text-text-secondary group-hover:text-text-primary uppercase tracking-tighter">{t('menu.exercises')}</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 glass hover:bg-surface transition-all rounded-3xl p-5 border border-border-subtle shadow-sm group active:scale-95">
              <div className="p-3 bg-surface-light rounded-2xl group-hover:bg-accent-primary/10 transition-colors">
                <Trophy className="w-5 h-5 text-text-muted group-hover:text-accent-primary" />
              </div>
              <span className="font-bold text-xs text-text-secondary group-hover:text-text-primary uppercase tracking-tighter">{t('profile.awards')}</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 glass hover:bg-surface transition-all rounded-3xl p-5 border border-border-subtle shadow-sm group active:scale-95">
              <div className="p-3 bg-surface-light rounded-2xl group-hover:bg-accent-primary/10 transition-colors">
                <CalendarIcon className="w-5 h-5 text-text-muted group-hover:text-accent-primary" />
              </div>
              <span className="font-bold text-xs text-text-secondary group-hover:text-text-primary uppercase tracking-tighter">{t('profile.events')}</span>
            </button>
          </div>
        </div>

        {/* Workouts Feed */}
        <div className="animate-in pb-20 sm:pb-10" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">{t('profile.workouts')}</h3>
            <span className="bg-surface-light text-[10px] font-bold px-3 py-1 rounded-full border border-border-subtle">{workouts.length}</span>
          </div>

          {workouts.length > 0 ? (
            <div className="space-y-4">
              {workouts.map((workout) => (
                <div key={workout._id} className="bg-surface rounded-3xl p-6 border border-border-subtle shadow-sm flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1 bg-accent-primary h-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-text-primary text-xl tracking-tight">{workout.name}</h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          try {
                            const token = await getToken();
                            const { data } = await api.post("/api/post/add", {
                              post_type: "workout",
                              workout: workout._id,
                              content: t('feed.workout_post_content', { name: workout.name }) || `Just finished my ${workout.name} workout! 🏋️‍♂️`
                            }, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (data.success) {
                              toast.success(t('feed.post_published', 'Shared to feed!'));
                            }
                          } catch (err) {
                            toast.error("Failed to share");
                          }
                        }}
                        className="p-2.5 bg-surface-light hover:bg-accent-primary/10 text-text-muted hover:text-accent-primary rounded-xl border border-border-subtle transition-all"
                        title="Share to Feed"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-tighter leading-none mb-1">{t('profile.history')}</p>
                        <p className="text-xs font-bold text-text-secondary">{moment(workout.startTime).format("MMM DD, YYYY")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                      <span className="text-sm font-bold text-text-primary capitalize">{workout.durationMinutes} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
                      <span className="text-sm font-bold text-text-primary capitalize">{workout.volumeKg} kg volume</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-3xl p-12 border border-border-subtle shadow-sm flex flex-col items-center justify-center text-center">
              <div className="p-5 bg-surface-light rounded-full mb-4">
                <Dumbbell className="w-10 h-10 text-text-muted opacity-30" />
              </div>
              <h3 className="text-lg font-bold mb-1 text-text-primary">{t('profile.no_workouts_yet')}</h3>
              <p className="text-sm text-text-secondary max-w-xs">{t('profile.start_journey')}</p>
            </div>
          )}
        </div>
      </div>
      {showEdit && <ProfileModal setShowEdit={setShowEdit} />}
    </div>
  );
};

export default Profile;
