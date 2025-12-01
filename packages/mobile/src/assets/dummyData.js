export const dummyUserData = {
  "_id": "user_2zdFoZib5lNr614LgkONdD8WG32",
  "email": "admin@example.com",
  "full_name": "Uhut Sancar",
  "username": "uhut_sancar",
  "bio": "🌍 Dreamer | 📚 Learner | 🚀 Doer\nExploring life one step at a time.\n✨ Staying curious. Creating with purpose.",
  "profile_picture": "https://avatars.githubusercontent.com/u/189286029?s=400&u=09551cac7123ad16e9f14893c8c140e50267ccaa&v=4",
  "cover_photo": "https://via.placeholder.com/800x400",
  "location": "New York, NY",
  "followers": ["user_2", "user_3"],
  "following": ["user_2", "user_3"],
  "connections": ["user_2", "user_3"],
  "posts": [],
  "is_verified": true,
  "createdAt": "2025-07-09T09:26:59.231Z",
  "updatedAt": "2025-07-21T06:56:50.017Z",
};

const dummyUser2Data = {
  ...dummyUserData,
  _id: "user_2",
  username: "richard_hendricks",
  full_name: "Richard Hendricks",
  profile_picture: "https://i.pravatar.cc/150?img=12",
};

const dummyUser3Data = {
  ...dummyUserData,
  _id: "user_3",
  username: "alexa_james",
  full_name: "Alexa James",
  profile_picture: "https://i.pravatar.cc/150?img=47",
};

export const dummyStoriesData = [
  {
    "_id": "story1",
    "user": dummyUserData,
    "content": "📌 This isn't the story I wanted to tell… not yet.",
    "media_url": "",
    "media_type": "text",
    "background_color": "#4f46e5",
    "createdAt": "2025-07-25T08:16:06.958Z",
  },
  {
    "_id": "story2",
    "user": dummyUser2Data,
    "content": "",
    "media_url": "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg",
    "media_type": "image",
    "background_color": "#4f46e5",
    "createdAt": "2025-07-25T08:27:48.134Z",
  },
  {
    "_id": "story3",
    "user": dummyUser3Data,
    "content": "",
    "media_url": "https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg",
    "media_type": "image",
    "background_color": "#4f46e5",
    "createdAt": "2025-07-25T08:19:31.080Z",
  },
];

export const dummyPostsData = [
  {
    "_id": "post1",
    "user": dummyUserData,
    "content": "We're a small #team with a big vision — working day and night to turn dreams into products.",
    "image_urls": [
      "https://media.istockphoto.com/id/2211259488/photo/young-adult-man-jumping-the-rope-in-gym-before-training.jpg"
    ],
    "post_type": "text_with_image",
    "likes_count": ["user_2"],
    "createdAt": "2025-07-16T05:54:31.191Z",
  },
  {
    "_id": "post2",
    "user": dummyUser2Data,
    "content": "Unlock your potential—every small step counts. Stay consistent, stay focused, and trust the process. 🌱✨\n\n#Motivation #GrowthMindset #DailyInspiration",
    "image_urls": [],
    "post_type": "text",
    "likes_count": [],
    "createdAt": "2025-07-09T13:22:12.601Z",
  },
  {
    "_id": "post3",
    "user": dummyUser3Data,
    "content": "Finally, got the car!",
    "image_urls": [
      "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg"
    ],
    "post_type": "text_with_image",
    "likes_count": [],
    "createdAt": "2025-07-09T09:44:08.626Z",
  },
];
