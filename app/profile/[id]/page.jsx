"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const mockFriends = [
  {
    id: "1",
    name: "Max Power",
    avatarUrl: "/avatars/max.png",
    xp: 2400,
    rank: 3,
    country: "GB",
    canMessage: true,
  },
  {
    id: "2",
    name: "Elena Sparks",
    avatarUrl: "/avatars/elena.png",
    xp: 1980,
    rank: 5,
    country: "ES",
    canMessage: false,
  },
];

export default function FriendProfile() {
  const params = useParams();
  const id = params?.id;
  const [friend, setFriend] = useState(null);

  useEffect(() => {
    if (!id) return;
    const found = mockFriends.find((f) => f.id === id);
    setFriend(found);
  }, [id]);

  if (!friend) {
    return <div className="text-white p-4">Friend not found or loading...</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-xl mx-auto bg-gray-800 p-6 rounded-xl shadow-md border border-yellow-500">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden">
            <Image
              src={friend.avatarUrl || "/default-avatar.png"}
              alt={friend.name}
              width={80}
              height={80}
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{friend.name}</h2>
            <p className="text-sm text-gray-400">Country: {friend.country}</p>
            <p className="text-sm text-yellow-400">XP: {friend.xp}</p>
            <p className="text-sm text-blue-400">Rank: #{friend.rank}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            disabled={!friend.canMessage}
            className={`px-4 py-2 text-sm rounded text-white ${friend.canMessage ? "bg-green-500 hover:bg-green-600" : "bg-gray-600 opacity-50 cursor-not-allowed"}`}
          >
            Message
          </button>
          <button
            disabled
            className="px-4 py-2 text-sm rounded text-white bg-gray-600 opacity-50 cursor-not-allowed"
          >
            Challenge
          </button>
          <Link href="/friends">
            <button className="px-4 py-2 text-sm rounded text-white bg-blue-500 hover:bg-blue-600">
              Back to Friends
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}