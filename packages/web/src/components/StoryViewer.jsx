import { BadgeCheck, X, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";

const StoryViewer = ({ viewStory, setViewStory }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer, progressInterval;
    if (viewStory && viewStory.media_type !== "video") {
      setProgress(0);

      const duration = 10000;
      const setTime = 50;
      let elapsed = 0;

      progressInterval = setInterval(() => {
        elapsed += setTime;
        setProgress((elapsed / duration) * 100);
      }, setTime);

      timer = setTimeout(() => {
        setViewStory(null);
      }, duration);
    }
    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [viewStory, setViewStory]);

  const handleClose = () => {
    setViewStory(null);
  };

  if (!viewStory) return null;

  const renderContent = () => {
    switch (viewStory.media_type) {
      case "image":
        return (
          <img
            src={viewStory.media_url}
            alt="Story"
            className="w-full h-full object-contain"
          />
        );

      case "video":
        return (
          <video
            onEnded={() => setViewStory(null)}
            src={viewStory.media_url}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
          />
        );

      case "text":
        return (
          <div className="w-full h-full flex items-center justify-center p-12 text-white text-3xl font-black text-center tracking-tight leading-snug">
            {viewStory.content}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-300"
    >
      {/* progress bar container */}
      <div className="absolute top-0 left-0 w-full h-1.5 flex gap-1 px-4 pt-6 z-10 transition-all">
        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-75 linear shadow-[0_0_8px_white]"
            style={{ width: `${viewStory.media_type === 'video' ? 0 : progress}%` }}
          ></div>
        </div>
      </div>

      {/* User Info Top Left */}
      <div className="absolute top-12 left-6 right-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 bg-black/20 backdrop-blur-xl pl-2 pr-6 py-2 rounded-full border border-white/10 shadow-2xl">
          <img
            src={viewStory.user?.profile_picture}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shadow-lg"
          />
          <div>
            <div className="text-white font-black flex items-center gap-1.5 text-sm uppercase tracking-widest">
              <span>{viewStory.user?.full_name}</span>
              <BadgeCheck size={16} className="text-accent-primary" />
            </div>
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-tighter">Just now</p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-xl transition-all active:scale-95 border border-white/5 shadow-2xl"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content Wrapper */}
      <div className="w-full max-w-lg aspect-[9/16] relative flex items-center justify-center overflow-hidden rounded-[40px] shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/5"
        style={{ backgroundColor: viewStory.media_type === "text" ? viewStory.background_color : "#000" }}>
        {renderContent()}
      </div>

      {/* Navigation hints */}
      <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <button className="p-4 bg-white/5 rounded-full backdrop-blur-md">
          <ChevronLeft className="w-8 h-8 text-white/40" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <button className="p-4 bg-white/5 rounded-full backdrop-blur-md">
          <ChevronRight className="w-8 h-8 text-white/40" />
        </button>
      </div>
    </div>
  );
};

export default StoryViewer;
