/**
 * Imported by signedMedia.test.ts before anything that reads ImageKit's
 * configuration, so the test signs with throwaway credentials whatever the
 * developer's `.env` holds (dotenv never overrides a variable already set).
 * Not a test file (the integration glob only picks up `*.test.ts`).
 */
process.env.IMAGEKIT_PUBLIC_KEY = "public_integration_test";
process.env.IMAGEKIT_PRIVATE_KEY = "private_integration_test";
process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/motionmeet-test";
delete process.env.MEDIA_SIGNED_DELIVERY;

export const IMAGEKIT_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;
