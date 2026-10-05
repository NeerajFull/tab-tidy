import { browser } from 'wxt/browser';
import { groupTabs, windowGroups, windowTabs } from './browser-tabs';
import { sessionsItem } from './store';
import { NO_GROUP, type SavedSession } from './types';
import { isWebUrl } from './url';

const MAX_NAME = 60;

export const saveSession = async (windowId: number, name: string): Promise<SavedSession> => {
  const [tabs, groups] = await Promise.all([windowTabs(windowId), windowGroups(windowId)]);
  const groupIndex = new Map(groups.map((group, index) => [group.id, index]));
  const session: SavedSession = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, MAX_NAME) || new Date().toLocaleString(),
    savedAt: Date.now(),
    tabs: tabs
      .filter((tab) => isWebUrl(tab.url))
      .map((tab) => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        group: groupIndex.get(tab.groupId) ?? NO_GROUP,
      })),
    groups: groups.map(({ title, color, collapsed }) => ({ title, color, collapsed })),
  };
  if (session.tabs.length === 0) throw new Error('No web tabs to save');
  await sessionsItem.setValue([session, ...(await sessionsItem.getValue())]);
  return session;
};

export const restoreSession = async (id: string): Promise<number> => {
  const session = (await sessionsItem.getValue()).find((item) => item.id === id);
  if (!session) throw new Error('Session not found');

  const window = await browser.windows.create({ url: session.tabs.map((tab) => tab.url), focused: true });
  if (window?.id === undefined) throw new Error('Could not open a window');
  const windowId = window.id;
  const created = await browser.tabs.query({ windowId });
  const tabIds = created.map((tab) => tab.id);

  for (const [index, tab] of session.tabs.entries()) {
    const tabId = tabIds[index];
    if (tab.pinned && tabId !== undefined) await browser.tabs.update(tabId, { pinned: true });
  }

  const byGroup = new Map<number, number[]>();
  for (const [index, tab] of session.tabs.entries()) {
    const tabId = tabIds[index];
    if (tab.group !== NO_GROUP && !tab.pinned && tabId !== undefined) {
      byGroup.set(tab.group, [...(byGroup.get(tab.group) ?? []), tabId]);
    }
  }
  for (const [group, ids] of byGroup) {
    const props = session.groups[group];
    if (props) await groupTabs(windowId, ids, props);
  }
  return session.tabs.length;
};

export const deleteSession = async (id: string): Promise<SavedSession | null> => {
  const sessions = await sessionsItem.getValue();
  const removed = sessions.find((item) => item.id === id) ?? null;
  await sessionsItem.setValue(sessions.filter((item) => item.id !== id));
  return removed;
};

export const putSession = async (session: SavedSession): Promise<void> => {
  const sessions = (await sessionsItem.getValue()).filter((item) => item.id !== session.id);
  await sessionsItem.setValue([session, ...sessions].sort((a, b) => b.savedAt - a.savedAt));
};
