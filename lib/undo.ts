import { browser } from 'wxt/browser';
import { groupTabs, ungroupTabs, windowGroups, windowTabs } from './browser-tabs';
import { wakeTabs } from './sleep';
import { lastRunItem, undoItem } from './store';
import { cancelAi } from './tidy';
import { NO_GROUP, type GroupState, type WindowSnapshot } from './types';
import { isNewTabUrl } from './url';

const groupProps = ({ title, color, collapsed }: GroupState) => ({ title, color, collapsed });

const reopen = async (windowId: number, closed: WindowSnapshot['closed']) => {
  const reopened: WindowSnapshot['tabs'] = [];
  for (const tab of [...closed].sort((a, b) => a.index - b.index)) {
    const created = await browser.tabs
      .create({ windowId, url: isNewTabUrl(tab.url) ? undefined : tab.url, index: tab.index, active: false })
      .catch(() => null);
    if (created?.id !== undefined) reopened.push({ id: created.id, index: tab.index, groupId: tab.groupId });
  }
  return reopened;
};

const restoreWindow = async (snapshot: WindowSnapshot) => {
  const { windowId } = snapshot;
  if (!(await browser.windows.get(windowId).catch(() => null))) return;

  const reopened = await reopen(windowId, snapshot.closed);
  const current = new Map((await windowTabs(windowId)).map((tab) => [tab.id, tab]));
  const tracked = [...snapshot.tabs, ...reopened]
    .filter((tab) => current.has(tab.id))
    .sort((a, b) => a.index - b.index);

  await ungroupTabs(
    tracked
      .filter((tab) => {
        const groupId = current.get(tab.id)?.groupId ?? NO_GROUP;
        return groupId !== NO_GROUP && groupId !== tab.groupId;
      })
      .map((tab) => tab.id),
  );

  const pinnedCount = [...current.values()].filter((tab) => tab.pinned).length;
  const moving = tracked.map((tab) => tab.id);
  if (moving.length > 0) await browser.tabs.move(moving, { index: pinnedCount });

  const byGroup = new Map<number, number[]>();
  for (const tab of tracked) {
    if (tab.groupId !== NO_GROUP) byGroup.set(tab.groupId, [...(byGroup.get(tab.groupId) ?? []), tab.id]);
  }
  const existing = new Set((await windowGroups(windowId)).map((group) => group.id));
  const states = new Map(snapshot.groups.map((group) => [group.id, group]));
  for (const [groupId, tabIds] of byGroup) {
    const state = states.get(groupId);
    if (!state) continue;
    await groupTabs(windowId, tabIds, groupProps(state), existing.has(groupId) ? groupId : undefined);
  }

  const wanted = new Map(tracked.map((tab) => [tab.id, tab.groupId]));
  const strays = (await windowTabs(windowId))
    .filter((tab) => wanted.get(tab.id) === NO_GROUP && tab.groupId !== NO_GROUP)
    .map((tab) => tab.id);
  await ungroupTabs(strays);
};

export const undoLast = async (): Promise<boolean> => {
  cancelAi();
  const snapshot = await undoItem.getValue();
  if (!snapshot) return false;
  if (snapshot.kind === 'sleep') {
    await wakeTabs(snapshot.slept);
  } else {
    for (const window of snapshot.windows) await restoreWindow(window);
  }
  await undoItem.setValue(null);
  const last = await lastRunItem.getValue();
  if (last?.runId === snapshot.runId) {
    await lastRunItem.setValue({ ...last, ai: last.ai === 'pending' ? 'off' : last.ai, undone: true });
  }
  return true;
};
