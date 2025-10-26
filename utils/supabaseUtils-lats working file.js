// utils/supabaseUtils.js
import { supabase } from "../lib/supabase";

// ✔️ Get current logged-in user
export async function getCurrentUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  return { user: session?.user, error };
}

// ✔️ Logout function
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// ✔️ Update workout count
export async function updateWorkoutCount(playerName) {
  if (!playerName) return;

  const { data, error } = await supabase
    .from("players")
    .select("workouts_completed")
    .eq("name", playerName)
    .single();

  if (error) {
    console.error("Error fetching player:", error);
    return;
  }

  const currentCount = data?.workouts_completed || 0;

  const { error: updateError } = await supabase
    .from("players")
    .update({ workouts_completed: currentCount + 1 })
    .eq("name", playerName);

  if (updateError) {
    console.error("Error updating workouts:", updateError);
  } else {
    console.log("✅ Workout count updated!");
  }
}

// ✔️ Fetch workout history for chart
export async function fetchWorkoutHistory(authId) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("completed_at, xp_awarded")
    .eq("auth_id", authId)
    .order("completed_at", { ascending: true });

  if (error) {
    console.error("Error fetching workout history:", error);
    return { data: [], error };
  }

  return {
    data: data.map((session) => ({
      timestamp: session.completed_at,
      xp: session.xp_awarded,
    })),
    error: null,
  };
}


