import { browser } from 'wxt/browser';
import { askForMoves, describeAiError, isAbort } from './ai';
import { asTabIds, groupTabs, normalWindowIds, ungroupTabs, windowGroups, windowTabs } from './browser-tabs';
import { appOf, clusterTabs, groupKeyOf, toRules, type Rules } from './cluster';
import { findDuplicateTabIds } from './dedupe';
import { colorFor, planMoves } from './plan';
import { isProtected } from './protect';
import { serial } from './queue';
import { apiKeyItem, lastRunItem, rulesItem, undoItem } from './store';
import { NO_GROUP, type Cluster, type RunStatus, type TabLite } from './types';
import { isWebUrl } from './url';

// What the first pass did in one window, so the AI pass can change it safely.
interface WindowPlan {
  windowId: number;
  clusters: Cluster[];
  groupIds: Map<string, number>;
}

let ai: { runId: string; controller: AbortController } | null = null;

export const cancelAi = (): void => {
  ai?.controller.abort();
  ai = null;
};

const elapsed = (start: number): number => Math.round(performance.now() - start);

const groupProps = (label: string) => ({ title: label, color: colorFor(label), collapsed: false });

const groupWindow = async (windowId: number, candidates: TabLite[], rules: Rules): Promise<WindowPlan> => {
  const clusters = clusterTabs(candidates, rules);
  const groupIds = new Map<string, number>();
  for (const cluster of clusters) {
    groupIds.set(cluster.label, await groupTabs(windowId, cluster.tabIds, groupProps(cluster.label)));
  }
  return { windowId, clusters, groupIds };
};

// Moves tabs into the groups the AI pass chose. Tabs the user moved after the first pass are left alone.
const regroupWindow = async (plan: WindowPlan, clusters: Cluster[]): Promise<void> => {
  const placed = new Map<number, number>();
  for (const cluster of plan.clusters) {
    const groupId = plan.groupIds.get(cluster.label) ?? NO_GROUP;
    for (const id of cluster.tabIds) placed.set(id, groupId);
  }
  const current = new Map((await windowTabs(plan.windowId)).map((tab) => [tab.id, tab]));
  const unchanged = (id: number): boolean => current.get(id)?.groupId === (placed.get(id) ?? NO_GROUP);
  const existing = new Set((await windowGroups(plan.windowId)).map((group) => group.id));

  const assigned = new Set<number>();
  for (const cluster of clusters) {
    const ids = cluster.tabIds.filter(unchanged);
    const groupId = plan.groupIds.get(cluster.label);
    if (groupId !== undefined && existing.has(groupId)) {
      // Joining keeps the group's title, color and collapsed state, in case the user changed them.
      const joining = asTabIds(ids.filter((id) => current.get(id)?.groupId !== groupId));
      if (joining) await browser.tabs.group({ groupId, tabIds: joining });
    } else if (ids.length >= 2) {
      await groupTabs(plan.windowId, ids, groupProps(cluster.label));
    }
    for (const id of ids) assigned.add(id);
  }

  await ungroupTabs([...placed.keys()].filter((id) => !assigned.has(id) && unchanged(id)));
};

// Updates the popup status, unless a later action has replaced it.
const updateRun = async (status: RunStatus): Promise<void> => {
  if ((await lastRunItem.getValue())?.runId === status.runId) await lastRunItem.setValue(status);
};

