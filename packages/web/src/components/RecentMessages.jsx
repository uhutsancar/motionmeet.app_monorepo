import { useAuth, useUser } from "@clerk/clerk-react";
import moment from "moment";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "~/api/axios";
import { useTranslation } from "react-i18next";

const RecentMessages = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const { user } = useUser();
  const { getToken } = useAuth();

  const fetchRecentMessages = async () => {
    try {
      const token = await getToken();

      const { data } = await api.get("/api/user/recent-messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        //Group messages by sender and get the latest message for each sender

        const groupMessages = data.messages.reduce((acc, message) => {
          const senderId = message.from_user_id._id;
          if (
            !acc[senderId] ||
            new Date(message.createdAt) > new Date(acc[senderId].createdAt)
          ) {
            acc[senderId] = message;
          }
          return acc;
        }, {});

        //Sort messages by date
        const sortedMessages = Object.values(groupMessages).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        setMessages(sortedMessages);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRecentMessages();
      setInterval(fetchRecentMessages, 30000);
      return () => {
        clearInterval();
      };
    }
  }, [user]);

  return (
    <div className="bg-surface border border-border-subtle max-w-sm mt-4 p-5 min-h-20 rounded-2xl shadow-sm text-text-primary">
      <h3 className="font-bold text-sm mb-4">{t('chat.recent_messages', 'Recent Messages')}</h3>
      <div className="flex flex-col max-h-56 overflow-y-scroll no-scrollbar">
        {messages.map((message, index) => (
          <Link
            to={`/messages/${message.from_user_id._id}`}
            key={index}
            className="flex items-start gap-3 py-2.5 px-2 hover:bg-surface-light rounded-xl transition"
          >
            <img
              src={message.from_user_id.profile_picture}
              alt="Message Profile Image"
              className="w-10 h-10 rounded-full object-cover shadow-sm"
            />
            <div className="w-full">
              <div className="flex justify-between items-center mb-0.5">
                <p className="font-semibold text-sm text-text-primary">{message.from_user_id.full_name}</p>
                <p className="text-[10px] text-text-muted font-medium">
                  {moment(message.createdAt).fromNow(true)}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-text-secondary text-xs truncate max-w-[150px]">
                  {message.text ? message.text : t('feed.media_placeholder', 'Media')}
                </p>
                {!message.seen && (
                  <p className="bg-accent-primary text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold">
                    1
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RecentMessages;
