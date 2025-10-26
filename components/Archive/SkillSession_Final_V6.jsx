import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import confetti from "canvas-confetti";

export default function SkillSession() {
  const [player, setPlayer] = useState(null);
  const [reps, setReps] = useState(3);
  const [time, setTime] = useState(20);
  const [rest, setRest] = useState(10);
  const [countdown, setCountdown] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [currentRep, setCurrentRep] = useState(0);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(0);
  const intervalRef = useRef(null);

  const XP_MULTIPLIER = 1;
  const XP_GOAL = 100;

  const quotes = [
    "Push yourself. No one else is going to do it for you.",
    "Small progress is still progress.",
    "Train insane or remain the same.",
    "Sweat now. Shine later."
  ];
  const [randomQuote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);

  useEffect(() => {
    const fetchPlayer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("players").select("*").eq("auth_id", user.id).single();
        if (data) {
          const currentPoints = data.points || 0;
          setPlayer(data);
          setPoints(currentPoints);
          setLevel(Math.floor(currentPoints / XP_GOAL));
        }
      }
    };
    fetchPlayer();
  }, []);

  useEffect(() => {
    if (isRunning && countdown > 0) {
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      if (isRunning && countdown === 0) {
        if (isResting) {
          setCountdown(time);
          setIsResting(false);
        } else {
          if (currentRep + 1 >= reps) {
            new Audio("/session-complete.mp3").play().catch(() => {});
            handleXpUpdate();
            setIsRunning(false);
            setIsResting(false);
            setCurrentRep(0);
          } else {
            new Audio("/rest-now.mp3").play().catch(() => {});
            setCountdown(rest);
            setIsResting(true);
            setCurrentRep((prev) => prev + 1);
          }
        }
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, countdown]);

  const startTimer = () => {
    const audio = new Audio("/race-start-beeps-125125.mp3");
    audio.play().then(() => {
      setTimeout(() => {
        setCurrentRep(0);
        setIsResting(false);
        setCountdown(time);
        setIsRunning(true);
      }, 4000);
    }).catch(() => {
      setCurrentRep(0);
      setIsResting(false);
      setCountdown(time);
      setIsRunning(true);
    });
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  };

  const resetTimer = () => {
    stopTimer();
    setCountdown(0);
    setCurrentRep(0);
    setIsResting(false);
  };

  const handleXpUpdate = async () => {
    const gained = reps * time * XP_MULTIPLIER;
    const newPoints = points + gained;
    const newLevel = Math.floor(newPoints / XP_GOAL);

    if (newLevel > level) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    setPoints(newPoints);
    setLevel(newLevel);

    if (player?.id) {
      const payload = {
        player_id: player.id,
        completed_at: new Date().toISOString(),
        xr_awarded: gained,
        reps,
        work_time: time,
        rest_time: rest,
        skill_name: "session_1_toetaps"
      };

      console.log("🧪 Insert payload:", payload);

      const { error } = await supabase.from("workout_sessions").insert(payload);
      if (error) {
        console.error("❌ Supabase insert error:", error.message);
      } else {
        console.log("✅ Session logged successfully.");
      }

      await supabase.from("players").update({ points: newPoints }).eq("id", player.id);
    }
  };

  return (
    <div style={{ backgroundColor: "#0A0F24", color: "#fff", minHeight: "100vh", padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      {player && (
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <img src="/powerplay-logo.png" alt="PowerPlay Logo" style={{ height: "80px", marginBottom: "10px" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img
              src={player.avatar_url?.startsWith("http") ? player.avatar_url : `https://uitlajpnqruvvykrcyyg.supabase.co/storage/v1/object/public/avatars/${player.avatar_url}`}
              alt="avatar"
              style={{ width: "60px", height: "60px", borderRadius: "50%", border: "2px solid #00b4d8", objectFit: "cover" }}
            />
            <p style={{ fontWeight: "bold", fontSize: "18px", margin: 0 }}>{player.name}</p>
            <p style={{ fontSize: "14px", color: "#aaa", margin: 0 }}>{player.country}</p>
          </div>
          <p style={{ fontStyle: "italic", color: "#7dd3fc", marginTop: "12px" }}>{randomQuote}</p>
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <h2 style={{ color: "#38bdf8" }}>Skill Session 1: Toe Taps</h2>
        <video width="100%" controls style={{ borderRadius: "10px", marginBottom: "8px" }}>
          <source src="/videos/session_1_toetaps.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <p style={{ fontSize: "14px", color: "#ddd" }}>Quick footwork drill to improve control and rhythm using alternate toe taps on the ball.</p>
      </div>

      <h3 style={{ fontSize: "20px", color: "#7dd3fc", marginBottom: "1rem" }}>
        {isRunning
          ? isResting
            ? `Set ${currentRep + 1} of ${reps} – Resting`
            : `Set ${currentRep + 1} of ${reps} – Working`
          : countdown === 0 && currentRep === 0
            ? "Ready to Start"
            : "Session Complete"}
      </h3>

      <div style={{ maxWidth: "300px", margin: "0 auto" }}>
        <label>Reps</label>
        <input type="number" value={reps} onChange={(e) => setReps(parseInt(e.target.value))} style={inputStyle} />
        <label>Time (s)</label>
        <input type="number" value={time} onChange={(e) => setTime(parseInt(e.target.value))} style={inputStyle} />
        <label>Rest (s)</label>
        <input type="number" value={rest} onChange={(e) => setRest(parseInt(e.target.value))} style={inputStyle} />
      </div>

      <h2 style={{ fontSize: "48px", margin: "20px 0" }}>{countdown}s</h2>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "2rem" }}>
        <button onClick={startTimer} style={buttonStyle("green")}>Start</button>
        <button onClick={stopTimer} style={buttonStyle("red")}>Stop</button>
        <button onClick={resetTimer} style={buttonStyle("blue")}>Reset</button>
      </div>

      <p style={{ fontSize: "20px" }}>Level {level}</p>
      <p>{points % XP_GOAL} / {XP_GOAL} XP</p>
      <div style={{ width: "300px", height: "16px", backgroundColor: "#333", borderRadius: "8px", overflow: "hidden", margin: "0 auto", boxShadow: "0 0 8px #00b4d8" }}>
        <div style={{ height: "100%", width: `${(points % XP_GOAL / XP_GOAL) * 100}%`, background: "linear-gradient(90deg, #00b4d8, #0077b6)", transition: "width 0.5s ease", borderRadius: "999px" }}></div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  margin: "8px 0",
  fontSize: "16px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  color: "#000",
  backgroundColor: "#fff"
};

const buttonStyle = (color) => ({
  backgroundColor: color,
  color: "white",
  border: "none",
  padding: "10px 20px",
  borderRadius: "6px",
  fontSize: "16px",
  cursor: "pointer"
});