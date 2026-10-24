import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { Post } from "@motionmeet/shared";
import { createPost, deletePost, getFeed, likePostIdempotent, unlikePostIdempotent } from "~/api/endpoints";

type FeedMode = "discover" | "following";
type FetchPostsArgument = string | { token: string; cursor?: string | null; mode?: FeedMode };
interface PostsState {
  posts: Post[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  mode: FeedMode;
  activeRequestId: string | null;
  /**
   * Bumped whenever a first page is requested. A next-page request remembers
   * the generation it was made for, so a page that lands after a refresh has
   * started is dropped instead of being appended to the new list.
   */
  generation: number;
  appendRequest: { requestId: string; generation: number } | null;
}
interface CreatePostArgument { postData: FormData | (Record<string, unknown> & { operationId?: string }); token: string }
interface LikePostArgument { postId: string; token: string; liked: boolean }
interface DeletePostArgument { postId: string; token: string }

const initialState: PostsState = {
  posts: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  mode: "discover",
  activeRequestId: null,
  generation: 0,
  appendRequest: null,
};

export const fetchPosts = createAsyncThunk<
  { posts: Post[]; nextCursor: string | null; append: boolean; mode: FeedMode },
  FetchPostsArgument
>("posts/fetchPosts", async (argument) => {
  const { token, cursor = null, mode = "discover" } =
    typeof argument === "string" ? { token: argument, cursor: null, mode: "discover" as const } : argument;
  const data = await getFeed(token, cursor, mode);
  return data.success
    ? { posts: data.posts, nextCursor: data.nextCursor, append: Boolean(cursor), mode }
    : { posts: [], nextCursor: null, append: Boolean(cursor), mode };
});

export const createNewPost = createAsyncThunk<Post, CreatePostArgument>(
  "posts/createPost",
  async ({ postData, token }) => {
    const data = await createPost(postData, token);
    if (!data.success) throw new Error(data.message || "Post could not be created");
    return data.post;
  },
);

export const toggleLikePost = createAsyncThunk<
  { postId: string; liked_by_me: boolean; like_count: number },
  LikePostArgument
>("posts/likePost", async ({ postId, token, liked }) => {
  const data = liked
    ? await likePostIdempotent(postId, token)
    : await unlikePostIdempotent(postId, token);
  if (!data.success) throw new Error(data.message || "Reaction could not be saved");
  return { postId, liked_by_me: data.liked, like_count: data.like_count };
});

export const removePost = createAsyncThunk<string, DeletePostArgument>(
  "posts/deletePost",
  async ({ postId, token }) => {
    const data = await deletePost(postId, token);
    if (!data.success) throw new Error(data.message || "Post could not be deleted");
    return postId;
  },
);

const argumentCursor = (argument: FetchPostsArgument): string | null =>
  typeof argument === "object" ? argument.cursor ?? null : null;
const argumentMode = (argument: FetchPostsArgument): FeedMode =>
  typeof argument === "object" ? argument.mode || "discover" : "discover";

const postsSlice = createSlice({
  name: "posts",
  initialState,
  reducers: {
    setAuthorFollowState: (state, action: PayloadAction<{ authorId: string; isFollowing: boolean }>) => {
      const { authorId, isFollowing } = action.payload;
      state.posts.forEach((post) => {
        const postAuthorId = typeof post.user === "string" ? post.user : post.user._id;
        if (postAuthorId === authorId) post.author_followed_by_me = isFollowing;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state, action) => {
        if (argumentCursor(action.meta.arg)) {
          state.loadingMore = true;
          state.appendRequest = { requestId: action.meta.requestId, generation: state.generation };
          return;
        }
        state.loading = true;
        state.loadingMore = false;
        state.mode = argumentMode(action.meta.arg);
        state.activeRequestId = action.meta.requestId;
        state.generation += 1;
        state.appendRequest = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        // A mode switch or a newer first page makes this answer obsolete.
        if (action.payload.mode !== state.mode) return;
        if (!action.payload.append && state.activeRequestId !== action.meta.requestId) return;
        if (
          action.payload.append &&
          (state.appendRequest?.requestId !== action.meta.requestId || state.appendRequest.generation !== state.generation)
        ) return;
        if (action.payload.append) {
          state.appendRequest = null;
          const knownIds = new Set(state.posts.map((post) => post._id));
          state.posts.push(...action.payload.posts.filter((post) => !knownIds.has(post._id)));
        } else {
          state.posts = action.payload.posts;
        }
        state.nextCursor = action.payload.nextCursor;
        state.loading = false;
        state.loadingMore = false;
        if (!action.payload.append) state.activeRequestId = null;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        if (argumentMode(action.meta.arg) !== state.mode) return;
        if (argumentCursor(action.meta.arg)) {
          // A failed next page only ends its own spinner, never a later refresh.
          if (state.appendRequest?.requestId !== action.meta.requestId) return;
          state.appendRequest = null;
          state.loadingMore = false;
          state.error = action.error.message ?? null;
          return;
        }
        if (state.activeRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.loadingMore = false;
        state.activeRequestId = null;
        state.error = action.error.message ?? null;
      })
      .addCase(createNewPost.fulfilled, (state, action) => {
        state.posts.unshift(action.payload);
      })
      .addCase(createNewPost.rejected, (state, action) => {
        state.error = action.error.message ?? null;
      })
      .addCase(toggleLikePost.fulfilled, (state, action) => {
        const post = state.posts.find((item) => item._id === action.payload.postId);
        if (post) {
          post.liked_by_me = action.payload.liked_by_me;
          post.like_count = action.payload.like_count;
        }
      })
      .addCase(removePost.fulfilled, (state, action) => {
        state.posts = state.posts.filter((post) => post._id !== action.payload);
      });
  },
});

export const { setAuthorFollowState } = postsSlice.actions;
export default postsSlice.reducer;
