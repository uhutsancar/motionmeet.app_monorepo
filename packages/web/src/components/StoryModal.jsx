import { useAuth } from "@clerk/clerk-react";
import { TextIcon, Upload, X, Sparkle } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { useTranslation } from "react-i18next";

const StoryModal = ({ setShowModal, fetchStories }) => {
  const { t } = useTranslation();
  const bgColors = [
    "#0f172a",
    "#1e1b4b",
    "#312e81",
    "#4c1d95",
    "#581c87",
    "#701a75",
    "#831843",
  ];

  const [mode, setMode] = useState("text");
  const [background, setBackground] = useState(bgColors[0]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const { getToken } = useAuth();

  const MAX_VIDEO_DURATION = 60;
  const MAX_IMAGE_SIZE_MB = 50;

  const handleMediaUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video")) {
        if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
          toast.error(`${t('common.error')}: Max ${MAX_IMAGE_SIZE_MB}MB`);
          return;
        }
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          if (video.duration > MAX_VIDEO_DURATION) {
            toast.error(t('feed.video_too_long'));
          } else {
            setMedia(file);
            setPreviewUrl(URL.createObjectURL(file));
            setText("");
            setMode("media");
          }
        };
        video.src = URL.createObjectURL(file);
      } else if (file.type.startsWith("image")) {
        setMedia(file);
        setPreviewUrl(URL.createObjectURL(file));
        setText("");
        setMode("media");
      }
    }
  };

  const handleCreateStory = async () => {
    const media_type =
      mode === "media"
        ? media?.type.startsWith("image")
          ? "image"
          : "video"
        : "text";

    if (media_type === "text" && !text) {
      toast.error(t('feed.add_text_error'));
      return;
    }

    setLoading(true);
    let formData = new FormData();
    formData.append("content", text);
    formData.append("media_type", media_type);
    if (media) formData.append("media", media);
    formData.append("background_color", background);

    const token = await getToken();
    try {
      const { data } = await api.post("/api/story/create", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setShowModal(false);
        toast.success(t('feed.story_created'));
        fetchStories();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
    >
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-base font-black text-white tracking-wide">{t('feed.create_story')}</h2>
          <button
            onClick={() => setShowModal(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Story Preview */}
        <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar px-5 py-4 space-y-4">
          <div
            className="w-full rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg border border-white/5 transition-all duration-500"
            style={{
              backgroundColor: mode === 'text' ? background : '#000',
              aspectRatio: '9/16',
              maxHeight: '320px'
            }}
          >
            {mode === "text" && (
              <textarea
                className="bg-transparent text-white w-full h-full p-6 text-xl font-bold text-center resize-none focus:outline-none leading-tight"
                placeholder={t('feed.whats_on_mind')}
                onChange={(e) => setText(e.target.value)}
                value={text}
                style={{ paddingTop: '20%' }}
              />
            )}
            {mode === "media" && previewUrl && (
              media?.type.startsWith("image") ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <video src={previewUrl} autoPlay muted loop className="w-full h-full object-cover" />
              )
            )}
          </div>

          {/* Color Picker */}
          {mode === "text" && (
            <div className="flex gap-2 justify-center">
              {bgColors.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-lg border-2 transition-all active:scale-90 hover:scale-110 shrink-0 ${background === color ? 'border-white ring-2 ring-white/30 scale-110' : 'border-transparent opacity-70'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setBackground(color)}
                />
              ))}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex gap-3">
            <button
              onClick={() => { setMode("text"); setMedia(null); setPreviewUrl(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all ${mode === "text" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"}`}
            >
              <TextIcon size={18} /> {t('feed.text')}
            </button>
            <label
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all cursor-pointer ${mode === "media" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15"}`}
            >
              <input onChange={handleMediaUpload} type="file" accept="image/*,video/*" className="hidden" />
              <Upload size={18} /> {t('feed.photo_video')}
            </label>
          </div>
        </div>

        {/* Share Button */}
        <div className="px-5 pb-5">
          <button
            onClick={handleCreateStory}
            disabled={loading}
            className="flex items-center justify-center gap-2 text-white py-4 w-full rounded-2xl bg-accent-primary hover:bg-accent-hover active:scale-95 transition-all font-black text-sm uppercase tracking-widest shadow-lg disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkle size={18} />
            )}
            {t('feed.share_story')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryModal;
