import { useAuth } from "@clerk/clerk-react";
import { Image, X, Send } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import api from "~/api/axios";
import { useTranslation } from "react-i18next";

const CreatePost = ({ onSuccess }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const user = useSelector((state) => state.user.value);
  const { getToken } = useAuth();

  const handleSubmit = async () => {
    if (!images.length && !content) {
      return toast.error(t('feed.whats_on_mind'));
    }
    setLoading(true);

    const postType =
      images.length > 0 && images[0].type.startsWith("video")
        ? "video"
        : images.length && content
          ? "text_with_image"
          : images.length
            ? "image"
            : "text";

    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("post_type", postType);
      images.forEach((image) => {
        formData.append("images", image);
      });

      const { data } = await api.post("/api/post/add", formData, {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setContent("");
        setImages([]);
        toast.success(t('feed.post_published'));
        if (onSuccess) onSuccess();
        else navigate("/");
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full animate-in ${onSuccess ? "" : "min-h-screen bg-background pt-20 px-4"}`}>
      <div className={`w-full bg-surface p-5 rounded-3xl shadow-sm border border-border-subtle space-y-4 ${onSuccess ? "" : "max-w-xl mx-auto"}`}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user.profile_picture}
              alt="Profile"
              className="w-11 h-11 rounded-full object-cover border-2 border-border-subtle shadow-sm"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface rounded-full"></div>
          </div>
          <div className="flex flex-col">
            <h2 className="font-bold text-sm tracking-tight text-text-primary">{user.full_name}</h2>
            <p className="text-xs text-text-muted">@{user.username}</p>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          className="w-full resize-none min-h-[100px] bg-transparent text-text-primary text-sm outline-none placeholder-text-muted border-none focus:ring-0 px-1"
          placeholder={t('feed.whats_on_mind')}
          onChange={(e) => setContent(e.target.value)}
          value={content}
        />

        {/* Media Preview */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3 py-2">
            {images.map((image, i) => (
              <div key={i} className="relative group rounded-2xl overflow-hidden border border-border-subtle shadow-sm">
                {image.type.startsWith("video") ? (
                  <video
                    src={URL.createObjectURL(image)}
                    className="h-28 w-40 object-cover"
                  />
                ) : (
                  <img
                    src={URL.createObjectURL(image)}
                    className="h-28 w-28 object-cover"
                    alt="Preview"
                  />
                )}
                <button
                  onClick={() => setImages(images.filter((_, index) => index !== i))}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-black/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
          <div className="flex items-center gap-1">
            <label
              htmlFor="media-upload"
              className="flex items-center gap-2 text-sm text-text-primary hover:text-accent-primary transition cursor-pointer px-4 py-2 rounded-xl hover:bg-accent-primary/10 border border-transparent hover:border-accent-primary/20"
            >
              <Image className="w-5 h-5 text-accent-primary" />
              <span className="font-bold">{t('feed.photo_video')}</span>
            </label>
            <input
              type="file"
              id="media-upload"
              accept="image/*,video/*"
              hidden
              multiple
              onChange={(e) => setImages([...images, ...Array.from(e.target.files)])}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || (!content.trim() && !images.length)}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent-primary hover:bg-accent-hover text-white rounded-xl text-sm font-bold shadow-lg shadow-accent-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('feed.post')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
