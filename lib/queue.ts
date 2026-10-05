// Tab events can arrive a little after the job that caused them ends.
const QUIET_MS = 1000;

let tail: Promise<unknown> = Promise.resolve();
let running = 0;
let quietUntil = 0;

// Runs jobs one at a time. Pass `movesTabs: false` for jobs that leave tabs alone, so a user's move
// during them is still learned.
export const serial = <T>(job: () => Promise<T>, movesTabs = true): Promise<T> => {
  const run = tail.then(async () => {
    if (!movesTabs) return job();
    running += 1;
    try {
      return await job();
    } finally {
      running -= 1;
      quietUntil = Date.now() + QUIET_MS;
    }
  });
  tail = run.catch(() => undefined);
  return run;
};

// True while Tab Tidy moves tabs itself, and shortly after, so its own moves are not learned as rules.
export const isBusy = (): boolean => running > 0 || Date.now() < quietUntil;
