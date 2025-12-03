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

export const dummyConnectionsData = [
  dummyUserData,
  dummyUser2Data,
  dummyUser3Data
];

export const dummyMessagesData = [
  {
    "_id": "6878cc3217a54e4d37480122",
    "from_user_id": "user_2zwZSCMRXQ9GaEEVLgm6akQo96i",
    "to_user_id": "user_2zdFoZib5lNr614LgkONdD8WG32",
    "text": "",
    "message_type": "image",
    "media_url": "https://images.pexels.com/photos/106341/pexels-photo-106341.jpeg",
    "createdAt": "2025-07-17T10:10:58.524Z",
    "updatedAt": "2025-07-25T10:43:50.346Z",
    "seen": true
  },
  {
    "_id": "6878cc3c17a54e4d3748012f",
    "from_user_id": "user_2zwZSCMRXQ9GaEEVLgm6akQo96i",
    "to_user_id": "user_2zdFoZib5lNr614LgkONdD8WG32",
    "text": "This is a Samsung Tablet",
    "message_type": "text",
    "media_url": "",
    "createdAt": "2025-07-17T10:11:08.437Z",
    "updatedAt": "2025-07-25T10:43:50.346Z",
    "seen": true
  },
  {
    "_id": "68835ffc6e4b42b685069def",
    "from_user_id": "user_2zdFoZib5lNr614LgkONdD8WG32",
    "to_user_id": "user_2zwZSCMRXQ9GaEEVLgm6akQo96i",
    "text": "yah , this tablet is good",
    "message_type": "text",
    "media_url": "",
    "seen": false,
    "createdAt": "2025-07-25T10:44:12.753Z",
    "updatedAt": "2025-07-25T10:44:12.753Z",
  },
  {
    "_id": "6878cc2817a54e4d3748010c",
    "from_user_id": "user_2zdFoZib5lNr614LgkONdD8WG32",
    "to_user_id": "user_2zwZSCMRXQ9GaEEVLgm6akQo96i",
    "text": "you can purchase it from amazon",
    "message_type": "text",
    "media_url": "",
    "createdAt": "2025-08-17T10:10:48.956Z",
    "updatedAt": "2025-08-25T10:43:50.346Z",
    "seen": true
  },
];

export const dummyRecentMessagesData = [
  {
    "_id": "68833af618623d2de81b5381",
    "from_user_id": dummyUser2Data,
    "to_user_id": dummyUserData,
    "text": "I seen your profile",
    "message_type": "text",
    "media_url": "",
    "seen": true,
    "createdAt": "2025-07-25T08:06:14.436Z",
    "updatedAt": "2025-07-25T08:47:47.768Z",
  },
  {
    "_id": "6878cc3c17a54e4d3748012f",
    "from_user_id": dummyUserData,
    "to_user_id": dummyUserData,
    "text": "This is a Samsung Tablet",
    "message_type": "text",
    "media_url": "",
    "createdAt": "2025-07-17T10:11:08.437Z",
    "updatedAt": "2025-07-25T08:07:11.893Z",
    "seen": true
  },
  {
    "_id": "686fb66c7f0dcbff63b239e7",
    "from_user_id": dummyUser3Data,
    "to_user_id": dummyUserData,
    "text": "how are you",
    "message_type": "text",
    "media_url": "",
    "createdAt": "2025-07-10T12:47:40.510Z",
    "updatedAt": "2025-07-10T12:47:40.510Z",
    "seen": false
  }
];
