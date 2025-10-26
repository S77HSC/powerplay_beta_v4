
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [playersA, setPlayersA] = useState([]);
  const [playersB, setPlayersB] = useState([]);
  const [matchTime, setMatchTime] = useState(600);
  const [matchRunning, setMatchRunning] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let interval = null;
    if (matchRunning && matchTime > 0) {
      interval = setInterval(() => setMatchTime(t => t - 1), 1000);
    } else if (matchTime === 0) {
      setMatchRunning(false);
      saveMatch();
    }
    return () => clearInterval(interval);
  }, [matchRunning, matchTime]);

  const formatTime = (t) => {
    const minutes = Math.floor(t / 60);
    const seconds = t % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const addPlayer = (team) => {
    const name = prompt("Enter player name:");
    if (!name) return;
    const newPlayer = { name, points: 0 };
    team === "A" ? setPlayersA([...playersA, newPlayer]) : setPlayersB([...playersB, newPlayer]);
  };

  const updatePoints = (team, index, delta) => {
    const players = [...(team === "A" ? playersA : playersB)];
    players[index].points += delta;
    team === "A" ? setPlayersA(players) : setPlayersB(players);
  };

  const saveMatch = () => {
    const match = {
      teamA, teamB, scoreA, scoreB,
      playersA: playersA.map(p => ({ ...p })),
      playersB: playersB.map(p => ({ ...p })),
      time: new Date().toLocaleString()
    };
    setHistory([...history, match]);
  };

  const exportCSV = async () => {
    let csv = "Match Time,Team A,Team B,Score A,Score B\n";
    history.forEach(m => {
      csv += `${m.time},${m.teamA},${m.teamB},${m.scoreA},${m.scoreB}\n`;
    });
    const fileUri = FileSystem.documentDirectory + "match_history.csv";
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    Sharing.shareAsync(fileUri);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>PowerPlay Soccer</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} value={teamA} onChangeText={setTeamA} />
        <Text style={styles.vs}>vs</Text>
        <TextInput style={styles.input} value={teamB} onChangeText={setTeamB} />
      </View>

      <View style={styles.score}>
        <Text style={styles.scoreText}>{scoreA} : {scoreB}</Text>
      </View>
      <View style={styles.row}>
        <Button title={`+1 ${teamA}`} onPress={() => setScoreA(scoreA + 1)} />
        <Button title={`+1 ${teamB}`} onPress={() => setScoreB(scoreB + 1)} />
      </View>

      <Text style={styles.timer}>Match Time: {formatTime(matchTime)}</Text>
      <View style={styles.row}>
        <Button title={matchRunning ? "Pause" : "Start"} onPress={() => setMatchRunning(!matchRunning)} />
        <Button title="Reset" onPress={() => { setMatchRunning(false); setMatchTime(600); }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{teamA} Players</Text>
        <Button title="Add Player" onPress={() => addPlayer("A")} />
        {playersA.map((p, i) => (
          <View key={i} style={styles.playerRow}>
            <Text>{p.name}</Text>
            <View style={styles.playerScore}>
              <Button title="-" onPress={() => updatePoints("A", i, -1)} />
              <Text>{p.points}</Text>
              <Button title="+" onPress={() => updatePoints("A", i, 1)} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{teamB} Players</Text>
        <Button title="Add Player" onPress={() => addPlayer("B")} />
        {playersB.map((p, i) => (
          <View key={i} style={styles.playerRow}>
            <Text>{p.name}</Text>
            <View style={styles.playerScore}>
              <Button title="-" onPress={() => updatePoints("B", i, -1)} />
              <Text>{p.points}</Text>
              <Button title="+" onPress={() => updatePoints("B", i, 1)} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Match History</Text>
        <Button title="Export as CSV" onPress={exportCSV} />
        {history.map((m, i) => (
          <Text key={i}>{m.time}: {m.teamA} {m.scoreA} - {m.scoreB} {m.teamB}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
  input: { borderBottomWidth: 1, flex: 1, marginHorizontal: 5, fontSize: 18 },
  vs: { fontSize: 18, alignSelf: 'center' },
  score: { alignItems: 'center', marginVertical: 20 },
  scoreText: { fontSize: 40, fontWeight: 'bold' },
  timer: { fontSize: 24, textAlign: 'center', marginVertical: 10 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  playerScore: { flexDirection: 'row', alignItems: 'center', gap: 5 }
});
