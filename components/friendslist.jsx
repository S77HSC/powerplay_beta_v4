import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function FriendsList({ userId }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchFriends = async () => {
      try {
        const res = await fetch(`/api/friends?userId=${userId}`);
        const data = await res.json();
        setFriends(data);
      } catch (error) {
        console.error("Failed to fetch friends:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [userId]);

  if (loading) {
    return <div className="text-gray-300">Loading friends...</div>;
  }

  if (!friends.length) {
    return <div className="text-gray-400">No friends found. Start connecting!</div>;
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-md w-full max-w-2xl mx-auto mt-8 border border-yellow-500">
      <h2 className="text-2xl font-bold text-white mb-4">Your Friends</h2>
      <div className="space-y-4">
        {friends.map((friend) => (
          <div key={friend.id} className="flex flex-col sm:flex-row items-center bg-gray-700 p-4 rounded-lg">
            <div className="w-14 h-14 rounded-full overflow-hidden mr-4 mb-2 sm:mb-0">
              <Image
                src={friend.avatarUrl || "/default-avatar.png"}
                alt={friend.name}
                width={56}
                height={56}
                className="object-cover"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-white font-semibold">{friend.name}</div>
              <div className="text-sm text-gray-400">XP: {friend.xp} • {friend.country}</div>
              {!friend.approvedByParent && (
                <p className="text-xs text-yellow-400 mt-1">🛡️ Pending parental approval</p>
              )}
            </div>
            <div className="flex flex-wrap justify-center sm:justify-end gap-2 mt-3 sm:mt-0">
              <Link href={`/profile/${friend.id}`}>
                <button className="text-xs bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-white">
                  View
                </button>
              </Link>
              <button
                className={`text-xs px-2 py-1 rounded text-white ${
                  friend.canMessage
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-gray-600 opacity-50 cursor-not-allowed"
                }`}
                disabled={!friend.canMessage}
                title={friend.canMessage ? "Send a message" : "Messaging disabled"}
              >
                Message
              </button>
              <button
                disabled
                className="text-xs bg-gray-600 px-2 py-1 rounded text-white opacity-50 cursor-not-allowed"
              >
                Challenge
              </button>
              <button className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}