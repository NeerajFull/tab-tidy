import { describe, expect, it } from 'vitest';
import { summary, timing } from '../lib/format';
import type { RunStatus } from '../lib/types';

const base: RunStatus = {
  runId: 'r',
  kind: 'tidy',
  windowCount: 1,
  tabCount: 42,
  groupCount: 6,
  closedCount: 9,
  sleptCount: 0,
  groupedMs: 80,
  ai: 'off',
};

describe('summary', () => {
  it('describes a tidy run', () => {
    expect(summary(base)).toBe('42 tabs became 6 groups, 9 duplicates closed.');
    expect(summary({ ...base, closedCount: 0, groupCount: 1 })).toBe('42 tabs became 1 group.');
    expect(summary({ ...base, windowCount: 3, groupCount: 9 })).toBe('42 tabs in 3 windows became 9 groups, 9 duplicates closed.');
  });

  it('describes sleep and undo', () => {
    expect(summary({ ...base, kind: 'sleep', sleptCount: 3 })).toBe('3 tabs put to sleep.');
    expect(summary({ ...base, undone: true })).toBe('Undone.');
  });
});

describe('timing', () => {
  it('shows the measured time', () => {
    expect(timing(base)).toBe('Grouped in 80 ms');
    expect(timing({ ...base, groupedMs: 1234 })).toBe('Grouped in 1.2 s');
    expect(timing({ ...base, kind: 'sleep' })).toBe('');
  });

  it('shows the AI check', () => {
    expect(timing({ ...base, ai: 'pending' })).toBe('Grouped in 80 ms · AI checking…');
    expect(timing({ ...base, ai: 'done', aiMs: 3100, aiMoved: 2 })).toBe('Grouped in 80 ms · AI moved 2 tabs in 3.1 s');
    expect(timing({ ...base, ai: 'done', aiMs: 2500, aiMoved: 0 })).toBe('Grouped in 80 ms · AI checked in 2.5 s, no moves');
    expect(timing({ ...base, ai: 'failed', error: 'Timed out' })).toBe('Grouped in 80 ms · AI check failed: Timed out');
  });
});
