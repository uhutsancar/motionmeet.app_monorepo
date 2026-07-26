import ImageKit from "imagekit";

let imagekit = null;

if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
    let endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!endpoint.endsWith('/')) endpoint += '/';

    imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: endpoint
    });
} else {
    console.warn("ImageKit credentials are missing from environment variables. Image uploads will be disabled.");
}

export default imagekit;
