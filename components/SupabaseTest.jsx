"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase"; // this is correct!

export default function SupabaseTest() {
  useEffect(() => {
    const testSupabase = async () => {
      // your read/write test logic here
    };
    testSupabase();
  }, []);

  return (
    <div>
      <h1>Supabase Test</h1>
      <p>Check console for results.</p>
    </div>
  );
}
