interface HerpstatPreset {
  baskDay: number;
  baskNight: number;
  rhpDay: number;
  rhpNight: number;
  highAlarm: number;
  lowAlarm: number;
}

export interface SpeciesPreset {
  name: string;
  latin: string;
  morphs: string[];
  minTempF: number;
  maxTempF: number;
  minHumidity: number;
  maxHumidity: number;
  herpstat: HerpstatPreset;
}

export const SPECIES: SpeciesPreset[] = [
  {
    name: 'Ball Python',
    latin: 'Python regius',
    morphs: ['Normal', 'Mojave'],
    minTempF: 75,
    maxTempF: 90,
    minHumidity: 50,
    maxHumidity: 95,
    herpstat: {baskDay: 92, baskNight: 82, rhpDay: 88, rhpNight: 78, highAlarm: 93, lowAlarm: 72},
  },
  {
    name: 'California King',
    latin: 'Lampropeltis californiae',
    morphs: [],
    minTempF: 70,
    maxTempF: 86,
    minHumidity: 30,
    maxHumidity: 60,
    herpstat: {baskDay: 90, baskNight: 78, rhpDay: 84, rhpNight: 74, highAlarm: 89, lowAlarm: 68},
  },
  {
    name: 'Mexican Black King',
    latin: 'Lampropeltis getula nigrita',
    morphs: [],
    minTempF: 70,
    maxTempF: 86,
    minHumidity: 40,
    maxHumidity: 65,
    herpstat: {baskDay: 90, baskNight: 78, rhpDay: 84, rhpNight: 74, highAlarm: 89, lowAlarm: 68},
  },
  {
    name: 'Pueblan Milk',
    latin: 'Lampropeltis triangulum campbelli',
    morphs: [],
    minTempF: 68,
    maxTempF: 85,
    minHumidity: 40,
    maxHumidity: 65,
    herpstat: {baskDay: 89, baskNight: 76, rhpDay: 83, rhpNight: 72, highAlarm: 88, lowAlarm: 66},
  },
  {
    name: 'Hognose',
    latin: 'Heterodon nasicus',
    morphs: ['Brown'],
    minTempF: 70,
    maxTempF: 88,
    minHumidity: 30,
    maxHumidity: 60,
    herpstat: {baskDay: 94, baskNight: 80, rhpDay: 86, rhpNight: 74, highAlarm: 91, lowAlarm: 68},
  },
];

export const findSpecies = (s: string | null | undefined) =>
  s ? SPECIES.find(p => p.name.toLowerCase() === s.toLowerCase() || p.latin.toLowerCase() === s.toLowerCase()) : undefined;
