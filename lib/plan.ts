import type { Cluster, GroupColor, Move, TabLite } from './types';

const COLORS: GroupColor[] = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

export const colorFor = (name: string): GroupColor => {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? 'blue';
};

// Applies the model's moves to the site groups of each window. `tabs` is the list the model saw, so a move's
// tab is an index into it. A tab joins only a group in its own window, and tabs placed by a learned rule stay.
// Groups left with fewer than `minSize` tabs are dropped. `moved` lists the tabs that reached their new group.
export const planMoves = (
  tabs: Pick<TabLite, 'id' | 'windowId'>[],
  clusters: ReadonlyMap<number, Cluster[]>,
  moves: Move[],
  pinned: ReadonlySet<number>,
  minSize = 2,
): { groups: Map<number, Cluster[]>; moved: number[] } => {
  const groups = new Map<number, Cluster[]>();
  const where = new Map<number, Cluster>();
  for (const [windowId, list] of clusters) {
    const copies = list.map((cluster) => ({ ...cluster, tabIds: [...cluster.tabIds] }));
    groups.set(windowId, copies);
    for (const cluster of copies) for (const id of cluster.tabIds) where.set(id, cluster);
  }

  const moved = new Set<number>();
  for (const move of moves) {
    const tab = tabs[move.tab];
    if (!tab || pinned.has(tab.id) || moved.has(tab.id)) continue;
    const target = groups.get(tab.windowId)?.find((cluster) => cluster.label === move.group);
    const source = where.get(tab.id);
    if (!target || target === source) continue;
    if (source) source.tabIds = source.tabIds.filter((id) => id !== tab.id);
    target.tabIds.push(tab.id);
    where.set(tab.id, target);
    moved.add(tab.id);
  }

  for (const [windowId, list] of groups) {
    groups.set(windowId, list.filter((cluster) => cluster.tabIds.length >= minSize));
  }
  const kept = new Set([...groups.values()].flat().flatMap((cluster) => cluster.tabIds));
  return { groups, moved: [...moved].filter((id) => kept.has(id)) };
};
