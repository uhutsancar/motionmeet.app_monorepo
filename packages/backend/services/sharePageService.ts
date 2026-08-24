import type { Post, PublicUser } from "@motionmeet/shared";
import { buildPostDeepLink, buildPostShareUrl } from "@motionmeet/shared";
import { database } from "../configs/database.js";
import { loadEnvironment } from "../configs/environment.js";
import { findHydratedPost } from "../repositories/postRepository.js";

/**
 * The public face of a shared post.
 *
 * A MotionMeet link is opened far more often by a link-preview crawler than by
 * a person — WhatsApp, Telegram, Discord, Slack and Facebook all fetch the URL
 * before anyone taps it, and none of them run JavaScript. That is the whole
 * reason this page is rendered on the server rather than left to the web
 * client: the Open Graph tags have to be in the HTML that comes back from the
 * first request, or the link is a bare blue string wherever it is pasted.
 *
 * Everything here is public by construction. A post is only rendered when its
 * own visibility is `public` *and* its author's account is public; anything
 * else answers with the same "not available" page, at 404, carrying no title,
 * no picture and no author name. Knowing the id of a private post must not be
 * enough to read it, and it must not be enough to learn that it exists either.
 */

export interface SharePagePost {
  post: Post;
  author: PublicUser;
  /** First image or video still, when the post has one. */
  previewImage: string | null;
}

const MAX_DESCRIPTION = 200;

/** Trims a caption to something a preview card can hold without a wall of text. */
const summarize = (content: string): string => {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_DESCRIPTION) return collapsed;
  return `${collapsed.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
};

/**
 * Loads a post if — and only if — it is safe to show to a stranger.
 *
 * Both gates are checked here rather than trusted from the caller: the post's
 * own visibility, and the author's account privacy. A public post by a private
 * account stays unlisted, which is what someone who locks their account expects
 * of every surface, this one included.
 */
export const findPublicPost = async (postId: string): Promise<SharePagePost | null> => {
  const row = await database
    .selectFrom("posts")
    .innerJoin("users as author", "author.id", "posts.user_id")
    .select(["posts.id", "posts.visibility", "author.privacy_public_profile"])
    .where("posts.id", "=", postId)
    .executeTakeFirst();

  if (!row) return null;
  if (row.visibility !== "public") return null;
  if (!row.privacy_public_profile) return null;

  const post = await findHydratedPost(postId);
  if (!post) return null;

  const author = typeof post.user === "object" ? post.user : null;
  if (!author) return null;

  const previewImage = post.media?.find((entry) => entry.mediaType === "image")?.url
    ?? post.image_urls?.[0]
    ?? null;

  return { post, author, previewImage };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * The shell both pages share.
 *
 * Deliberately one small self-contained document: no bundle to download, no
 * font to fetch, nothing that has to succeed before the page reads. Someone who
 * followed a link from a chat is here to see one photo and decide whether to
 * open the app, and that should not cost them a second of loading.
 */
const documentShell = ({
  title,
  head,
  body,
  status,
}: {
  title: string;
  head: string;
  body: string;
  status: number;
}): { html: string; status: number } => ({
  status,
  html: `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
