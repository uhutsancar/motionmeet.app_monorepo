import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getStories, createStory, deleteStory } from '../../api/endpoints';
import type { Story } from '@motionmeet/shared';

interface StoriesState { stories: Story[]; loading: boolean; error: string | null }
interface CreateStoryArgument { storyData: FormData | (Record<string, unknown> & { operationId?: string }); token: string }
interface DeleteStoryArgument { storyId: string; token: string }

const initialState: StoriesState = {
  stories: [],
  loading: false,
  error: null,
};

export const fetchStories = createAsyncThunk<Story[], string>(
  'stories/fetchStories',
  async (token) => {
    const data = await getStories(token);
    return data.success ? data.stories : [];
  }
);

export const createNewStory = createAsyncThunk<Story, CreateStoryArgument>(
  'stories/createStory',
  async ({ storyData, token }) => {
    const data = await createStory(storyData, token);
    if (data.success) {
      return data.story;
    } else {
      throw new Error(data.message || 'Story could not be created');
    }
  }
);

export const removeStory = createAsyncThunk<string, DeleteStoryArgument>(
  'stories/deleteStory',
  async ({ storyId, token }) => {
    const data = await deleteStory(storyId, token);
    if (data.success) {
      return storyId;
    } else {
      throw new Error(data.message || 'Story could not be deleted');
    }
  }
);

const storiesSlice = createSlice({
  name: 'stories',
  initialState,
  reducers: {
    clearStories: (state) => {
      state.stories = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Stories
      .addCase(fetchStories.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchStories.fulfilled, (state, action) => {
        state.stories = action.payload;
        state.loading = false;
      })
      .addCase(fetchStories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      })
      // Create Story
      .addCase(createNewStory.pending, (state) => {
        state.loading = true;
      })
      .addCase(createNewStory.fulfilled, (state, action) => {
        state.stories.unshift(action.payload);
        state.loading = false;
      })
      .addCase(createNewStory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      })
      // Delete Story
      .addCase(removeStory.fulfilled, (state, action) => {
        state.stories = state.stories.filter(s => s._id !== action.payload);
      });
  },
});

export const { clearStories } = storiesSlice.actions;
export default storiesSlice.reducer;
