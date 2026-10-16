import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'sunny' | 'cloudy' | 'rainy';
export type Environment = { season: Season; weather: Weather };

export const seasons: { id: Season; label: string; short: string }[] = [
  { id: 'spring', label: 'Spring', short: 'Spring' },
  { id: 'summer', label: 'Summer', short: 'Summer' },
  { id: 'autumn', label: 'Autumn', short: 'Autumn' },
  { id: 'winter', label: 'Winter', short: 'Winter' },
];

export const weathers: { id: Weather; label: string }[] = [
  { id: 'sunny', label: 'Clear' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'rainy', label: 'Rain' },
];

export const HALF = 12;
export const WATER_LEVEL = 0.18;
export const FLOOR = -1.65;
export const CABIN = { x: -4.7, z: 0.1 };
const noise = new ImprovedNoise();

export function random(seed = 84) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function n2(x: number, z: number) {
  return noise.noise(x, z, 4.73);
}

export function fbm(x: number, z: number) {
  return n2(x, z) * 0.58 + n2(x * 2.03, z * 2.03) * 0.27 + n2(x * 4.13, z * 4.13) * 0.15;
}

export function shore(x: number) {
  return 2.8 - x * 0.55 + 1.4 * Math.sin(x * 0.38) + 0.65 * Math.sin(x * 0.85 + 1.3);
}

export function elevation(x: number, z: number) {
  const distance = shore(x) - z;
  if (distance < 0) {
    return WATER_LEVEL - 0.10 - Math.min(1.16, -distance * 0.28) + n2(x * 1.3, z * 1.3) * 0.045;
  }

  let mountain = 0;
  const peaks = [[-7.2, -8.1, 6.7, 4.6], [-1.3, -8.7, 9.6, 5.1], [5.7, -8.8, 7.3, 4.6]];
  for (const [px, pz, height, radius] of peaks) {
    const dx = x - px;
    const dz = (z - pz) * 1.15;
    const angle = Math.atan2(dz, dx);
    const ridges = 1 + Math.sin(angle * 5 + px) * 0.12 + Math.sin(angle * 9 - pz) * 0.07;
    const d = Math.sqrt(dx * dx + dz * dz) / (radius * ridges);
    const peak = Math.pow(Math.max(0, 1 - d), 1.48) * height;
    mountain = Math.max(mountain, peak * (1 + fbm(x * 1.25, z * 1.25) * 0.24));
  }

  const bank = 0.21 + 0.61 * (1 - Math.exp(-distance * 0.66));
  const rolling = (fbm(x * 0.31, z * 0.31) + 0.35) * 0.47 * Math.min(1, distance * 0.55);
  let y = bank + rolling + mountain;
  const cabinDistance = Math.max(Math.abs(x - CABIN.x) / 2.05, Math.abs(z - CABIN.z) / 1.65);
  if (cabinDistance < 1.5) {
    const flatten = Math.max(0, Math.min(1, (1.5 - cabinDistance) * 2));
    y = y * (1 - flatten) + 0.94 * flatten;
  }
  return y;
}

export function onLand(x: number, z: number, margin = 0.25) {
  return Math.abs(x) < HALF - margin && Math.abs(z) < HALF - margin && z < shore(x) - margin;
}

export function nearCabin(x: number, z: number, margin = 0) {
  return Math.abs(x - CABIN.x) < 1.85 + margin && Math.abs(z - CABIN.z) < 1.75 + margin;
}

export function pathX(z: number) {
  return CABIN.x - Math.max(0, z - 1.55) * 0.73 + Math.sin((z - 1.55) * 0.83) * 0.44;
}

export function nearPath(x: number, z: number, width = 0.35) {
  return z > 1.3 && z < 9.9 && Math.abs(x - pathX(z)) < width;
}