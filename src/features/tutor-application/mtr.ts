export type MtrLine = {
  id: string;
  label: string;
  stations: string[];
  routes?: Array<{ stations: string[]; minutes: number[] }>;
};

export const MTR_LINES: MtrLine[] = [
  { id: "island", label: "Island Line", stations: ["Kennedy Town", "HKU", "Sai Ying Pun", "Sheung Wan", "Central", "Admiralty", "Wan Chai", "Causeway Bay", "Tin Hau", "Fortress Hill", "North Point", "Quarry Bay", "Tai Koo", "Sai Wan Ho", "Shau Kei Wan", "Heng Fa Chuen", "Chai Wan"], routes: [{ stations: ["Kennedy Town", "HKU", "Sai Ying Pun", "Sheung Wan", "Central", "Admiralty", "Wan Chai", "Causeway Bay", "Tin Hau", "Fortress Hill", "North Point", "Quarry Bay", "Tai Koo", "Sai Wan Ho", "Shau Kei Wan", "Heng Fa Chuen", "Chai Wan"], minutes: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] }] },
  { id: "tsuen-wan", label: "Tsuen Wan Line", stations: ["Central", "Admiralty", "Tsim Sha Tsui", "Jordan", "Yau Ma Tei", "Mong Kok", "Prince Edward", "Sham Shui Po", "Cheung Sha Wan", "Lai Chi Kok", "Mei Foo", "Lai King", "Kwai Fong", "Kwai Hing", "Tai Wo Hau", "Tsuen Wan"], routes: [{ stations: ["Central", "Admiralty", "Tsim Sha Tsui", "Jordan", "Yau Ma Tei", "Mong Kok", "Prince Edward", "Sham Shui Po", "Cheung Sha Wan", "Lai Chi Kok", "Mei Foo", "Lai King", "Kwai Fong", "Kwai Hing", "Tai Wo Hau", "Tsuen Wan"], minutes: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3] }] },
  { id: "kwun-tong", label: "Kwun Tong Line", stations: ["Whampoa", "Ho Man Tin", "Yau Ma Tei", "Mong Kok", "Prince Edward", "Shek Kip Mei", "Kowloon Tong", "Lok Fu", "Wong Tai Sin", "Diamond Hill", "Choi Hung", "Kowloon Bay", "Ngau Tau Kok", "Kwun Tong", "Lam Tin", "Yau Tong", "Tiu Keng Leng"], routes: [{ stations: ["Whampoa", "Ho Man Tin", "Yau Ma Tei", "Mong Kok", "Prince Edward", "Shek Kip Mei", "Kowloon Tong", "Lok Fu", "Wong Tai Sin", "Diamond Hill", "Choi Hung", "Kowloon Bay", "Ngau Tau Kok", "Kwun Tong", "Lam Tin", "Yau Tong", "Tiu Keng Leng"], minutes: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] }] },
  { id: "tseung-kwan-o", label: "Tseung Kwan O Line", stations: ["North Point", "Quarry Bay", "Yau Tong", "Tiu Keng Leng", "Tseung Kwan O", "Hang Hau", "Po Lam", "LOHAS Park"], routes: [{ stations: ["North Point", "Quarry Bay", "Yau Tong", "Tiu Keng Leng", "Tseung Kwan O", "Hang Hau", "Po Lam"], minutes: [2, 3, 2, 3, 2, 3] }, { stations: ["Tseung Kwan O", "LOHAS Park"], minutes: [5] }] },
  { id: "south-island", label: "South Island Line", stations: ["Admiralty", "Ocean Park", "Wong Chuk Hang", "Lei Tung", "South Horizons"], routes: [{ stations: ["Admiralty", "Ocean Park", "Wong Chuk Hang", "Lei Tung", "South Horizons"], minutes: [4, 2, 3, 2] }] },
  { id: "east-rail", label: "East Rail Line", stations: ["Admiralty", "Exhibition Centre", "Hung Hom", "Mong Kok East", "Kowloon Tong", "Tai Wai", "Sha Tin", "Fo Tan", "University", "Tai Po Market", "Tai Wo", "Fanling", "Sheung Shui", "Lo Wu", "Lok Ma Chau"], routes: [{ stations: ["Admiralty", "Exhibition Centre", "Hung Hom", "Mong Kok East", "Kowloon Tong", "Tai Wai", "Sha Tin", "Fo Tan", "University", "Tai Po Market", "Tai Wo", "Fanling", "Sheung Shui", "Lo Wu"], minutes: [3, 2, 2, 3, 3, 3, 2, 4, 4, 3, 4, 3, 8] }, { stations: ["Sheung Shui", "Lok Ma Chau"], minutes: [9] }] },
  { id: "tuen-ma", label: "Tuen Ma Line", stations: ["Tuen Mun", "Siu Hong", "Tin Shui Wai", "Long Ping", "Yuen Long", "Kam Sheung Road", "Tsuen Wan West", "Mei Foo", "Austin", "East Tsim Sha Tsui", "Hung Hom", "Ho Man Tin", "To Kwa Wan", "Sung Wong Toi", "Kai Tak", "Diamond Hill", "Hin Keng", "Tai Wai", "Che Kung Temple", "Sha Tin Wai", "City One", "Shek Mun", "Tai Shui Hang", "Heng On", "Ma On Shan", "Wu Kai Sha"], routes: [{ stations: ["Tuen Mun", "Siu Hong", "Tin Shui Wai", "Long Ping", "Yuen Long", "Kam Sheung Road", "Tsuen Wan West", "Mei Foo", "Austin", "East Tsim Sha Tsui", "Hung Hom", "Ho Man Tin", "To Kwa Wan", "Sung Wong Toi", "Kai Tak", "Diamond Hill", "Hin Keng", "Tai Wai", "Che Kung Temple", "Sha Tin Wai", "City One", "Shek Mun", "Tai Shui Hang", "Heng On", "Ma On Shan", "Wu Kai Sha"], minutes: [4, 4, 3, 3, 7, 8, 3, 4, 3, 3, 2, 2, 2, 2, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 3] }] },
  { id: "tung-chung", label: "Tung Chung Line", stations: ["Hong Kong", "Kowloon", "Olympic", "Nam Cheong", "Lai King", "Tsing Yi", "Sunny Bay", "Tung Chung", "Disneyland Resort"], routes: [{ stations: ["Hong Kong", "Kowloon", "Olympic", "Nam Cheong", "Lai King", "Tsing Yi", "Sunny Bay", "Tung Chung"], minutes: [3, 3, 3, 4, 3, 5, 6] }, { stations: ["Sunny Bay", "Disneyland Resort"], minutes: [4] }] },
  { id: "other", label: "Other Areas", stations: ["Light Rail areas", "Airport", "Outlying Islands", "Discovery Bay", "Remote / flexible location"] },
];

