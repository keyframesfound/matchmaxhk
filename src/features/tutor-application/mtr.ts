export type MtrLine = {
  id: string;
  label: string;
  stations: string[];
};

export const MTR_LINES: MtrLine[] = [
  { id: "island", label: "Island Line", stations: ["Kennedy Town", "HKU", "Sai Ying Pun", "Sheung Wan", "Central", "Admiralty", "Wan Chai", "Causeway Bay", "Tin Hau", "Fortress Hill", "North Point", "Quarry Bay", "Tai Koo", "Sai Wan Ho", "Shau Kei Wan", "Heng Fa Chuen", "Chai Wan"] },
  { id: "tsuen-wan", label: "Tsuen Wan Line", stations: ["Central", "Admiralty", "Tsim Sha Tsui", "Jordan", "Yau Ma Tei", "Mong Kok", "Prince Edward", "Shek Kip Mei", "Kowloon Tong", "Lok Fu", "Wong Tai Sin", "Diamond Hill", "Choi Hung", "Kowloon Bay", "Ngau Tau Kok", "Kwun Tong", "Lam Tin", "Yau Tong", "Tiu Keng Leng"] },
  { id: "kwun-tong", label: "Kwun Tong Line", stations: ["Whampoa", "Ho Man Tin", "Yau Ma Tei", "Mong Kok", "Prince Edward", "Shek Kip Mei", "Kowloon Tong", "Lok Fu", "Wong Tai Sin", "Diamond Hill", "Choi Hung", "Kowloon Bay", "Ngau Tau Kok", "Kwun Tong", "Lam Tin", "Yau Tong", "Tiu Keng Leng"] },
  { id: "tseung-kwan-o", label: "Tseung Kwan O Line", stations: ["North Point", "Quarry Bay", "Yau Tong", "Tiu Keng Leng", "Tseung Kwan O", "Hang Hau", "Po Lam", "LOHAS Park"] },
  { id: "south-island", label: "South Island Line", stations: ["Admiralty", "Ocean Park", "Wong Chuk Hang", "Lei Tung", "South Horizons"] },
  { id: "east-rail", label: "East Rail Line", stations: ["Admiralty", "Exhibition Centre", "Hung Hom", "Mong Kok East", "Kowloon Tong", "Tai Wai", "Sha Tin", "Fo Tan", "University", "Tai Po Market", "Tai Wo", "Fanling", "Sheung Shui", "Lo Wu", "Lok Ma Chau"] },
  { id: "tuen-ma", label: "Tuen Ma Line", stations: ["Tuen Mun", "Siu Hong", "Tin Shui Wai", "Long Ping", "Yuen Long", "Kam Sheung Road", "Tsuen Wan West", "Mei Foo", "Austin", "East Tsim Sha Tsui", "Hung Hom", "Ho Man Tin", "To Kwa Wan", "Sung Wong Toi", "Kai Tak", "Diamond Hill", "Hin Keng", "Tai Wai", "Che Kung Temple", "Sha Tin Wai", "City One", "Shek Mun", "Tai Shui Hang", "Heng On", "Ma On Shan", "Wu Kai Sha"] },
  { id: "tung-chung", label: "Tung Chung Line", stations: ["Hong Kong", "Kowloon", "Olympic", "Nam Cheong", "Lai King", "Tsing Yi", "Sunny Bay", "Tung Chung"] },
  { id: "other", label: "Other Areas", stations: ["Light Rail areas", "Airport", "Outlying Islands", "Discovery Bay", "Remote / flexible location"] },
];

export function toggleLineStations(selectedStations: string[], line: MtrLine): string[] {
  const includesEveryStation = line.stations.every((station) => selectedStations.includes(station));
  if (includesEveryStation) return selectedStations.filter((station) => !line.stations.includes(station));
  return [...new Set([...selectedStations, ...line.stations])];
}