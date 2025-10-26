// Full merged and updated WorkoutBuilder using dynamic import of BallTouchTrackerFinal

'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { sessionData } from '../../lib/sessionData';
import dynamic from 'next/dynamic';
import confetti from 'canvas-confetti';

const BallTouchTrackerFinal = dynamic(() => import('../../components/BallTouchTrackerFinal'), { ssr: false });

const XP_GOAL = 100;
const REPS = 1;
const REST = 5;

const LEVELS = {
  beginner: 5,
  intermediate: 30,
  advanced: 40,
  elite: 50,
};

export default function WorkoutBuilder() {
  const [player, setPlayer] = useState(null);
  const [points, setPoints] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [workout, setWorkout] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [prepCountdown, setPrepCountdown] = useState(0);
  const [repCountdown, setRepCountdown] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [touchCount, setTouchCount] = useState(0);
  const [touchesPerSkill, setTouchesPerSkill] = useState([]);
  const touchesPerSkillRef = useRef([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [showXpModal, setShowXpModal] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [trackerActive, setTrackerActive] = useState(false);

  useEffect(() => {
    const fetchPlayer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('players').select('*').eq('auth_id', user.id).single();
      if (data) {
        setPlayer(data);
        setPoints(data.points || 0);
      }
    };
    fetchPlayer();
  }, []);

  const prepareWorkout = (level) => {
    setSelectedLevel(level);
    const unlocked = Object.entries(sessionData)
      .filter(([_, s]) => s.unlockXP <= 9999)
      .sort(() => 0.5 - Math.random())
      .slice(0, 4)
      .map(([key, s]) => ({ ...s, key, reps: REPS, time: LEVELS[level], rest: REST }));
    setWorkout(unlocked);
    setIsReady(true);
    setIsRunning(false);
    setIsResting(false);
    setCurrentSkillIndex(0);
    setCurrentRep(0);
    setPrepCountdown(0);
    setRepCountdown(0);
    setTouchCount(0);
    setTouchesPerSkill([]);
    touchesPerSkillRef.current = [];
    const total = unlocked.reduce((sum, s) => sum + (s.time * REPS) + (REST * REPS), 0) - REST;
    setTotalTime(total);
  };

  const startSession = async () => {
    const audio = new Audio('/sounds/VoicesAI_Sonic_Rep_one.mp3');
    audio.play();
    setPrepCountdown(3);
    setTrackerActive(false);

    // Initialize backend before starting session
    try {
      console.log('Backend initialized');
    } catch (err) {
      console.error('Failed to initialize backend tracking:', err);
    }
  };

  useEffect(() => {
  if (prepCountdown === 3) {
    console.log('Session countdown started');
  }
if (prepCountdown > 0) {
      const timer = setTimeout(() => setPrepCountdown(p => p - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (prepCountdown === 0 && isReady && !isRunning) {
      setIsRunning(true);
      setRepCountdown(workout[0]?.time);
      setTimeout(() => setTrackerActive(true), 0);
    }
  }, [prepCountdown]);


  useEffect(() => {
    if (!isRunning || repCountdown <= 0) return;
    const timer = setTimeout(() => setRepCountdown(r => r - 1), 1000);
    const globalTimer = setTimeout(() => setTotalTime(t => t - 1), 1000);
    return () => {
      clearTimeout(timer);
      clearTimeout(globalTimer);
    };
  }, [repCountdown, isRunning]);

  useEffect(() => {
    if (!isRunning || repCountdown > 0) return;
    const current = workout[currentSkillIndex];
    if (isResting) {
      if (currentRep + 1 < REPS) {
        const nextRep = currentRep + 1;
        setCurrentRep(nextRep);
        setIsResting(false);
        setRepCountdown(current.time);
        setTrackerActive(true);
        playAudioForRep(nextRep);
      } else if (currentSkillIndex + 1 < workout.length) {
        const nextSkillIndex = currentSkillIndex + 1;
        setCurrentSkillIndex(nextSkillIndex);
        setCurrentRep(0);
        setIsResting(false);
        setRepCountdown(workout[nextSkillIndex].time);
        setTrackerActive(true);
        playAudio('VoicesAI_Sonic_next_skill.mp3');
        setTimeout(() => playAudio('VoicesAI_Sonic_Rep_one.mp3'), 1500);
      } else {
        playAudio('VoicesAI_Sonic_session_completed.mp3');
        finishWorkout();
      }
    } else {
      setIsResting(true);
      setRepCountdown(REST);
      setTrackerActive(false);
      playAudio('VoicesAI_Sonic_Take_a_break.mp3');
    }
  }, [repCountdown, isRunning]);

  const playAudio = (fileName) => {
    const audio = new Audio(`/sounds/${fileName}`);
    audio.play();
  };

  const playAudioForRep = (rep) => {
    const files = ['VoicesAI_Sonic_Rep_two.mp3', 'VoicesAI_Sonic_Rep_three.mp3'];
    playAudio(files[rep - 1]);
  };

  const handleTouchDetected = (newTouchCount) => {
    setTouchCount(newTouchCount);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);
    setTouchesPerSkill(prev => {
      const updated = [...prev];
      updated[currentSkillIndex] = newTouchCount;
      touchesPerSkillRef.current = updated;
      return updated;
    });
  };

  const finishWorkout = async () => {
    setIsRunning(false);
    setIsReady(false);
    setShowXpModal(true);
    setXpEarned(25);
    try {
      console.log('Backend tracking stopped');

      if (player) {
        const sessionInserts = workout.map((skill, i) => ({
          player_id: player.id,
          completed_at: new Date().toISOString(),
          xr_awarded: 25,
          reps: skill.reps,
          work_time: skill.time,
          rest_time: skill.rest,
          skill_name: skill.name || skill.title,
          touches: touchesPerSkillRef.current[i] || 0,
        }));

        await supabase.from('workout_sessions').insert(sessionInserts);

        await supabase.from('workout_table').insert([
          {
            player_id: player.id,
            level: selectedLevel,
            workout_data: workout.map(w => ({
              name: w.name || w.title,
              reps: w.reps,
              time: w.time,
              rest: w.rest,
            })),
            xp: 25,
            total_touches: touchCount,
            created_at: new Date().toISOString(),
          },
        ]);

        const newPoints = points + 25;
        await supabase.from('players').update({ points: newPoints }).eq('id', player.id);
        setPoints(newPoints);

        if (Math.floor(newPoints / XP_GOAL) > Math.floor(points / XP_GOAL)) {
          confetti({ particleCount: 100, spread: 60 });
        }
      }
    } catch (err) {
      console.error("Error saving session to Supabase:", err);
    } finally {
      setTrackerActive(false);
      resetWorkout();
    }
  };

  const resetWorkout = () => {
    setWorkout([]);
    setCurrentSkillIndex(0);
    setCurrentRep(0);
    setTouchCount(0);
    setTouchesPerSkill([]);
    touchesPerSkillRef.current = [];
    setPrepCountdown(0);
    setRepCountdown(0);
    setSelectedLevel(null);
    setTotalTime(0);
  };

  const current = workout[currentSkillIndex];

  return (
    <main className="relative min-h-screen text-white px-4 py-6 font-sans bg-gradient-to-br from-[#0a0f19] via-[#111827] to-[#0a0f19]">
      <div className="relative z-10 max-w-6xl mx-auto space-y-8 px-4 md:px-8">
        <h2 className="text-center text-sky-400 font-bold text-xl">🏋️ Auto Workout Builder</h2>
        {showXpModal && (
          <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 bg-slate-800 p-6 rounded-xl text-center z-50 shadow-lg">
            <h3 className="text-sky-400 font-bold mb-2 text-lg">🎉 XP Earned!</h3>
            <p className="text-2xl font-bold">{xpEarned} XP</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 justify-center max-w-xs mx-auto">
          {Object.keys(LEVELS).map(level => (
            <button key={level} onClick={() => prepareWorkout(level)} className={`px-4 py-2 rounded-lg font-semibold transition-colors ${selectedLevel === level ? 'bg-sky-500 text-white' : 'bg-slate-800 hover:bg-sky-600 text-white'}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
        {isReady && (
          <>
            <div className="text-center mt-4 text-sm space-y-1">
              <p className="text-sky-300">Total Time Remaining: {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, "0")}</p>
              <p className="text-sky-300">XP: {points} / Level {Math.floor(points / XP_GOAL)}</p>
              <p className="text-green-400 font-extrabold text-4xl">Touches: {touchCount}</p>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-5xl font-extrabold">{prepCountdown > 0 ? `${prepCountdown}` : `${repCountdown}s`}</h2>
              <p className="text-xl text-sky-400">{isResting ? 'Rest' : `Skill ${currentSkillIndex + 1}, Rep ${currentRep + 1}`}</p>
              <div className="flex justify-center gap-4 mt-2">
                <button onClick={startSession} disabled={isRunning || prepCountdown > 0} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded text-lg font-semibold">Start</button>
                {isRunning ? (
                  <button
                    onClick={async () => {
                      setIsRunning(false);
                      setTrackerActive(false);
                      try {
                        console.log('Backend tracking paused');
                      } catch (err) {
                        console.error('Failed to pause backend tracking:', err);
                      }
                    }}
                    className="bg-yellow-600 hover:bg-yellow-500 px-4 py-1 rounded"
                  >Pause</button>
                ) : (
                  <button
                    onClick={() => {
                      setIsRunning(true);
                      setTrackerActive(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded"
                  >Resume</button>
                )}
                <button
                  onClick={async () => {
                    setIsRunning(false);
                    setIsReady(false);
                    try {
                      console.log('Backend tracking stopped (manual)');
                    } catch (err) {
                      console.error('Failed to stop backend tracking:', err);
                    }
                    resetWorkout();
                  }}
                  className="bg-red-600 hover:bg-red-500 px-4 py-1 rounded"
                >Stop</button>
              </div>
            </div>
            <div className="w-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow relative">
                <BallTouchTrackerFinal key={trackerActive ? 'active' : 'inactive'} active={trackerActive} onTouchDetected={handleTouchDetected} />
                {showFlash && <div className="absolute inset-0 bg-green-500 opacity-30 animate-pulse" />}
              </div>
              <div className="bg-slate-800 p-4 rounded-xl space-y-2">
                <h3 className="text-xl font-bold text-sky-400">Session Overview</h3>
                {workout.map((s, i) => (
                  <div key={i} className={`text-sm border-b pb-1 ${i === currentSkillIndex ? 'bg-sky-900/30 rounded' : ''}`}>
                    <p className="font-semibold text-white">Skill {i + 1}: {s.name || s.title}</p>
                    <p className="text-sky-300">{s.reps} Reps × {s.time}s</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}