const refineInBackground = async (
  status: RunStatus,
  apiKey: string,
  candidates: TabLite[],
  plans: WindowPlan[],
  pinned: Set<number>,
): Promise<void> => {
  const controller = new AbortController();
  ai = { runId: status.runId, controller };
  const start = performance.now();
  const labels = new Map<number, string>();
  for (const cluster of plans.flatMap((plan) => plan.clusters)) {
    for (const id of cluster.tabIds) labels.set(id, cluster.label);
  }
  try {
    const moves = await askForMoves(
      apiKey,
      candidates.map((tab) => ({ url: tab.url, title: tab.title, group: labels.get(tab.id) })),
      controller.signal,
    );
    await serial(async () => {
      if (ai?.runId !== status.runId) return;
      const before = new Map(plans.map((plan) => [plan.windowId, plan.clusters]));
      const { groups, moved } = planMoves(candidates, before, moves, pinned);
      if (moved.length > 0) {
        for (const plan of plans) await regroupWindow(plan, groups.get(plan.windowId) ?? []);
      }
      const groupCount = moved.length > 0 ? [...groups.values()].flat().length : status.groupCount;
      await updateRun({ ...status, groupCount, ai: 'done', aiMs: elapsed(start), aiMoved: moved.length });
    });
  } catch (error) {
    if (isAbort(error) || ai?.runId !== status.runId) return;
    await serial(() => updateRun({ ...status, ai: 'failed', error: describeAiError(error) }), false);
  } finally {
    if (ai?.runId === status.runId) ai = null;
  }
};

export const tidyAll = async (focusedWindowId?: number): Promise<RunStatus> => {
  cancelAi();
  const start = performance.now();
  const runId = crypto.randomUUID();
  const windowIds = await normalWindowIds();
  const [windows, rules, apiKey] = await Promise.all([
    Promise.all(
      windowIds.map(async (windowId) => ({
        windowId,
        tabs: await windowTabs(windowId),
        groups: await windowGroups(windowId),
      })),
    ),
    rulesItem.getValue().then(toRules),
    apiKeyItem.getValue(),
  ]);
  const tabs = windows.flatMap((window) => window.tabs);
  const duplicateIds = new Set(findDuplicateTabIds(tabs, focusedWindowId));

  await undoItem.setValue({
    kind: 'tidy',
    runId,
    slept: [],
    windows: windows.map((window) => ({
      windowId: window.windowId,
      tabs: window.tabs.filter((tab) => !tab.pinned).map(({ id, index, groupId }) => ({ id, index, groupId })),
      groups: window.groups,
      closed: window.tabs
        .filter((tab) => duplicateIds.has(tab.id))
        .map(({ url, index, groupId }) => ({ url, index, groupId })),
    })),
  });

  if (duplicateIds.size > 0) await browser.tabs.remove([...duplicateIds]);

  // Every tab except pinned and call tabs is regrouped, including tabs in groups the user made.
  const movable = tabs.filter((tab) => !duplicateIds.has(tab.id) && !isProtected(tab));
  await ungroupTabs(movable.filter((tab) => tab.groupId !== NO_GROUP).map((tab) => tab.id));

  const candidates = movable.filter((tab) => isWebUrl(tab.url));
  const plans: WindowPlan[] = [];
  for (const windowId of windowIds) {
    plans.push(await groupWindow(windowId, candidates.filter((tab) => tab.windowId === windowId), rules));
  }
  const clusters = plans.flatMap((plan) => plan.clusters);
  const groupCount = clusters.length;
  const loose = candidates.length - clusters.flatMap((cluster) => cluster.tabIds).length;
  // The AI pass only moves tabs into existing groups, so it needs a group and a tab outside that group.
  const askAi = apiKey !== '' && groupCount > 0 && (groupCount > 1 || loose > 0);

  const status: RunStatus = {
    runId,
    kind: 'tidy',
    windowCount: windows.filter((window) => window.tabs.length > 0).length,
    tabCount: tabs.length,
    groupCount,
    closedCount: duplicateIds.size,
    sleptCount: 0,
    groupedMs: elapsed(start),
    ai: askAi ? 'pending' : 'off',
  };
  await lastRunItem.setValue(status);
  if (askAi) {
    // Tabs placed by a learned rule stay where the user put them.
    const learned = candidates.filter((tab) => groupKeyOf(tab.url, rules) !== appOf(tab.url));
    void refineInBackground(status, apiKey, candidates, plans, new Set(learned.map((tab) => tab.id)));
  }
  return status;
};
