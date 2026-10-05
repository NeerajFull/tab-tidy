import type { RunStatus } from './types';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const formatMs = (ms: number): string => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export const summary = (run: RunStatus): string => {
  if (run.undone) return 'Undone.';
  if (run.kind === 'sleep') return run.sleptCount === 0 ? 'No idle tabs to sleep.' : `${plural(run.sleptCount, 'tab')} put to sleep.`;
  const where = run.windowCount > 1 ? ` in ${plural(run.windowCount, 'window')}` : '';
  const closed = run.closedCount > 0 ? `, ${plural(run.closedCount, 'duplicate')} closed` : '';
  return `${plural(run.tabCount, 'tab')}${where} became ${plural(run.groupCount, 'group')}${closed}.`;
};

export const timing = (run: RunStatus): string => {
  if (run.undone || run.kind === 'sleep') return '';
  const grouped = `Grouped in ${formatMs(run.groupedMs)}`;
  switch (run.ai) {
    case 'pending':
      return `${grouped} · AI checking…`;
    case 'done':
      return run.aiMoved
        ? `${grouped} · AI moved ${plural(run.aiMoved, 'tab')} in ${formatMs(run.aiMs ?? 0)}`
        : `${grouped} · AI checked in ${formatMs(run.aiMs ?? 0)}, no moves`;
    case 'failed':
      return `${grouped} · AI check failed: ${run.error ?? 'unknown error'}`;
    default:
      return grouped;
  }
};
