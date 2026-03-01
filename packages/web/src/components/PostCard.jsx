import { BadgeCheck, Heart, MessageCircle, Share2, Dumbbell, Send } from "lucide-react";
import moment from "moment";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { useTranslation } from "react-i18next";

const PostCard = ({ post }) => {
  const { t, i18n } = useTranslation();
  const postWithHashtags = post.content.replace(
    /(#\w+)/g,
    '<span class="text-accent-primary cursor-pointer font-semibold">$1</span>'
  );

  const [likes, setLikes] = useState(post.likes_count);
  const currentUser = useSelector((state) => state.user.value);
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Set moment locale
  moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');

  const handleLike = async () => {
    try {
      const { data } = await api.post(
        `/api/post/like`,
        { postId: post._id },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
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
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
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

  return (
    <div className="glass rounded-3xl shadow-sm border border-border-subtle p-6 space-y-4 w-full max-w-2xl animate-in hover:shadow-md transition-all duration-300">
      {/* User Info */}
      <div
        onClick={() => navigate("/profile/" + post.user.username)}
        className="inline-flex items-center gap-3.5 cursor-pointer group"
      >
        <img
          src={post.user.profile_picture}
          alt="Profile"
          className="w-11 h-11 rounded-full object-cover shadow-sm ring-2 ring-transparent group-hover:ring-accent-primary transition-all duration-200"
        />
        <div className="flex flex-col">
          <div className="flex items-center space-x-1">
            <span className="font-bold text-text-primary tracking-tight group-hover:text-accent-primary transition-colors">{post.user.full_name}</span>
            <BadgeCheck className="w-4 h-4 text-accent-primary" />
          </div>

          <div className="text-text-muted text-[12px] font-bold">
            @{post.user.username} • {moment(post.createdAt).fromNow()}
          </div>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div
          className="text-text-secondary text-[15px] leading-relaxed whitespace-pre-line font-medium px-1"
          dangerouslySetInnerHTML={{ __html: postWithHashtags }}
        />
      )}

      {/* Media (Images/Videos) */}
      <div className="space-y-4">
        {post.post_type === 'video' && post.image_urls?.[0] && (
          <div className="relative rounded-2xl overflow-hidden border border-border-subtle shadow-sm bg-black aspect-video flex items-center justify-center">
            <video
              src={post.image_urls[0]}
              controls
              className="max-h-[500px] w-full"
            />
          </div>
        )}

        {post.post_type === 'workout' && post.workout && (
          <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent-primary/10 rounded-lg">
                  <Dumbbell className="w-5 h-5 text-accent-primary" />
                </div>
                <span className="font-bold text-text-primary tracking-tight">{post.workout.name || t('routines.workout', 'Antrenman')}</span>
              </div>
              <div className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-3 py-1 rounded-full uppercase tracking-widest border border-accent-primary/20">
                {t('profile.statistics', 'STATİSTİKLER').toUpperCase()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{t('profile.duration')}</span>
                <span className="text-lg font-bold text-text-primary">{post.workout.durationMinutes} {t('common.minutes_short', 'min')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{t('profile.volume')}</span>
                <span className="text-lg font-bold text-text-primary">{post.workout.volumeKg} {t('common.kg', 'kg')}</span>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              {post.workout.exercises?.slice(0, 3).map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary font-bold">{ex.exerciseId?.name || t('routines.exercise', 'Egzersiz')}</span>
                  <span className="text-text-muted font-bold">{ex.sets?.length} {t('routines.sets', 'sets')}</span>
                </div>
              ))}
              {post.workout.exercises?.length > 3 && (
                <p className="text-[11px] text-accent-primary font-bold">+{post.workout.exercises.length - 3} {t('profile.more_exercises', 'more exercises')}</p>
              )}
            </div>
          </div>
        )}

        {post.image_urls && post.image_urls.length > 0 && post.post_type !== 'video' && (
          <div className={`grid gap-3 ${post.image_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {post.image_urls.map((img, index) => (
              <img
                src={img}
                key={index}
                alt="Post"
                className={`w-full object-cover rounded-2xl border border-border-subtle shadow-sm
                ${post.image_urls.length === 1 ? "max-h-[500px]" : "h-64"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 text-text-muted text-[13px] font-bold pt-4 mt-2 border-t border-border-subtle">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 hover:text-accent-primary transition-colors group"
        >
          <div className={`p-2 rounded-xl group-hover:bg-accent-primary/10 transition-colors ${likes.includes(currentUser._id) ? "text-red-500" : ""}`}>
            <Heart className={`w-5 h-5 ${likes.includes(currentUser._id) ? "fill-red-500 stroke-red-500" : ""}`} />
          </div>
          <span className={likes.includes(currentUser._id) ? "text-red-500" : ""}>{likes.length}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 hover:text-accent-primary transition-colors group ${showComments ? "text-accent-primary" : ""}`}
        >
          <div className="p-2 rounded-xl group-hover:bg-accent-primary/10 transition-colors">
            <MessageCircle className={`w-5 h-5 ${showComments ? "fill-accent-primary/20" : ""}`} />
          </div>
          <span>{comments.length}</span>
        </button>

        <button className="flex items-center gap-1.5 hover:text-accent-primary transition-colors group">
          <div className="p-2 rounded-xl group-hover:bg-accent-primary/10 transition-colors">
            <Share2 className="w-5 h-5" />
          </div>
          <span>7</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="pt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="max-h-60 overflow-y-auto no-scrollbar space-y-4 px-1">
            {comments.length > 0 ? (
              comments.map((comment, i) => (
                <div key={i} className="flex gap-3">
                  <img
                    src={comment.user?.profile_picture}
                    alt="Commenter"
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-border-subtle"
                  />
                  <div className="flex-1">
                    <div className="bg-surface-light rounded-2xl p-3 border border-border-subtle">
                      <p className="text-xs font-black text-text-primary mb-1">
                        {comment.user?.full_name}
                      </p>
                      <p className="text-sm text-text-secondary leading-normal">
                        {comment.content}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-text-muted mt-1 ml-2">
                      {moment(comment.createdAt).fromNow()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted text-center py-4 italic">
                {t('feed.no_comments_yet')}
              </p>
            )}
          </div>

          <div className="flex items-end gap-2 bg-surface-light p-2 rounded-2xl border border-border-subtle">
            <textarea
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-2 max-h-24 resize-none leading-relaxed text-text-primary placeholder:text-text-muted"
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
              className="p-2.5 bg-accent-primary hover:bg-accent-hover text-white rounded-xl transition-all active:scale-90 disabled:opacity-50 shadow-lg shadow-accent-primary/20"
            >
              {commentLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
