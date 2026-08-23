import assert from 'node:assert/strict';
import test from 'node:test';

import { MEDIA_WIDTHS, mediaSrcSet, mediaVariantUrl } from '../src/types/media.js';

const STORED = 'https://ik.imagekit.io/motionmeet/posts/user-1/1700000000-abc-photo.jpg?tr=q-auto,f-webp';

test('a display width is merged into the transformation the backend already asked for', () => {
  const feed = mediaVariantUrl(STORED, 'feed');
  assert.match(feed, /tr=q-auto,f-webp,w-720/);
  // The quality and format the upload chose must survive the rewrite.
  assert.ok(feed.includes('q-auto'));
  assert.ok(feed.includes('f-webp'));
});

test('commas stay literal so ImageKit reads a list of transformations', () => {
  assert.ok(!mediaVariantUrl(STORED, 'thumb').includes('%2C'));
  assert.match(mediaVariantUrl(STORED, 'thumb'), new RegExp(`w-${MEDIA_WIDTHS.thumb}`));
});

test('a URL with no transformation yet gets one', () => {
  const bare = 'https://ik.imagekit.io/motionmeet/posts/user-1/photo.jpg';
  assert.equal(mediaVariantUrl(bare, 'avatar'), `${bare}?tr=w-${MEDIA_WIDTHS.avatar}`);
});

test('a width the backend already chose is left alone', () => {
  const sized = 'https://ik.imagekit.io/motionmeet/profiles/user-1/avatar.jpg?tr=w-512,q-auto,f-webp';
  assert.equal(mediaVariantUrl(sized, 'detail'), sized);
});

test('video is never resized', () => {
  const video = 'https://ik.imagekit.io/motionmeet/posts/user-1/clip.mp4';
  assert.equal(mediaVariantUrl(video, 'feed'), video);
});

test('anything that is not an ImageKit URL comes back untouched', () => {
  assert.equal(mediaVariantUrl('/local/asset.png', 'feed'), '/local/asset.png');
  assert.equal(mediaVariantUrl('https://example.com/photo.jpg', 'feed'), 'https://example.com/photo.jpg');
  assert.equal(mediaVariantUrl('not a url', 'feed'), 'not a url');
  // Callers apply this to whatever the API returned, which includes the empty
  // string a member with no avatar has.
  assert.equal(mediaVariantUrl('', 'feed'), '');
  assert.equal(mediaVariantUrl(null, 'feed'), '');
  assert.equal(mediaVariantUrl(undefined, 'feed'), '');
  assert.equal(mediaVariantUrl(42, 'feed'), '');
});

test('srcSet offers the next size up and nothing for a non-resizable URL', () => {
  const set = mediaSrcSet(STORED, 'feed');
  assert.match(set, new RegExp(`w-${MEDIA_WIDTHS.feed}[^,]* ${MEDIA_WIDTHS.feed}w`));
  assert.match(set, new RegExp(`w-${MEDIA_WIDTHS.detail}[^,]* ${MEDIA_WIDTHS.detail}w`));
  assert.equal(mediaSrcSet('https://example.com/photo.jpg', 'feed'), '');
  assert.equal(mediaSrcSet('', 'feed'), '');
});
