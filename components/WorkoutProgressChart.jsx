// components/WorkoutProgressChart.jsx
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchWorkoutHistory } from '../utils/supabaseUtils';

const WorkoutProgressChart = ({ playerId }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const loadWorkoutData = async () => {
      const { data: workoutData, error } = await fetchWorkoutHistory(playerId);
      if (error) {
        console.error("Error loading workout history:", error);
      } else {
        const formatted = workoutData.map(entry => ({
          date: new Date(entry.timestamp).toLocaleDateString(),
          xp: entry.xp,
        }));
        setData(formatted);
      }
    };

    if (playerId) loadWorkoutData();
  }, [playerId]);

  return (
    <div className="w-full h-[300px]">
      <div className="mb-4 text-sm">
  <p><strong>Touches Today:</strong> {touchesToday}</p>
  <p><strong>Touches This Week:</strong> {touchesThisWeek}</p>
  <p><strong>Average Daily Touches:</strong> {avgDaily}</p>
  <p><strong>Average Weekly Touches:</strong> {avgWeekly}</p>
  <p className="mt-2 italic text-cyan-400">
    {touchesToday >= avgDaily
      ? "🔥 You're above your daily average!"
      : "⏳ Keep going! You're below your daily average."}
  </p>
  <p className="italic text-cyan-400">
    {touchesThisWeek >= avgWeekly
      ? "✅ Crushing your weekly average!"
      : "📉 You're under your weekly average – one more session could change that!"}
  </p>
</div>

      <h2 className="text-xl font-semibold mb-2">Workout Progress</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" label={{ value: 'XP', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Touches', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Line yAxisId="left" type="monotone" dataKey="xp" stroke="#8884d8" strokeWidth={2} name="XP" />
          <Line yAxisId="right" type="monotone" dataKey="touches" stroke="#00b4d8" strokeWidth={2} name="Touches" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkoutProgressChart;
