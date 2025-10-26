
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Button, StyleSheet, ScrollView,
  TouchableOpacity, Image, FlatList, Switch
} from 'react-native';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [playersA, setPlayersA] = useState([]);
  const [playersB, setPlayersB] = useState([]);
  const [selectedPowerPlaysA, setSelectedPowerPlaysA] = useState([]);
  const [selectedPowerPlaysB, setSelectedPowerPlaysB] = useState([]);
  const powerPlayOptions = ["Overload", "Double Trouble", "Hot Zone"];
  const [activeTeam, setActiveTeam] = useState("");
  const [activePlay, setActivePlay] = useState("");
  const [timer, setTimer] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [matchTime, setMatchTime] = useState(600);
  const [matchRunning, setMatchRunning] = useState(false);

  useEffect(() => {
    let interval = null;
    if (matchRunning && matchTime > 0) {
      interval = setInterval(() => setMatchTime(t => t - 1), 1000);
    } else if (matchTime === 0) {
      setMatchRunning(false);
      setIsActive(false);
      setActiveTeam("");
      setActivePlay("");
    }
    return () => clearInterval(interval);
  }, [matchRunning, matchTime]);

  useEffect(() => {
    let interval = null;
    if (isActive && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && isActive) {
      setIsActive(false);
      setActivePlay("");
      setActiveTeam("");
    }
    return () => clearInterval(interval);
  }, [isActive, timer]);

  const startPowerPlay = (team, play) => {
    setActiveTeam(team);
    setActivePlay(play);
    setTimer(120);
    setIsActive(true);
  };

  const formatTime = (t) => {
    const min = Math.floor(t / 60);
    const sec = t % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const addPlayer = (team) => {
    const name = prompt("Enter player name:");
    if (!name) return;
    const newPlayer = { name, points: 0 };
    if (team === "A") setPlayersA([...playersA, newPlayer]);
    else setPlayersB([...playersB, newPlayer]);
  };

  const updatePoints = (team, index, delta) => {
    const players = team === "A" ? [...playersA] : [...playersB];
    players[index].points += delta;
    if (team === "A") setPlayersA(players);
    else setPlayersB(players);
  };

  const getLeaderboard = () => {
    return [...playersA, ...playersB].sort((a, b) => b.points - a.points);
  };

  const exportCSV = async () => {
    const rows = [["Name", "Points"]];
    getLeaderboard().forEach(p => rows.push([p.name, p.points]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const fileUri = FileSystem.documentDirectory + "leaderboard.csv";
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri);
  };

  const getImageSource = (play) => {
    if (play === "Overload") return require("./assets/overload.png");
    if (play === "Double Trouble") return require("./assets/doubletrouble.png");
    return require("./assets/hotzone.png");
  };

  return (
    <ScrollView style={[styles.container, darkMode && styles.dark]}>
      <View style={styles.header}>
        <Image source={require("./assets/logo.png")} style={styles.logo} />
        <Switch value={darkMode} onValueChange={setDarkMode} />
      </View>

      <View style={styles.row}>
        <TextInput value={teamA} onChangeText={setTeamA} style={styles.input} />
        <Text style={styles.vs}>vs</Text>
        <TextInput value={teamB} onChangeText={setTeamB} style={styles.input} />
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.score}>{scoreA} - {scoreB}</Text>
        <Button title="Reset Score" onPress={() => { setScoreA(0); setScoreB(0); }} />
      </View>

      <View style={styles.timer}>
        <Text style={styles.timerText}>Match Timer: {formatTime(matchTime)}</Text>
        <View style={styles.row}>
          <Button title={matchRunning ? "Pause" : "Start"} onPress={() => setMatchRunning(!matchRunning)} />
          <Button title="Reset" onPress={() => { setMatchRunning(false); setMatchTime(600); }} />
        </View>
      </View>

      {[{ team: teamA, selections: selectedPowerPlaysA, setSelections: setSelectedPowerPlaysA },
        { team: teamB, selections: selectedPowerPlaysB, setSelections: setSelectedPowerPlaysB }]
        .map(({ team, selections, setSelections }) => (
          <View key={team} style={styles.section}>
            <Text style={styles.subheading}>{team} PowerPlays</Text>
            <View style={styles.wrap}>
              {powerPlayOptions.map((play) => (
                <TouchableOpacity
                  key={play}
                  style={styles.playButton}
                  disabled={selections.includes(play) || selections.length >= 2}
                  onPress={() => setSelections([...selections, play])}
                >
                  <Image source={getImageSource(play)} style={styles.icon} />
                  <Text style={styles.playText}>{play}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.wrap}>
              {selections.map((play) => (
                <Button key={play} title={`Start ${team} - ${play}`} onPress={() => startPowerPlay(team, play)} />
              ))}
            </View>
          </View>
        ))}

      <Text style={styles.subheading}>Active Power Play</Text>
      <Text style={styles.active}>{isActive ? `${activeTeam} - ${activePlay} (${formatTime(timer)})` : "None"}</Text>

      {[{ team: teamA, players: playersA, side: "A" },
        { team: teamB, players: playersB, side: "B" }]
        .map(({ team, players, side }) => (
          <View key={team} style={styles.section}>
            <Text style={styles.subheading}>{team} Players</Text>
            <Button title="+ Add Player" onPress={() => addPlayer(side)} />
            {players.map((p, i) => (
              <View key={i} style={styles.playerRow}>
                <Text>{p.name}</Text>
                <View style={styles.row}>
                  <Button title="-" onPress={() => updatePoints(side, i, -1)} />
                  <Text style={styles.points}>{p.points}</Text>
                  <Button title="+" onPress={() => updatePoints(side, i, 1)} />
                </View>
              </View>
            ))}
          </View>
        ))}

      <View style={styles.section}>
        <Text style={styles.subheading}>Leaderboard</Text>
        {getLeaderboard().map((p, i) => (
          <Text key={i}>{p.name} - {p.points} pts</Text>
        ))}
        <Button title="Export CSV" onPress={exportCSV} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  dark: { backgroundColor: "#121212" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  logo: { width: 80, height: 80, resizeMode: "contain" },
  input: { borderBottomWidth: 1, fontSize: 18, padding: 4, width: 120, textAlign: "center" },
  vs: { fontSize: 20, fontWeight: "bold", marginHorizontal: 10 },
  row: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginVertical: 10 },
  scoreRow: { alignItems: "center", marginVertical: 10 },
  score: { fontSize: 32, fontWeight: "bold", marginBottom: 10 },
  timer: { alignItems: "center", marginVertical: 10 },
  timerText: { fontSize: 24, marginBottom: 10 },
  section: { marginVertical: 10 },
  subheading: { fontSize: 18, fontWeight: "bold", marginBottom: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  playButton: { alignItems: "center", margin: 5 },
  playText: { marginTop: 4, fontSize: 10 },
  icon: { width: 50, height: 50, resizeMode: "contain" },
  active: { textAlign: "center", fontSize: 18, marginVertical: 6 },
  playerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 },
  points: { marginHorizontal: 8 }
});
