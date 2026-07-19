import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getPosts, createPost, likePost, deletePost } from '../../api/endpoints';

const initialState = {
  posts: [],
  loading: false,
  error: null,
};

export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (token) => {
    const data = await getPosts(token);
    return data.success ? data.posts : [];
  }
);

export const createNewPost = createAsyncThunk(
  'posts/createPost',
  async ({ postData, token }) => {
    const data = await createPost(postData, token);
    if (data.success) {
      return data.post;
    } else {
      throw new Error(data.message);
    }
  }
);

export const toggleLikePost = createAsyncThunk(
  'posts/likePost',
  async ({ postId, token }) => {
    const data = await likePost(postId, token);
    if (data.success) {
      return { postId, likes_count: data.likes_count || [] };
    } else {
      throw new Error(data.message);
    }
  }
);

export const removePost = createAsyncThunk(
  'posts/deletePost',
  async ({ postId, token }) => {
    const data = await deletePost(postId, token);
    if (data.success) {
      return postId;
    } else {
      throw new Error(data.message);
    }
  }
);

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    clearPosts: (state) => {
      state.posts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Posts
      .addCase(fetchPosts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.posts = action.payload;
        state.loading = false;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
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
        state.error = action.error.message;
      })
      // Like Post
      .addCase(toggleLikePost.fulfilled, (state, action) => {
        const index = state.posts.findIndex(p => p._id === action.payload.postId);
        if (index !== -1) {
          state.posts[index].likes_count = action.payload.likes_count;
        }
      })
      // Delete Post
      .addCase(removePost.fulfilled, (state, action) => {
        state.posts = state.posts.filter(p => p._id !== action.payload);
      });
  },
});

export const { clearPosts } = postsSlice.actions;
export default postsSlice.reducer;