export function toggleLineStations(selectedStations: string[], line: MtrLine): string[] {
  const includesEveryStation = line.stations.every((station) => selectedStations.includes(station));
  if (includesEveryStation) return selectedStations.filter((station) => !line.stations.includes(station));
  return [...new Set([...selectedStations, ...line.stations])];
}

export type MtrStationCoordinate = { latitude: number; longitude: number };

// Approximate station positions are used only to turn browser GPS into a station origin.
// Destination suggestions always come from the line graph below, never from distance.
const STATION_COORDINATES: Record<string, MtrStationCoordinate> = {
  "Kennedy Town": { latitude: 22.2819, longitude: 114.1267 },
  HKU: { latitude: 22.2849, longitude: 114.1371 },
  "Sai Ying Pun": { latitude: 22.2861, longitude: 114.1445 },
  "Sheung Wan": { latitude: 22.2868, longitude: 114.1514 },
  Central: { latitude: 22.2819, longitude: 114.1582 },
  Admiralty: { latitude: 22.2797, longitude: 114.165 },
  "Wan Chai": { latitude: 22.277, longitude: 114.172 },
  "Causeway Bay": { latitude: 22.2801, longitude: 114.184 },
  "North Point": { latitude: 22.2916, longitude: 114.2004 },
  "Quarry Bay": { latitude: 22.2881, longitude: 114.2095 },
  "Tai Koo": { latitude: 22.2848, longitude: 114.2163 },
  "Shau Kei Wan": { latitude: 22.2783, longitude: 114.2283 },
  "Chai Wan": { latitude: 22.2647, longitude: 114.2375 },
  "Tsim Sha Tsui": { latitude: 22.297, longitude: 114.172 },
  Jordan: { latitude: 22.3048, longitude: 114.1719 },
  "Yau Ma Tei": { latitude: 22.3126, longitude: 114.1706 },
  "Mong Kok": { latitude: 22.3193, longitude: 114.1694 },
  "Prince Edward": { latitude: 22.3249, longitude: 114.1682 },
  "Kowloon Tong": { latitude: 22.3372, longitude: 114.1765 },
  "Wong Tai Sin": { latitude: 22.3419, longitude: 114.193 },
  "Diamond Hill": { latitude: 22.3401, longitude: 114.201 },
  "Kowloon Bay": { latitude: 22.3231, longitude: 114.2134 },
  "Kwun Tong": { latitude: 22.3129, longitude: 114.226 },
  "Lam Tin": { latitude: 22.3073, longitude: 114.2329 },
  "Tiu Keng Leng": { latitude: 22.3049, longitude: 114.2522 },
  "Tseung Kwan O": { latitude: 22.3074, longitude: 114.26 },
  "Hang Hau": { latitude: 22.315, longitude: 114.264 },
  "Ocean Park": { latitude: 22.2489, longitude: 114.1736 },
  "Hung Hom": { latitude: 22.3028, longitude: 114.182 },
  "Tai Wai": { latitude: 22.3726, longitude: 114.178 },
  "Sha Tin": { latitude: 22.3828, longitude: 114.187 },
  University: { latitude: 22.4133, longitude: 114.209 },
  "Tai Po Market": { latitude: 22.4445, longitude: 114.169 },
  Fanling: { latitude: 22.492, longitude: 114.139 },
  "Tuen Mun": { latitude: 22.395, longitude: 113.973 },
  "Yuen Long": { latitude: 22.445, longitude: 114.034 },
  "Tsuen Wan West": { latitude: 22.368, longitude: 114.109 },
  "Mei Foo": { latitude: 22.337, longitude: 114.14 },
  "Hong Kong": { latitude: 22.2849, longitude: 114.158 },
  Kowloon: { latitude: 22.3048, longitude: 114.161 },
  "Olympic": { latitude: 22.318, longitude: 114.16 },
  "Tung Chung": { latitude: 22.29, longitude: 113.943 },
};

