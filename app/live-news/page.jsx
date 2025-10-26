'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import NeonIconBar from '../../lobbycomponents/NeonIconBar'; // centered top bar

export default function LiveNewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch('/api/football-news');
        const data = await res.json();
        setNews(data);
      } catch (err) {
        console.error('Failed to load news:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNews();
  }, []);

  return (
    <main className="p-4 sm:p-6 md:p-8 bg-gray-900 min-h-screen text-white">
      {/* centered NeonIconBar at the very top */}
      <div className="sticky top-0 z-40 mb-6 flex items-center justify-center">
        <NeonIconBar current="news" />
      </div>

      <h1 className="text-3xl font-extrabold mb-6 text-yellow-400 uppercase tracking-wide text-center">
        PowerPlay Live News
      </h1>

      {loading ? (
        <p className="text-gray-300 text-center">Loading latest football news...</p>
      ) : news.length === 0 ? (
        <p className="text-red-400 text-center">No news stories available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-800 rounded-xl overflow-hidden shadow-md border border-yellow-500 hover:scale-[1.02] transition-transform flex flex-col"
            >
              <div className="relative h-48 w-full overflow-hidden">
                <Image
                  src={item.image || '/images/placeholder.jpg'}
                  alt={item.title}
                  layout="fill"
                  objectFit="cover"
                  className="opacity-90"
                />
              </div>

              <div className="p-4 flex flex-col justify-between h-full">
                <div>
                  <span className="inline-block text-xs bg-yellow-500 text-black px-2 py-1 rounded-full uppercase font-bold mb-2">
                    {item.tag || 'Top Story'}
                  </span>
                  <h2 className="text-lg font-semibold leading-snug mb-1">
                    {item.title}
                  </h2>
                  {item.team && (
                    <p className="text-sm text-yellow-300">Team: {item.team}</p>
                  )}
                </div>

                <p className="mt-4 text-xs text-gray-400">
                  Source: {item.source || 'Football News'}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}