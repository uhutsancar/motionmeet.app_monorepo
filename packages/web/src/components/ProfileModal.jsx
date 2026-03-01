import { useAuth } from "@clerk/clerk-react";
import { Pencil } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { updateUser } from "~/features/user/userSlice";
import { useTranslation } from "react-i18next";

const ProfileModal = ({ setShowEdit }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { getToken } = useAuth();

  const user = useSelector((state) => state.user.value);
  const [editForm, setEditForm] = useState({
    username: user.username,
    bio: user.bio,
    location: user.location,
    profile_picture: null,
    cover_photo: null,
    full_name: user.full_name,
    weight: user.weight || 0,
    height: user.height || 0,
  });
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const userData = new FormData();
      const {
        full_name,
        username,
        bio,
        location,
        profile_picture,
        cover_photo,
        weight,
        height,
      } = editForm;

      userData.append("username", username);
      userData.append("bio", bio);
      userData.append("location", location);
      userData.append("full_name", full_name);
      userData.append("weight", weight);
      userData.append("height", height);
      profile_picture && userData.append("profile", profile_picture);
      cover_photo && userData.append("cover", cover_photo);

      const token = await getToken();
      dispatch(updateUser({ userData, token }));

      setShowEdit(false);
    } catch (error) {
      toast.error(error.message);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface rounded-2xl shadow-xl border border-border-subtle my-auto max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 no-scrollbar">
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          {t('profile.edit_profile')}
        </h1>
        <form
          className="space-y-4"
          onSubmit={(e) =>
            toast.promise(handleSaveProfile(e), { loading: t('common.saving', 'Saving...') })
          }
        >
          {/* Profile Picture   */}
          <div className="flex flex-col items-start gap-3">
            <label
              htmlFor="profile_picture"
              className="block text-sm font-semibold text-text-primary mb-1"
            >
              {t('profile.profile_picture', 'Profile Picture')}
              <input
                hidden
                type="file"
                accept="image/*"
                id="profile_picture"
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    profile_picture: e.target.files[0],
                  })
                }
              />
              <div className="group/profile relative mt-2">
                <img
                  src={
                    editForm.profile_picture
                      ? URL.createObjectURL(editForm.profile_picture)
                      : user.profile_picture
                  }
                  alt=""
                  className="w-24 h-24 rounded-full object-cover border-2 border-border-subtle shadow-sm"
                />

                <div
                  className="absolute hidden group-hover/profile:flex inset-0 bg-black/40 rounded-full items-center justify-center transition-all cursor-pointer"
                >
                  <Pencil className="w-5 h-5 text-white" />
                </div>
              </div>
            </label>
          </div>

          {/* Cover Photo */}

          <div className="flex flex-col items-start gap-3">
            <label
              htmlFor="cover_photo"
              className="block text-sm font-semibold text-text-primary mb-1 w-full"
            >
              {t('profile.cover_photo', 'Cover Photo')}
              <input
                hidden
                type="file"
                accept="image/*"
                id="cover_photo"
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    cover_photo: e.target.files[0],
                  })
                }
              />
              <div className="group/cover relative mt-2 w-full">
                <img
                  src={
                    editForm.cover_photo
                      ? URL.createObjectURL(editForm.cover_photo)
                      : user.cover_photo
                  }
                  alt=""
                  className="w-full h-40 rounded-xl bg-gradient-to-r from-accent-primary/20 via-purple-500/20 to-pink-500/20 object-cover border border-border-subtle shadow-sm"
                />
                <div
                  className="absolute hidden group-hover/cover:flex inset-0 bg-black/40 rounded-xl items-center justify-center transition-all cursor-pointer"
                >
                  <Pencil className="w-5 h-5 text-white" />
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">
              {t('profile.full_name', 'Full Name')}
            </label>
            <input
              type="text"
              className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
              placeholder={t('profile.enter_full_name', 'Please enter your full name')}
              onChange={(e) =>
                setEditForm({ ...editForm, full_name: e.target.value })
              }
              value={editForm.full_name}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">
              {t('profile.username', 'Username')}
            </label>
            <input
              type="text"
              className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
              placeholder={t('profile.enter_username', 'Please enter your username')}
              onChange={(e) =>
                setEditForm({ ...editForm, username: e.target.value })
              }
              value={editForm.username}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">
              {t('profile.bio', 'Bio')}
            </label>
            <textarea
              rows={3}
              className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
              placeholder={t('profile.enter_bio', 'Please enter a short bio')}
              onChange={(e) =>
                setEditForm({ ...editForm, bio: e.target.value })
              }
              value={editForm.bio}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1">
              {t('profile.location', 'Location')}
            </label>
            <input
              type="text"
              className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
              placeholder={t('profile.enter_location', 'Please enter your location')}
              onChange={(e) =>
                setEditForm({ ...editForm, location: e.target.value })
              }
              value={editForm.location}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                {t('profile.weight', 'Weight (kg)')}
              </label>
              <input
                type="number"
                className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
                placeholder="e.g. 75"
                onChange={(e) =>
                  setEditForm({ ...editForm, weight: e.target.value })
                }
                value={editForm.weight}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1">
                {t('profile.height', 'Height (cm)')}
              </label>
              <input
                type="number"
                className="w-full p-3 bg-background border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-accent-primary shadow-sm"
                placeholder="e.g. 180"
                onChange={(e) =>
                  setEditForm({ ...editForm, height: e.target.value })
                }
                value={editForm.height}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              onClick={() => setShowEdit(false)}
              type="button"
              className="px-5 py-2.5 border border-border-subtle rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-light font-semibold transition shadow-sm cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-accent-primary text-white rounded-xl hover:bg-accent-hover font-semibold transition shadow-sm cursor-pointer"
            >
              {t('profile.save_changes', 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
