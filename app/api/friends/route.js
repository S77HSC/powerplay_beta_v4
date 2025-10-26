import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// GET: list friendships for the signed-in user
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json([], { status: 200 });

    const { data: rows, error } = await supabase
      .from("friends")
      .select("id,user_id,friend_id,status,created_at")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!rows?.length) return NextResponse.json([], { status: 200 });

    const ids = Array.from(new Set(rows.flatMap(r => [r.user_id, r.friend_id])));
    const { data: profs, error: pErr } = await supabase
      .from("players")
      .select("auth_id, name, avatar_url, avatarUrl")
      .in("auth_id", ids);
    if (pErr) throw pErr;

    const byId = Object.fromEntries((profs || []).map(p => [p.auth_id, p]));
    const result = rows.map(r => {
      const otherId = r.user_id === user.id ? r.friend_id : r.user_id;
      const other = byId[otherId];
      return {
        ...r,
        displayName: other?.name || "Player",
        displayAvatar: other?.avatarUrl || other?.avatar_url || null,
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("GET /api/friends error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

// POST: create a pending friend row (user_id = me, friend_id = friendId)
export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { friendId } = await req.json();
    if (!friendId) return NextResponse.json({ error: "Missing friendId" }, { status: 400 });
    if (friendId === user.id) return NextResponse.json({ error: "You cannot add yourself" }, { status: 400 });

    const { error } = await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: friendId,
      approved: false,
      parent_approved: false,
      status: "pending",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("POST /api/friends error:", e);
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
