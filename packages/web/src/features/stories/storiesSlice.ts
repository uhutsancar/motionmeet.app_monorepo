import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { Story } from "@motionmeet/shared";
import { createStory, deleteStory, getStories } from "~/api/endpoints";

interface StoriesState { stories: Story[]; loading: boolean; error: string | null }
interface CreateStoryArgument { storyData: FormData | (Record<string, unknown> & { operationId?: string }); token: string }
interface DeleteStoryArgument { storyId: string; token: string }

const initialState: StoriesState = {
  stories: [],
  loading: false,
  error: null,
};

export const fetchStories = createAsyncThunk<Story[], string>(
  "stories/fetchStories",
  async (token) => {
    const data = await getStories(token);
    return data.success ? data.stories : [];
  },
);

export const createNewStory = createAsyncThunk<Story, CreateStoryArgument>(
  "stories/createStory",
  async ({ storyData, token }) => {
    const data = await createStory(storyData, token);
    if (!data.success) throw new Error(data.message || "Story could not be created");
    return data.story;
  },
);

export const removeStory = createAsyncThunk<string, DeleteStoryArgument>(
  "stories/deleteStory",
  async ({ storyId, token }) => {
    const data = await deleteStory(storyId, token);
    if (!data.success) throw new Error(data.message || "Story could not be deleted");
    return storyId;
  },
);

const storiesSlice = createSlice({
  name: "stories",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
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
      .addCase(createNewStory.fulfilled, (state, action) => {
        state.stories.unshift(action.payload);
      })
      .addCase(createNewStory.rejected, (state, action) => {
        state.error = action.error.message ?? null;
      })
      .addCase(removeStory.fulfilled, (state, action) => {
        state.stories = state.stories.filter((story) => story._id !== action.payload);
      });
  },
});
export default storiesSlice.reducer;
