import React from "react";
import { useNavigate } from "react-router-dom";
import { assets } from "~/assets/assets";
import MenuItems from "./MenuItems";
import { LogOut } from "lucide-react";
import { UserButton, useClerk } from "@clerk/clerk-react";
import { useSelector } from 'react-redux';

const SideBar = ({ sideBarOpen, setSideBarOpen }) => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.user.value);
  const { signOut } = useClerk();

  return (
    <div
      className={`w-60 xl:w-72 glass border-r border-border-subtle flex flex-col justify-between items-center max-sm:absolute top-0 bottom-0 z-20 transition-all duration-300 ease-in-out ${sideBarOpen ? "translate-x-0" : "max-sm:-translate-x-full"}`}
    >
      <div className="w-full">
        <div className="flex items-center gap-3 px-7 my-6 cursor-pointer" onClick={() => navigate("/")}>
          <img src={assets.logo} alt="MotionMeet" className="w-8 h-8 rounded-md object-contain" />
          <span className="font-bold text-xl tracking-tight text-text-primary">MotionMeet</span>
        </div>
        <hr className="border-border-subtle mb-6" />

        <MenuItems setSideBarOpen={setSideBarOpen} />
      </div>

      <div className="w-full border-t border-border-subtle p-5 flex flex-col gap-4 mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-center cursor-pointer" onClick={() => navigate("/profile")}>
            <UserButton />
            <div>
              <h1 className="text-sm font-semibold text-text-primary line-clamp-1">{user?.full_name}</h1>
              <p className="text-xs text-text-muted line-clamp-1">@{user?.username}</p>
            </div>
          </div>
          <LogOut onClick={signOut} className="w-5 text-text-muted hover:text-text-primary transition cursor-pointer shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default SideBar;
