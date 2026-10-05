import { isProtected } from './protect';
import { dedupeKey } from './url';
import { NO_GROUP, type TabLite } from './types';

const keeperScore = (tab: TabLite, preferWindowId?: number): number =>
  (tab.active ? 8 : 0) +
  (isProtected(tab) ? 4 : 0) +
  (tab.groupId === NO_GROUP ? 0 : 2) +
  (tab.windowId === preferWindowId ? 1 : 0);

const pickKeeper = (tabs: TabLite[], preferWindowId?: number): TabLite =>
  tabs.reduce((best, tab) => {
    const diff = keeperScore(tab, preferWindowId) - keeperScore(best, preferWindowId);
    return diff > 0 || (diff === 0 && tab.index < best.index) ? tab : best;
  });

export const findDuplicateTabIds = (tabs: TabLite[], preferWindowId?: number): number[] => {
  const byKey = new Map<string, TabLite[]>();
  for (const tab of tabs) {
    if (!tab.url) continue;
    const key = dedupeKey(tab.url);
    byKey.set(key, [...(byKey.get(key) ?? []), tab]);
  }

  const duplicates: number[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const keeper = pickKeeper(group, preferWindowId);
    for (const tab of group) {
      if (tab !== keeper && !isProtected(tab)) duplicates.push(tab.id);
    }
  }
  return duplicates;
};
