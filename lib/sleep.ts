import { browser } from 'wxt/browser';
import { normalWindowIds, tabsIn } from './browser-tabs';
import { isProtected } from './protect';
import { idleMinutesItem, lastRunItem, undoItem } from './store';
import type { RunStatus, TabLite } from './types';
import { isWebUrl } from './url';

const isIdle = (tab: TabLite, cutoff: number): boolean =>
  !tab.active &&
  !tab.discarded &&
  !isProtected(tab) &&
  isWebUrl(tab.url) &&
  tab.lastAccessed !== undefined &&
  tab.lastAccessed < cutoff;

const discard = async (tabId: number): Promise<number | null> => {
  try {
    const result = await browser.tabs.discard(tabId);
    return result?.id ?? tabId;
  } catch {
    return null;
  }
};

export const sleepIdleTabs = async (): Promise<RunStatus> => {
  const start = performance.now();
  const minutes = await idleMinutesItem.getValue();
  const cutoff = Date.now() - minutes * 60_000;
  const tabs = await tabsIn(await normalWindowIds());

  const slept: number[] = [];
  for (const tab of tabs.filter((candidate) => isIdle(candidate, cutoff))) {
    const id = await discard(tab.id);
    if (id !== null) slept.push(id);
  }

  const runId = crypto.randomUUID();
  await undoItem.setValue({ kind: 'sleep', runId, windows: [], slept });
  const status: RunStatus = {
    runId,
    kind: 'sleep',
    windowCount: new Set(tabs.map((tab) => tab.windowId)).size,
    tabCount: tabs.length,
    groupCount: 0,
    closedCount: 0,
    sleptCount: slept.length,
    groupedMs: Math.round(performance.now() - start),
    ai: 'off',
  };
  await lastRunItem.setValue(status);
  return status;
};

export const wakeTabs = async (tabIds: number[]): Promise<void> => {
  for (const id of tabIds) {
    const tab = await browser.tabs.get(id).catch(() => null);
    if (tab?.discarded) await browser.tabs.reload(id).catch(() => undefined);
  }
};
