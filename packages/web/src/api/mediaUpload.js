import axios from "axios";
import api from "./axios";
import { API_ROUTES } from "@motionmeet/shared";

export const uploadMedia = async (file, purpose, token) => {
  if (!(file instanceof File)) throw new Error("A valid media file is required");
  const { data } = await api.post(
    API_ROUTES.media.presign,
    {
      purpose,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  await axios.put(data.uploadUrl, file, {
    headers: data.headers,
    timeout: 120000,
    maxBodyLength: Infinity,
  });
  return data.key;
};
