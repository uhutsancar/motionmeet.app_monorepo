import React from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Notification = ({ toastInstance, message }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      className={`max-w-md w-full bg-surface glass shadow-2xl rounded-2xl flex border border-border-subtle overflow-hidden transform transition-all duration-300 hover:scale-[1.02]`}
    >
      <div className="flex-1 p-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={message.from_user_id.profile_picture}
              alt=""
              className="h-12 w-12 rounded-full object-cover border-2 border-accent-primary"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-surface animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">
              {message.from_user_id.full_name}
            </p>
            <p className="text-sm text-text-muted truncate italic">
              "{message.text.slice(0, 50)}{message.text.length > 50 ? "..." : ""}"
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-border-subtle bg-surface-light/50">
        <button
          onClick={() => {
            navigate(`/messages/${message.from_user_id._id}`);
            toast.dismiss(toastInstance.id);
          }}
          className="px-6 text-accent-primary font-black text-xs uppercase tracking-widest hover:bg-accent-primary hover:text-white transition-colors h-full"
        >
          {t("messages.reply", "Reply")}
        </button>
      </div>
    </div>
  );
};

export default Notification;
