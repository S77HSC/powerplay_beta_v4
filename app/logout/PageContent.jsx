
'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LogoutPage() {
  const router = useRouter();
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const logout = async () => {
      await supabase.auth.signOut();
      setLoggedOut(true);
    };

    logout();
  }, []);

  if (!loggedOut) {
    return null; // or a loading spinner if you prefer
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <img
        src="/powerplay-logo.png"
        alt="PowerPlay Logo"
        className="w-48 sm:w-56 md:w-64 lg:w-72 xl:w-80 mb-6"
      />
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">
        Thanks for using PowerPlay Soccer
      </h1>
      <button
        onClick={() => router.push('/login')}
        className="mt-4 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-lg font-semibold"
      >
        Log In Again
      </button>
    </div>
  );
}
