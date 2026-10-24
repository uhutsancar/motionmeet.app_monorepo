import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getPosts, createPost, likePostIdempotent, unlikePostIdempotent, deletePost } from '../../api/endpoints';
import { type PayloadAction } from '@reduxjs/toolkit';
import type { Post } from '@motionmeet/shared';

type FeedMode = 'discover' | 'following';
type FetchPostsArgument = string | { token: string; cursor?: string | null; mode?: FeedMode };
interface PostsState {
  posts: Post[]; nextCursor: string | null; loading: boolean; loadingMore: boolean; error: string | null; mode: FeedMode; activeRequestId: string | null;
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
  mode: 'discover',
  activeRequestId: null,
  generation: 0,
  appendRequest: null,
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
    /** The server's answer to a like or unlike made from any card showing this post. */
    postLikeSynced: (state, action: PayloadAction<{ postId: string; liked_by_me: boolean; like_count: number }>) => {
      const post = state.posts.find((item) => item._id === action.payload.postId);
      if (!post) return;
      post.liked_by_me = action.payload.liked_by_me;
      post.like_count = action.payload.like_count;
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
        if (isNextPage) {
          state.loadingMore = true;
          state.appendRequest = { requestId: action.meta.requestId, generation: state.generation };
        } else {
          state.loading = true;
          state.loadingMore = false;
          state.mode =
            typeof action.meta.arg === 'object'
              ? action.meta.arg?.mode || 'discover'
              : 'discover';
          state.activeRequestId = action.meta.requestId;
          state.generation += 1;
          state.appendRequest = null;
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
        if (
          action.payload.append &&
          (state.appendRequest?.requestId !== action.meta.requestId ||
            state.appendRequest.generation !== state.generation)
        ) {
          return;
        }
        if (action.payload.append) {
          state.appendRequest = null;
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
        const isNextPage = typeof action.meta.arg === 'object' && Boolean(action.meta.arg?.cursor);
        if (isNextPage) {
          // A failed next page only ends its own spinner; it must not touch a
          // refresh that started after it.
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

export const { postLikeSynced, setAuthorFollowState } = postsSlice.actions;
export default postsSlice.reducer;
