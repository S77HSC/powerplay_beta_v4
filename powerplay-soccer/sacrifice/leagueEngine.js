// === TEAM NAME GENERATOR ===
export function generateTeamNames(num, customNames = []) {
  const defaultNames = [
    "Sacrifice FC", "Iron Blades", "Crimson Howl", "Ash Vultures",
    "Bloodhounds", "Void Reapers", "Steel Fangs", "Night Heralds",
    "Wraith Legion", "Obsidian Order", "Bone Breakers", "Fire Cult"
  ];
  return customNames.length ? customNames.slice(0, num) : defaultNames.slice(0, num);
}

// === LEAGUE TABLE STRUCTURE ===
export function createLeagueTable(teamNames) {
  return teamNames.map(name => ({
    name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

// === FIXTURE GENERATOR ===
export function generateFixtures(teams, rounds = 1) {
  const fixtures = [];
  const numTeams = teams.length;
  const hasBye = numTeams % 2 !== 0;
  const teamsCopy = [...teams];

  if (hasBye) teamsCopy.push("BYE");

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < numTeams - 1; i++) {
      const matchday = [];
      for (let j = 0; j < numTeams / 2; j++) {
        const home = teamsCopy[j];
        const away = teamsCopy[teamsCopy.length - 1 - j];
        if (home !== "BYE" && away !== "BYE") {
          matchday.push({ home, away });
        }
      }
      fixtures.push({ matchday: i + 1 + r * (numTeams - 1), fixtures: matchday });
      teamsCopy.splice(1, 0, teamsCopy.pop()); // rotate
    }
  }

  return fixtures;
}

// === MATCH SIMULATOR ===
export function simulateMatch() {
  return {
    homeGoals: Math.floor(Math.random() * 5),
    awayGoals: Math.floor(Math.random() * 5),
  };
}

// === STANDINGS UPDATER ===
export function updateStandings(leagueTable, result) {
  const home = leagueTable.find(t => t.name === result.home);
  const away = leagueTable.find(t => t.name === result.away);

  home.played++;
  away.played++;

  home.goalsFor += result.homeGoals;
  home.goalsAgainst += result.awayGoals;
  away.goalsFor += result.awayGoals;
  away.goalsAgainst += result.homeGoals;

  if (result.homeGoals > result.awayGoals) {
    home.wins++;
    home.points += 3;
    away.losses++;
  } else if (result.homeGoals < result.awayGoals) {
    away.wins++;
    away.points += 3;
    home.losses++;
  } else {
    home.draws++;
    away.draws++;
    home.points += 1;
    away.points += 1;
  }
}
