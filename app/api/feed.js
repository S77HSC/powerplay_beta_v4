// pages/api/feed.js
export default function handler(req, res) {
  const mockFeed = [
    {
      id: "p1",
      user: { name: "Leo Flicks", avatarUrl: "/avatars/leo.png" },
      videoUrl: "/videos/demo.mp4",
      caption: "My new record!",
      touchCount: 42,
      timestamp: Date.now() - 3600000,
      likes: ["u1", "u2"],
      comments: [{ user: "u2", text: "🔥🔥🔥" }],
    },
    // ...more posts
  ];

  res.status(200).json(mockFeed);
}
