// app/api/feed/route.js
export async function GET() {
  const mockFeed = [
    {
      id: "p1",
      user: { name: "Leo Flicks", avatarUrl: "/avatars/leo.png" },
      videoUrl: "/videos/demo.mp4",
      caption: "My new record!",
      touchCount: 42,
      timestamp: 1753438931264,
      likes: ["u1", "u2"],
      comments: [{ user: "u2", text: "🔥🔥🔥" }],
    },
  ];

  return Response.json(mockFeed);
}
