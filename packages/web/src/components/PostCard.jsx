import { BadgeCheck, Heart, MessageCircle, Share2, Dumbbell, Send, Lock } from "lucide-react";
import moment from "moment";
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { useTranslation } from "react-i18next";

const PostCard = ({ post }) => {
  const { t, i18n } = useTranslation();

  // Replace hashtags with styled spans
  const postWithHashtags = post.content ? post.content.replace(
    /(#\w+)/g,
    '<span class="text-accent-primary cursor-pointer font-semibold">$1</span>'
  ) : "";

  const [likes, setLikes] = useState(post.likes_count || []);
  const currentUser = useSelector((state) => state.user.value);
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef(null);

  moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');

  const handleLike = async () => {
    try {
      const { data } = await api.post(
        `/api/post/like`,
        { postId: post._id },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );

      if (data.success) {
        setLikes((prev) => {
          if (prev.includes(currentUser._id)) {
            return prev.filter((id) => id !== currentUser._id);
          } else {
            return [...prev, currentUser._id];
          }
        });
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [comments, setComments] = useState(post.comments || []);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const { data } = await api.post(
        "/api/post/comment/add",
        { postId: post._id, content: commentText },
        { headers: { Authorization: `Bearer ${await getToken()}` } }
      );
      if (data.success) {
        setComments(data.comments);
        setCommentText("");
        toast.success(t('feed.comment_posted', 'Comment posted!'));
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCommentLoading(false);
    }
  };

  // Carousel Data Preparation
  const hasWorkout = post.post_type === 'workout' && post.workout;
  const isVideo = post.post_type === 'video';
  const imageUrls = post.image_urls || [];

  const carouselData = [];

  // First, add photos/videos
  if (isVideo && imageUrls.length > 0) {
    carouselData.push({ type: 'video', url: imageUrls[0] });
  } else {
    imageUrls.forEach(url => carouselData.push({ type: 'image', url }));
  }

  // Then, append Workout exercise card (slide 2+)
  if (hasWorkout) {
    carouselData.push({ type: 'workout', data: post.workout });
  }

  // Handle intersection/scroll logic for dots
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollPosition = scrollRef.current.scrollLeft;
    const slideWidth = scrollRef.current.offsetWidth;
    const currentSlide = Math.round(scrollPosition / slideWidth);

    if (currentSlide !== activeSlide) {
      setActiveSlide(currentSlide);
    }
  };

  if (!post || !post.user) return null;

  return (
    <div className="glass rounded-3xl shadow-sm border border-border-subtle pt-6 pb-2 w-full max-w-[500px] mx-auto animate-in hover:shadow-md transition-all duration-300">

      {/* User Info Header */}
      <div className="px-5 mb-3">
        <div
          onClick={() => navigate("/profile/" + post.user.username)}
          className="inline-flex items-center gap-3.5 cursor-pointer group"
        >
          <img
            src={post.user.profile_picture}
            alt="Profile"
            className="w-12 h-12 rounded-full object-cover shadow-sm bg-surface-light border border-border-subtle group-hover:border-accent-primary transition-all duration-200"
          />
          <div className="flex flex-col">
            <div className="flex items-center space-x-1">
              <span className="text-[15px] font-bold text-text-primary tracking-tight group-hover:text-accent-primary transition-colors">{post.user.full_name}</span>
              {post.user.is_verified && <BadgeCheck className="w-4 h-4 text-accent-primary" />}
            </div>
            <div className="flex items-center gap-2 text-text-muted text-xs font-semibold">
              <span>@{post.user.username} • {moment(post.createdAt).fromNow()}</span>
              {post.visibility === 'private' && (
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Sadece siz</span>
                </span>
              )}
              {post.visibility === 'followers' && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                  <span>Takipçiler</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Post Context & Title */}
      <div className="px-5 mb-4 space-y-1">
        {hasWorkout && post.workout?.name && (
          <h3 className="text-[17px] font-bold text-text-primary leading-tight">
            {post.workout.name}
          </h3>
        )}
        {post.content && (
          <div
            className="text-text-secondary text-[15px] leading-relaxed whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: postWithHashtags }}
          />
        )}
      </div>

      {/* Structured Stats Row (If Workout Exists) */}
      {hasWorkout && (
        <div className="flex items-center gap-6 px-5 mb-4">
          <div className="flex flex-col">
            <span className="text-xs text-text-muted font-semibold mb-0.5">{t('feed.duration', 'Süre')}</span>
            <span className="text-[15px] font-bold text-text-primary">
              {post.workout.durationMinutes || post.workout.duration || '0'}<span className="text-xs text-text-muted font-normal ml-0.5">m</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-text-muted font-semibold mb-0.5">{t('feed.volume', 'Hacim')}</span>
            <span className="text-[15px] font-bold text-text-primary">
              {(post.workout.volumeKg || post.workout.volume || 0).toLocaleString()}<span className="text-xs text-text-muted font-normal ml-0.5">kg</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-text-muted font-semibold mb-0.5">{t('feed.prs', 'Rekorlar')}</span>
            <span className="text-[15px] font-bold text-text-primary">🥇 0</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-text-muted font-semibold mb-0.5">{t('feed.bpm', 'Ort. bpm')}</span>
            <span className="text-[15px] font-bold text-text-primary">❤️ --</span>
          </div>
        </div>
      )}

      {/* Carousel Media */}
      {carouselData.length > 0 && (
        <div className="relative w-full overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
            style={{ scrollBehavior: 'smooth' }}
          >
            {carouselData.map((item, index) => (
              <div
                key={index}
                className="w-full flex-shrink-0 snap-center relative aspect-[4/5] sm:aspect-square bg-black border-y border-border-subtle"
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <video src={item.url} controls className="w-full h-full object-contain" />
                  </div>
                ) : item.type === 'image' ? (
                  <img src={item.url} alt={`Slide ${index}`} className="w-full h-full object-cover" />
                ) : item.type === 'workout' ? (
                  <div className="w-full h-full bg-background flex flex-col justify-center px-6 gap-5">
                    {item.data.exercises?.slice(0, 4).map((ex, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-surface-light border border-border-subtle flex items-center justify-center shrink-0 shadow-sm">
                          <Dumbbell className="w-6 h-6 text-text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-text-primary font-semibold text-[15px] leading-tight line-clamp-2">
                            {ex.sets?.length || 0} set {ex.exerciseId?.name || t('routines.exercise', 'Egzersiz')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {item.data.exercises?.length > 4 && (
                      <div className="text-center mt-2">
                        <p className="text-text-muted text-sm font-medium">
                          {item.data.exercises.length - 4} {t('feed.more_exercises', 'egzersiz daha görün')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          {carouselData.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-1.5 z-10">
              {carouselData.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === activeSlide
                    ? "w-4 bg-accent-primary"
                    : "w-1.5 bg-white/40"
                    }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 px-5 pt-4 mt-2">
        <button
          onClick={handleLike}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity group"
        >
          <Heart className={`w-[26px] h-[26px] ${likes.includes(currentUser._id) ? "fill-red-500 stroke-red-500" : "text-text-primary"}`} />
          <span className={`text-[15px] font-bold ${likes.includes(currentUser._id) ? "text-red-500" : "text-text-primary"}`}>{likes.length}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity group"
        >
          <MessageCircle className={`w-[26px] h-[26px] text-text-primary ${showComments ? "fill-text-primary/20" : ""}`} />
          <span className="text-[15px] font-bold text-text-primary">{comments.length}</span>
        </button>

        <button className="flex items-center gap-2 hover:opacity-70 transition-opacity group ml-auto">
          <Share2 className="w-[24px] h-[24px] text-text-primary -scale-x-100" />
        </button>
      </div>

      {/* Interaction Summary */}
      {likes.length > 0 && (
        <div className="px-5 pt-3 pb-1">
          <p className="text-[13px] text-text-muted">
            {t('feed.liked_by', 'Liked by')} <span className="font-bold text-text-secondary">{likes.length}</span> {t('feed.people', 'people')}
          </p>
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="pt-2 pb-2 space-y-4 animate-in slide-in-from-top-2 duration-300 px-5">
          <div className="max-h-60 overflow-y-auto no-scrollbar space-y-4">
            {comments.length > 0 ? (
              comments.map((comment, i) => (
                <div key={i} className="flex gap-3">
                  <img
                    src={comment.user?.profile_picture}
                    alt="Commenter"
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-border-subtle"
                  />
                  <div className="flex-1">
                    <div className="bg-surface-light rounded-2xl p-3 border border-border-subtle inline-block min-w-[60%]">
                      <p className="text-[13px] font-bold text-text-primary mb-0.5">
                        {comment.user?.full_name}
                      </p>
                      <p className="text-[14px] text-text-secondary leading-snug">
                        {comment.content}
                      </p>
                    </div>
                    <p className="text-[11px] font-semibold text-text-muted mt-1 ml-2">
                      {moment(comment.createdAt).fromNow()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-text-muted py-2 italic">
                {t('feed.no_comments_yet')}
              </p>
            )}
          </div>

          <div className="flex items-end gap-2 bg-surface-light p-2.5 rounded-3xl border border-border-subtle mt-2">
            <textarea
              className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] p-1.5 max-h-24 resize-none leading-relaxed text-text-primary placeholder:text-text-muted"
              placeholder={t('feed.write_comment')}
              rows={1}
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={commentLoading || !commentText.trim()}
              className="w-9 h-9 flex items-center justify-center bg-accent-primary hover:bg-accent-hover text-black rounded-full transition-all active:scale-90 disabled:opacity-50 shrink-0"
            >
              {commentLoading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Send size={16} className="-ml-0.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
