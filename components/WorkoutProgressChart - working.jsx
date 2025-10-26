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
      <h2 className="text-xl font-semibold mb-2">Workout Progress</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: 'XP', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Line type="monotone" dataKey="xp" stroke="#8884d8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkoutProgressChart;
