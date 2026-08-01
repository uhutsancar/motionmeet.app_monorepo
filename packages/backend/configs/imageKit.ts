import ImageKit from "imagekit";
const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
const imagekit = IMAGEKIT_PUBLIC_KEY && IMAGEKIT_PRIVATE_KEY && IMAGEKIT_URL_ENDPOINT ? new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY, privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL_ENDPOINT.endsWith("/") ? IMAGEKIT_URL_ENDPOINT : `${IMAGEKIT_URL_ENDPOINT}/`,
}) : null;
export default imagekit;
