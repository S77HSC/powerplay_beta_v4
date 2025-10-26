// lib/sessions.js
// Uses your existing client at lib/supabase.js
import { supabase } from './supabase';

/**
 * Inserts a completed workout session and bumps player points.
 * Returns xr_awarded so the UI (modal) can display XP immediately.
 */
export async function saveWorkoutSession({
  skillName,
  reps,
  workSeconds,
  restSeconds,
  touches,
}) {
  // 1) Auth
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const user = auth?.user;
  if (!user) throw new Error('Not signed in');

  // 2) Player row (players.auth_id === user.id)
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, points')
    .eq('auth_id', user.id)
    .single();

  if (playerErr || !player) {
    throw new Error('Player not found for current user (players.auth_id).');
  }

  // 3) Earned XP — simple rule: 1 XP per 4s of work
  const earnedXP = Math.max(0, Math.floor(Number(workSeconds || 0) / 4));

  // 4) Insert session
  const payload = {
    player_id: player.id,
    skill_name: skillName || 'Skill Session',
    reps: Number(reps ?? 0),
    work_time: Number(workSeconds ?? 0),
    rest_time: Number(restSeconds ?? 0),
    touches: Number(touches ?? 0),
    completed_at: new Date().toISOString(),
    // If your schema computes xr_awarded via a trigger, leave it out.
    // If you store it directly in the row, uncomment:
    // xr_awarded: earnedXP,
  };

  // Ask Supabase to return the inserted row so we can read xr_awarded
  const { data: inserted, error: insertErr } = await supabase
    .from('workout_sessions')
    .insert([payload])
    .select('id, xr_awarded')
    .single();

  if (insertErr) throw insertErr;

  // 5) Update points (non-fatal if it fails)
  const newPoints = (player.points || 0) + earnedXP;
  const { error: pointsErr } = await supabase
    .from('players')
    .update({ points: newPoints })
    .eq('id', player.id);

  if (pointsErr) {
    console.warn('Saved session but failed to update points:', pointsErr.message);
  }

  // Mirror xr_awarded at the top level for convenience,
  // and return the inserted session too.
  return {
    earnedXP,
    xr_awarded: Number.isFinite(Number(inserted?.xr_awarded))
      ? Number(inserted.xr_awarded)
      : earnedXP,
    newPoints,
    session: inserted || null,
  };
}
