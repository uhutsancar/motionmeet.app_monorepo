import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import moment from "moment";
import { useTranslation } from "react-i18next";
import StoryModal from "./StoryModal";
import StoryViewer from "./StoryViewer";
import { useAuth } from "@clerk/clerk-react";
import api from "~/api/axios";
import toast from "react-hot-toast";

const StoriesBar = () => {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();

  const [stories, setStories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewStory, setViewStory] = useState(null);

  // Set moment locale
  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  const fetchStories = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get("/api/story/get", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setStories(data.stories);
      }
    } catch (error) {
      console.error(error.message);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  return (
    <div className="w-full no-scrollbar overflow-x-auto mb-2 px-1">
      <div className="flex gap-4 pb-4">
        {/* Add story card */}
        <div
          onClick={() => setShowModal(true)}
          className="rounded-[28px] min-w-[110px] h-44 cursor-pointer transition-all duration-300 bg-surface border border-border-subtle hover:bg-surface-light hover:shadow-xl flex flex-col items-center justify-center text-center p-4 group animate-in relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-accent-primary opacity-20"></div>
          <div className="size-12 bg-accent-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent-primary/20 group-hover:scale-110 active:scale-90 transition-all">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <p className="text-[10px] font-black text-text-primary uppercase tracking-widest leading-tight">
            {t('feed.create_story')}
          </p>
        </div>

        {/* Story cards */}
        {stories.map((story, index) => (
          <div
            onClick={() => setViewStory(story)}
            key={index}
            className={`relative rounded-[28px] shadow-sm min-w-[110px] h-44 cursor-pointer transition-all duration-300 bg-surface border border-border-subtle overflow-hidden hover:shadow-xl hover:border-accent-primary/30 active:scale-95 group animate-in`}
            style={{ animationDelay: `${(index + 1) * 0.05}s` }}
          >
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/80 to-transparent z-10"></div>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent z-10"></div>

            <div className="absolute top-3 left-3 z-20 p-0.5 bg-accent-primary rounded-full shadow-lg">
              <img
                src={story.user.profile_picture}
                alt="Profile"
                className="size-9 rounded-full object-cover border-2 border-surface"
              />
            </div>

            <div className="absolute inset-0 z-0 bg-zinc-900">
              {story.media_type === "text" ? (
                <div className="w-full h-full flex items-center justify-center p-4 text-[10px] font-bold text-white text-center leading-tight" style={{ backgroundColor: story.background_color }}>
                  {story.content}
                </div>
              ) : (
                story.media_type === "image" ? (
                  <img
                    src={story.media_url}
                    alt="Story"
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <video
                    src={story.media_url}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                    muted
                    loop
                    autoPlay
                  />
                )
              )}
            </div>

            <div className="absolute inset-0 z-20 flex flex-col justify-end p-4 pointer-events-none">
              <p className="text-white text-[11px] font-bold leading-tight line-clamp-2 drop-shadow-lg mb-1">
                {story.user.full_name.split(' ')[0]}
              </p>
              <p className="text-white/60 text-[9px] drop-shadow-md font-black uppercase tracking-tighter">
                {moment(story.createdAt).fromNow()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <StoryModal setShowModal={setShowModal} fetchStories={fetchStories} />
      )}
      {viewStory && (
        <StoryViewer viewStory={viewStory} setViewStory={setViewStory} />
      )}
    </div>
  );
};

export default StoriesBar;
