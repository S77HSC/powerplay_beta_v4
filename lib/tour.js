// lib/tour.js
import { sessionData } from './sessionData';
// Optional: keep this file if you still store a few coords there (lat/lng only)
import { stadiumCoords } from './stadiumCoords';

/** Stadium name → precise stadium coordinates (covers every stadium in sessionData.js) */
const COORDS_BY_STADIUM = {
  'Wembley Stadium':              { lat: 51.5560, lng: -0.2796 },
  'Old Trafford':                 { lat: 53.4631, lng: -2.2913 },
  'Signal Iduna Park':            { lat: 51.4926, lng: 7.4519 },
  'San Siro':                     { lat: 45.4781, lng: 9.1240 },
  'Parc des Princes':             { lat: 48.8414, lng: 2.2530 },
  'Camp Nou':                     { lat: 41.3809, lng: 2.1228 },
  'Santiago Bernabéu':            { lat: 40.4531, lng: -3.6883 },
  'Stade Vélodrome':              { lat: 43.2699, lng: 5.3958 },
  'Estádio do Dragão':            { lat: 41.1621, lng: -8.5851 },
  'Rose Bowl':                    { lat: 34.1613, lng: -118.1675 },
  'Allianz Arena':                { lat: 48.2188, lng: 11.6247 },
  'Celtic Park':                  { lat: 55.8497, lng: -4.2055 },
  'Ibrox Stadium':                { lat: 55.8531, lng: -4.3090 },
  'La Bombonera':                 { lat: -34.6356, lng: -58.3645 },
  'FNB Stadium (Soccer City)':    { lat: -26.2349, lng: 27.9820 },
  'Sydney Stadium':               { lat: -33.8908, lng: 151.2249 }, // Sydney Football Stadium (Allianz)
  'Amsterdam Arena':              { lat: 52.3143, lng: 4.9414 },    // Johan Cruijff ArenA
  'MetLife Stadium':              { lat: 40.8135, lng: -74.0745 },
};

/** Location string → city-center coordinates (covers all locations in sessionData.js) */
const COORDS_BY_LOCATION = {
  'London, UK':                 { lat: 51.5074, lng: -0.1278 },
  'Manchester, UK':             { lat: 53.4808, lng: -2.2426 },
  'Dortmund, Germany':          { lat: 51.5136, lng: 7.4653 },
  'Milan, Italy':               { lat: 45.4642, lng: 9.1900 },
  'Paris, France':              { lat: 48.8566, lng: 2.3522 },
  'Barcelona, Spain':           { lat: 41.3874, lng: 2.1686 },
  'Madrid, Spain':              { lat: 40.4168, lng: -3.7038 },
  'Marseille, France':          { lat: 43.2965, lng: 5.3698 },
  'Porto, Portugal':            { lat: 41.1496, lng: -8.6109 },
  'Pasadena, USA':              { lat: 34.1478, lng: -118.1445 },
  'Munich, Germany':            { lat: 48.1351, lng: 11.5820 },
  'Glasgow, Scotland':          { lat: 55.8642, lng: -4.2518 },
  'Buenos Aires, Argentina':    { lat: -34.6037, lng: -58.3816 },
  'Johannesburg, South Africa': { lat: -26.2041, lng: 28.0473 },
  'Sydney, Australia':          { lat: -33.8688, lng: 151.2093 },
  'Amsterdam, Netherlands':     { lat: 52.3676, lng: 4.9041 },
  'East Rutherford, USA':       { lat: 40.8339, lng: -74.0970 },
};

const WEMBLEY = { lat: 51.5560, lng: -0.2796 };

const onlyCoords = (o) => ({
  lat: typeof o?.lat === 'number' ? o.lat : undefined,
  lng: typeof o?.lng === 'number' ? o.lng : undefined,
});

/**
 * Coordinate resolution priority:
 * 1) sessionData[id].lat/lng (if present)
 * 2) stadiumCoords[id].lat/lng (if you keep that file)
 * 3) COORDS_BY_STADIUM[session.stadium]
 * 4) COORDS_BY_LOCATION[session.location]
 * 5) Wembley fallback
 */
function resolveCoords(id, s) {
  // 1) direct in session
  if (typeof s?.lat === 'number' && typeof s?.lng === 'number') {
    return { lat: s.lat, lng: s.lng };
  }
  // 2) from optional coords file (lat/lng only)
  const fromTable = onlyCoords(stadiumCoords?.[id]);
  if (typeof fromTable.lat === 'number' && typeof fromTable.lng === 'number') {
    return fromTable;
  }
  // 3) by stadium name
  const byStadium = COORDS_BY_STADIUM[s?.stadium || ''];
  if (byStadium) return byStadium;
  // 4) by location string
  const byLocation = COORDS_BY_LOCATION[s?.location || ''];
  if (byLocation) return byLocation;
  // 5) final fallback
  return WEMBLEY;
}

/** Build the World Tour list (sessionData is source of truth). */
export function getTour() {
  const tour = Object.entries(sessionData).map(([id, s]) => {
    const { lat, lng } = resolveCoords(id, s);
    return { id, ...s, lat, lng };
  });
  tour.sort((a, b) => (Number(a.unlockXP) || 0) - (Number(b.unlockXP) || 0));

  // Dev hint: warn if we had to fall back to Wembley for a non-Wembley session
  if (process.env.NODE_ENV !== 'production') {
    tour.forEach((t) => {
      const c = resolveCoords(t.id, t);
      if (c.lat === WEMBLEY.lat && c.lng === WEMBLEY.lng && t.stadium !== 'Wembley Stadium') {
        // eslint-disable-next-line no-console
        console.warn('[tour] Missing coords for:', t.id, `(${t.stadium} • ${t.location})`);
      }
    });
  }
  return tour;
}

/** Convenience helpers */
export function getUnlockState(points = 0) {
  const xp = Number(points) || 0;
  const tour = getTour();
  const unlocked = tour.filter((s) => xp >= (Number(s.unlockXP) || 0));
  const unlockedCount = unlocked.length;
  return {
    tour,
    unlocked,
    unlockedCount,
    current: unlocked[unlockedCount - 1] || null,
    next: tour[unlockedCount] || null,
  };
}

export function getStop(id) {
  if (!id) return null;
  const s = sessionData?.[id];
  if (!s) return null;
  const { lat, lng } = resolveCoords(id, s);
  return { id, ...s, lat, lng };
}
