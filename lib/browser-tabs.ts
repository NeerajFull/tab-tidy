import { browser, type Browser } from 'wxt/browser';
import { NO_GROUP, type GroupState, type TabLite } from './types';

type TabIds = [number, ...number[]];

export const asTabIds = (ids: number[]): TabIds | null => {
  const [first, ...rest] = ids;
  return first === undefined ? null : [first, ...rest];
};

export const toLite = (tab: Browser.tabs.Tab): TabLite | null =>
  tab.id === undefined
    ? null
    : {
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        url: tab.url ?? tab.pendingUrl ?? '',
        title: tab.title ?? '',
        pinned: tab.pinned,
        active: tab.active,
        audible: tab.audible ?? false,
        discarded: tab.discarded ?? false,
        groupId: tab.groupId ?? NO_GROUP,
        lastAccessed: tab.lastAccessed,
      };

export const windowTabs = async (windowId: number): Promise<TabLite[]> => {
  const tabs = await browser.tabs.query({ windowId });
  return tabs.map(toLite).filter((tab): tab is TabLite => tab !== null);
};

export const normalWindowIds = async (): Promise<number[]> => {
  const windows = await browser.windows.getAll({ windowTypes: ['normal'] });
  return windows
    .filter((window) => !window.incognito)
    .map((window) => window.id)
    .filter((id): id is number => id !== undefined);
};

export const tabsIn = async (windowIds: number[]): Promise<TabLite[]> =>
  (await Promise.all(windowIds.map(windowTabs))).flat();

export const windowGroups = async (windowId: number): Promise<GroupState[]> => {
  const groups = await browser.tabGroups.query({ windowId });
  return groups.map((group) => ({
    id: group.id,
    title: group.title ?? '',
    color: group.color,
    collapsed: group.collapsed,
  }));
};

export const groupTabs = async (
  windowId: number,
  ids: number[],
  props: Omit<GroupState, 'id'>,
  groupId?: number,
): Promise<number> => {
  const tabIds = asTabIds(ids);
  if (!tabIds) throw new Error('Cannot create an empty group');
  const id =
    groupId === undefined
      ? await browser.tabs.group({ tabIds, createProperties: { windowId } })
      : await browser.tabs.group({ tabIds, groupId });
  await browser.tabGroups.update(id, props);
  return id;
};

export const ungroupTabs = async (ids: number[]): Promise<void> => {
  const tabIds = asTabIds(ids);
  if (tabIds) await browser.tabs.ungroup(tabIds);
};