const ROUTING_LINES = MTR_LINES.filter((line) => line.id !== "other");
const INTERCHANGE_MINUTES: Record<string, number> = {
  Admiralty: 5,
  "Hong Kong": 8,
  "Tsim Sha Tsui": 6,
  "East Tsim Sha Tsui": 6,
  "Kowloon Tong": 4,
  "Lai King": 4,
  "Mei Foo": 5,
  "Nam Cheong": 4,
  "North Point": 4,
  "Quarry Bay": 4,
  "Yau Ma Tei": 3,
  "Ho Man Tin": 4,
  "Diamond Hill": 4,
  "Tai Wai": 4,
  "Hung Hom": 4,
  "Tiu Keng Leng": 3,
  "Yau Tong": 3,
};
const STATION_LINKS: Record<string, string[]> = {
  Central: ["Hong Kong"],
  "Hong Kong": ["Central"],
  "Tsim Sha Tsui": ["East Tsim Sha Tsui"],
  "East Tsim Sha Tsui": ["Tsim Sha Tsui"],
};

export const MTR_STATION_OPTIONS = [...new Set(ROUTING_LINES.flatMap((line) => line.stations))];

type RouteState = { station: string; lineId: string };

function stateKey(state: RouteState) {
  return `${state.lineId}:${state.station}`;
}

