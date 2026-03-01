import { useAuth } from "@clerk/clerk-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "~/api/axios";
import { assets } from "~/assets/assets";
import Loading from "~/components/Loading";
import PostCard from "~/components/PostCard";
import RecentMessages from "~/components/RecentMessages";
import StoriesBar from "~/components/StoriesBar";
import QuickProfile from "~/components/QuickProfile";
import SuggestedAthletes from "~/components/SuggestedAthletes";
import { useTranslation } from "react-i18next";
import CreatePost from "./CreatePost";

const Feed = () => {
  const { t } = useTranslation();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  const fetchFeeds = async () => {
    try {
      const { data } = await api.get("/api/post/feed", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      if (data.success) {
        setFeeds(data.posts);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchFeeds();
      setLoading(false);
    };
    init();
  }, []);

  return !loading ? (
    <div className="h-full overflow-y-scroll no-scrollbar py-10 xl:pr-5 flex items-start justify-center xl:gap-8">
      <div className="w-full max-w-2xl px-4">
        <StoriesBar />
        <CreatePost onSuccess={fetchFeeds} />
        <div className="space-y-6 mt-6">
          {feeds.length > 0 ? (
            feeds.map((post) => <PostCard key={post._id} post={post} />)
          ) : (
            <div className="text-center py-20 glass rounded-3xl border border-border-subtle">
              <p className="text-text-muted font-medium">{t('feed.no_posts')}</p>
            </div>
          )}
        </div>
      </div>

      {/* right sidebar */}
      <div className="max-xl:hidden sticky top-10 flex flex-col gap-6 w-80">
        <QuickProfile />
        <SuggestedAthletes />
        <RecentMessages />
      </div>
    </div>
  ) : (
    <Loading />
  );
};

export default Feed;
