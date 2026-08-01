import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getPosts, createPost, likePostIdempotent, unlikePostIdempotent, deletePost } from '../../api/endpoints';
import { type PayloadAction } from '@reduxjs/toolkit';
import type { Post } from '@motionmeet/shared';

type FeedMode = 'discover' | 'following';
type FetchPostsArgument = string | { token: string; cursor?: string | null; mode?: FeedMode };
interface PostsState { posts: Post[]; nextCursor: string | null; loading: boolean; loadingMore: boolean; error: string | null; mode: FeedMode; activeRequestId: string | null }
interface CreatePostArgument { postData: FormData | (Record<string, unknown> & { operationId?: string }); token: string }
interface LikePostArgument { postId: string; token: string; liked: boolean }
interface DeletePostArgument { postId: string; token: string }

const initialState: PostsState = {
  posts: [],
  nextCursor: null,
  loading: false,
  loadingMore: false,
  error: null,
  mode: 'discover',
  activeRequestId: null,
};

export const fetchPosts = createAsyncThunk<{ posts: Post[]; nextCursor: string | null; append: boolean; mode: FeedMode }, FetchPostsArgument>(
  'posts/fetchPosts',
  async (argument) => {
    const { token, cursor = null, mode = 'discover' } =
      typeof argument === 'string' ? { token: argument, cursor: null, mode: 'discover' as const } : argument;
    const data = await getPosts(token, cursor, mode);
    return data.success
      ? { posts: data.posts, nextCursor: data.nextCursor, append: Boolean(cursor), mode }
      : { posts: [], nextCursor: null, append: Boolean(cursor), mode };
  }
);

export const createNewPost = createAsyncThunk<Post, CreatePostArgument>(
  'posts/createPost',
  async ({ postData, token }) => {
    const data = await createPost(postData, token);
    if (data.success) {
      return data.post;
    } else {
      throw new Error(data.message || 'Post could not be created');
    }
  }
);

export const toggleLikePost = createAsyncThunk<{ postId: string; liked_by_me: boolean; like_count: number }, LikePostArgument>(
  'posts/likePost',
  async ({ postId, token, liked }) => {
    const data = liked
      ? await likePostIdempotent(postId, token)
      : await unlikePostIdempotent(postId, token);
    if (data.success) {
      return {
        postId,
        liked_by_me: data.liked,
        like_count: data.like_count,
      };
    } else {
      throw new Error(data.message || 'Reaction could not be saved');
    }
  }
);

export const removePost = createAsyncThunk<string, DeletePostArgument>(
  'posts/deletePost',
  async ({ postId, token }) => {
    const data = await deletePost(postId, token);
    if (data.success) {
      return postId;
    } else {
      throw new Error(data.message || 'Post could not be deleted');
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    clearPosts: (state) => {
      state.posts = [];
      state.nextCursor = null;
    },
    setAuthorFollowState: (state, action: PayloadAction<{ authorId: string; isFollowing: boolean }>) => {
      const { authorId, isFollowing } = action.payload;
      state.posts.forEach((post) => {
        const postAuthorId = typeof post.user === 'string' ? post.user : post.user._id;
        if (postAuthorId === authorId) {
          post.author_followed_by_me = isFollowing;
        }
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Posts
      .addCase(fetchPosts.pending, (state, action) => {
        const isNextPage =
          typeof action.meta.arg === 'object' && Boolean(action.meta.arg?.cursor);
        if (isNextPage) state.loadingMore = true;
        else {
          state.loading = true;
          state.loadingMore = false;
          state.mode =
            typeof action.meta.arg === 'object'
              ? action.meta.arg?.mode || 'discover'
              : 'discover';
          state.activeRequestId = action.meta.requestId;
        }
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        if (action.payload.mode !== state.mode) return;
        if (
          !action.payload.append &&
          state.activeRequestId !== action.meta.requestId
        ) {
          return;
        }
        if (action.payload.append) {
          const knownIds = new Set(state.posts.map((post) => post._id));
          state.posts.push(
            ...action.payload.posts.filter((post) => !knownIds.has(post._id))
          );
        } else {
          state.posts = action.payload.posts;
        }
        state.nextCursor = action.payload.nextCursor;
        state.loading = false;
        state.loadingMore = false;
        if (!action.payload.append) state.activeRequestId = null;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        const mode =
          typeof action.meta.arg === 'object'
            ? action.meta.arg?.mode || 'discover'
            : 'discover';
        if (mode !== state.mode) return;
        if (
          !(typeof action.meta.arg === 'object' && action.meta.arg?.cursor) &&
          state.activeRequestId !== action.meta.requestId
        ) {
          return;
        }
        state.loading = false;
        state.loadingMore = false;
        state.activeRequestId = null;
        state.error = action.error.message ?? null;
      })
      // Create Post
      .addCase(createNewPost.pending, (state) => {
        state.loading = true;
      })
      .addCase(createNewPost.fulfilled, (state, action) => {
        state.posts.unshift(action.payload);
        state.loading = false;
      })
      .addCase(createNewPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      })
      // Like Post
      .addCase(toggleLikePost.fulfilled, (state, action) => {
        const index = state.posts.findIndex(p => p._id === action.payload.postId);
        if (index !== -1) {
          state.posts[index].liked_by_me = action.payload.liked_by_me;
          state.posts[index].like_count = action.payload.like_count;
        }
      })
      // Delete Post
      .addCase(removePost.fulfilled, (state, action) => {
        state.posts = state.posts.filter(p => p._id !== action.payload);
      });
  },
});

export const { clearPosts, setAuthorFollowState } = postsSlice.actions;
export default postsSlice.reducer;