function lineNeighbors(line: MtrLine, station: string) {
  const neighbors: Array<{ station: string; minutes: number }> = [];
  for (const route of line.routes ?? []) {
    const index = route.stations.indexOf(station);
    if (index > 0) neighbors.push({ station: route.stations[index - 1], minutes: route.minutes[index - 1] });
    if (index >= 0 && index < route.stations.length - 1)
      neighbors.push({ station: route.stations[index + 1], minutes: route.minutes[index] });
  }
  return neighbors;
}

/** Returns stations reachable within an estimated rail + transfer time budget. */
export function getReachableMtrStations(origin: string, maxMinutes: number): string[] {
  const distances = new Map<string, number>();
  const queue: Array<{ state: RouteState; minutes: number }> = [];
  for (const line of ROUTING_LINES) {
    if (line.stations.includes(origin)) {
      const state = { station: origin, lineId: line.id };
      distances.set(stateKey(state), 0);
      queue.push({ state, minutes: 0 });
    }
  }

  while (queue.length) {
    queue.sort((a, b) => a.minutes - b.minutes);
    const current = queue.shift();
    if (!current || current.minutes > maxMinutes) continue;
    const line = ROUTING_LINES.find((candidate) => candidate.id === current.state.lineId);
    if (!line) continue;

    for (const neighbor of lineNeighbors(line, current.state.station)) {
      const next = { station: neighbor.station, lineId: line.id };
      const minutes = current.minutes + neighbor.minutes;
      const key = stateKey(next);
      if ((distances.get(key) ?? Infinity) > minutes) {
        distances.set(key, minutes);
        queue.push({ state: next, minutes });
      }
    }

    for (const interchangeLine of ROUTING_LINES) {
      if (interchangeLine.id === line.id || !interchangeLine.stations.includes(current.state.station)) continue;
      const next = { station: current.state.station, lineId: interchangeLine.id };
      const minutes = current.minutes + (INTERCHANGE_MINUTES[current.state.station] ?? 4);
      const key = stateKey(next);
      if ((distances.get(key) ?? Infinity) > minutes) {
        distances.set(key, minutes);
        queue.push({ state: next, minutes });
      }
    }

    for (const linkedStation of STATION_LINKS[current.state.station] ?? []) {
      for (const interchangeLine of ROUTING_LINES) {
        if (!interchangeLine.stations.includes(linkedStation)) continue;
        const next = { station: linkedStation, lineId: interchangeLine.id };
        const minutes = current.minutes + (INTERCHANGE_MINUTES[current.state.station] ?? 4);
        const key = stateKey(next);
        if ((distances.get(key) ?? Infinity) > minutes) {
          distances.set(key, minutes);
          queue.push({ state: next, minutes });
        }
      }
    }
  }

  return MTR_STATION_OPTIONS.filter((station) =>
    [...distances].some(([key, minutes]) => key.endsWith(`:${station}`) && minutes <= maxMinutes),
  );
}

function distanceSquared(a: MtrStationCoordinate, b: MtrStationCoordinate) {
  const latitudeScale = Math.cos((a.latitude * Math.PI) / 180);
  return (a.latitude - b.latitude) ** 2 + ((a.longitude - b.longitude) * latitudeScale) ** 2;
}

/** Finds the nearest station with maintained coordinates; GPS never determines destinations. */
export function getNearestMtrStation(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const origin = { latitude, longitude };
  return MTR_STATION_OPTIONS.filter((station) => STATION_COORDINATES[station]).reduce<string | null>(
    (nearest, station) => {
      if (!nearest) return station;
      return distanceSquared(origin, STATION_COORDINATES[station]) <
        distanceSquared(origin, STATION_COORDINATES[nearest])
        ? station
        : nearest;
    },
    null,
  );
}