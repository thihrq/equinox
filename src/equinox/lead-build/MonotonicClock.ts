export interface MonotonicClock {
  now(): number;
}

export const systemMonotonicClock: MonotonicClock = {
  now: () => performance.now(),
};
