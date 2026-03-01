import { Menu, X } from "lucide-react";
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Loading from "~/components/Loading";
import SideBar from "~/components/SideBar";
import { useSelector } from 'react-redux'

const Layout = () => {
  const user = useSelector((state) => state.user.value);
  const [sideBarOpen, setSideBarOpen] = useState(false);

  return user ? (
    <div className="w-full flex h-screen text-text-primary bg-background transition-colors duration-300">

      <SideBar sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen} />

      <div className="flex-1 bg-background overflow-y-auto">
        <Outlet />
      </div>

      {sideBarOpen ? (
        <X
          className="absolute top-3 right-3 p-2 z-100 bg-surface rounded-md shadow w-10 h-10 text-text-secondary sm:hidden cursor-pointer border border-border-subtle"
          onClick={() => setSideBarOpen(false)}
        />
      ) : (
        <Menu
          className="absolute top-3 right-3 p-2 z-100 bg-surface rounded-md shadow w-10 h-10 text-text-secondary sm:hidden cursor-pointer border border-border-subtle"
          onClick={() => setSideBarOpen(true)}
        />
      )}
    </div>
  ) : (
    <Loading />
  );
};

export default Layout;