${head}
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: radial-gradient(120% 90% at 20% 0%, #16203A 0%, #0B1220 45%, #070B15 100%);
    color: #F4F3FA;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .card { width: 100%; max-width: 420px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .brand svg { width: 30px; height: 30px; }
  .brand span { font-size: 15px; font-weight: 700; letter-spacing: 0.2px; }
  figure { margin: 0 0 16px; border-radius: 18px; overflow: hidden; background: rgba(255,255,255,0.06); }
  figure img { display: block; width: 100%; height: auto; }
  .author { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .author img, .author .initial {
    width: 38px; height: 38px; border-radius: 50%; object-fit: cover;
    background: rgba(255,255,255,0.12); display: grid; place-items: center;
    font-weight: 700; font-size: 15px;
  }
  .author strong { display: block; font-size: 15px; font-weight: 650; }
  .author small { color: rgba(244,243,250,0.6); font-size: 13px; }
  p.caption { margin: 0 0 20px; font-size: 15px; color: rgba(244,243,250,0.86); white-space: pre-wrap; }
  .cta {
    display: block; text-align: center; text-decoration: none;
    padding: 14px 18px; border-radius: 14px; font-weight: 700; font-size: 15px;
    color: #FFFFFF; background: linear-gradient(120deg, #2563EB, #22D3EE);
  }
  .cta.secondary { margin-top: 10px; background: rgba(255,255,255,0.1); font-weight: 600; }
  .notice { text-align: center; padding: 40px 8px; }
  .notice h1 { font-size: 19px; font-weight: 700; margin: 16px 0 8px; }
  .notice p { margin: 0; color: rgba(244,243,250,0.66); font-size: 14.5px; }
</style>
</head>
<body>
${body}
</body>
</html>`,
});

/** The mark, inlined — one request for the whole page, images included. */
const BRAND_MARK = `<svg viewBox="0 0 512 512" role="img" aria-label="MotionMeet">
<defs>
<linearGradient id="mmStroke" x1="96" y1="128" x2="416" y2="384" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#3B82F6"/><stop offset=".55" stop-color="#2FA9F4"/><stop offset="1" stop-color="#22D3EE"/>
</linearGradient>
</defs>
<path d="M112 380V166l144 138 144-138v214" fill="none" stroke="url(#mmStroke)" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * The page a link resolves to when the post is not there for this reader.
 *
 * The same page answers "deleted", "private" and "followers only" on purpose.
 * A distinct message for each would tell whoever holds the URL which one it is,
 * and that is information about a post they were never given access to.
 */
export const renderUnavailablePage = (): { html: string; status: number } =>
  documentShell({
    status: 404,
    title: "MotionMeet",
    head: [
      '<meta name="robots" content="noindex">',
      '<meta property="og:site_name" content="MotionMeet">',
      '<meta property="og:title" content="MotionMeet">',
    ].join("\n"),
    body: `<main class="card">
  <div class="notice">
    <div class="brand" style="justify-content:center">${BRAND_MARK}<span>MotionMeet</span></div>
    <h1>Bu gönderi artık mevcut değil</h1>
    <p>Bağlantı kaldırılmış olabilir ya da gönderi herkese açık değil.</p>
    <a class="cta" style="margin-top:24px" href="${escapeHtml(loadEnvironment().frontendUrl)}">MotionMeet'e katıl</a>
  </div>
</main>`,
  });

/** The page a public post resolves to. */
export const renderPostPage = (entry: SharePagePost): { html: string; status: number } => {
  const { post, author, previewImage } = entry;
  const name = author.full_name || author.username || "MotionMeet";
  const caption = summarize(post.content || "");
  const description = caption || `${name} MotionMeet'te bir gönderi paylaştı.`;
  const shareUrl = buildPostShareUrl(loadEnvironment().frontendUrl, post.id);
  const deepLink = buildPostDeepLink(post.id);
  const title = `${name} · MotionMeet`;

  const head = [
    `<link rel="canonical" href="${escapeHtml(shareUrl)}">`,
    '<meta property="og:site_name" content="MotionMeet">',
    '<meta property="og:type" content="article">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(shareUrl)}">`,
    previewImage ? `<meta property="og:image" content="${escapeHtml(previewImage)}">` : "",
    // Without an image the card is a one-line summary, which is what `summary`
    // is for; a large card with an empty picture box looks broken.
    `<meta name="twitter:card" content="${previewImage ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    previewImage ? `<meta name="twitter:image" content="${escapeHtml(previewImage)}">` : "",
    `<meta name="description" content="${escapeHtml(description)}">`,
    // Lets an installed app take the link over on iOS without a redirect that a
    // crawler would follow instead of reading the tags above.
    `<meta property="al:ios:url" content="${escapeHtml(deepLink)}">`,
    `<meta property="al:android:url" content="${escapeHtml(deepLink)}">`,
    '<meta property="al:android:package" content="app.motionmeet.mobile">',
    '<meta property="al:ios:app_name" content="MotionMeet">',
    '<meta property="al:android:app_name" content="MotionMeet">',
  ]
    .filter(Boolean)
    .join("\n");

  const avatar = author.profile_picture
    ? `<img src="${escapeHtml(author.profile_picture)}" alt="" width="38" height="38">`
    : `<span class="initial">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;

  const body = `<main class="card">
  <div class="brand">${BRAND_MARK}<span>MotionMeet</span></div>
  ${previewImage ? `<figure><img src="${escapeHtml(previewImage)}" alt="${escapeHtml(description)}"></figure>` : ""}
  <div class="author">
    ${avatar}
    <div>
      <strong>${escapeHtml(name)}</strong>
      ${author.username ? `<small>@${escapeHtml(author.username)}</small>` : ""}
    </div>
  </div>
  ${caption ? `<p class="caption">${escapeHtml(caption)}</p>` : ""}
  <a class="cta" href="${escapeHtml(deepLink)}">MotionMeet'te aç</a>
  <a class="cta secondary" href="${escapeHtml(loadEnvironment().frontendUrl)}">MotionMeet'e katıl</a>
</main>`;

  return documentShell({ title, head, body, status: 200 });
};
