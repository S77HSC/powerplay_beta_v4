// utils/supabaseUtils.js
import { supabase } from "../lib/supabase";

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
