import { createRequire } from "node:module";
import type ImageKit from "imagekit";

type UrlOptions = Parameters<ImageKit["url"]>[0];

const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
const configured = Boolean(IMAGEKIT_PUBLIC_KEY && IMAGEKIT_PRIVATE_KEY && IMAGEKIT_URL_ENDPOINT);

let client: ImageKit | null = null;

/**
 * The SDK is only ever used to build media URLs, and nothing on the boot path
 * builds one - yet importing it cost ~340ms of every start. It is required on
 * first use instead. `imagekit` is CommonJS, so createRequire loads it
 * synchronously and `url()` keeps its signature: callers still see either null
 * (not configured) or something with a synchronous `url`.
 */
const instance = (): ImageKit => {
  if (!client) {
    const ImageKitConstructor = createRequire(import.meta.url)("imagekit") as typeof ImageKit;
    client = new ImageKitConstructor({
      publicKey: IMAGEKIT_PUBLIC_KEY as string,
      privateKey: IMAGEKIT_PRIVATE_KEY as string,
      urlEndpoint: (IMAGEKIT_URL_ENDPOINT as string).endsWith("/")
        ? (IMAGEKIT_URL_ENDPOINT as string)
        : `${IMAGEKIT_URL_ENDPOINT as string}/`,
    });
  }
  return client;
};

const imagekit = configured
  ? { url: (options: UrlOptions): string => instance().url(options) }
  : null;

export default imagekit;
