export function nextRandom(seed: number): [number, number] {
  const next = (Math.imul(seed || 1, 1664525) + 1013904223) >>> 0;
  return [next / 0x100000000, next];
}

export function randomIndex(seed: number, length: number): [number, number] {
  const [value, next] = nextRandom(seed);
  return [Math.floor(value * Math.max(1, length)), next];
}

export function shuffleSeeded<T>(values: T[], seed: number): { values: T[]; seed: number } {
  const copy = [...values];
  let currentSeed = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const [swapIndex, next] = randomIndex(currentSeed, index + 1);
    currentSeed = next;
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return { values: copy, seed: currentSeed };
}
