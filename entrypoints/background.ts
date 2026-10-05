import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { toLite } from '@/lib/browser-tabs';
import { ruleFromMove, withRule } from '@/lib/learn';
import { isBusy, serial } from '@/lib/queue';
import { deleteSession, putSession, restoreSession, saveSession } from '@/lib/sessions';
import { sleepIdleTabs } from '@/lib/sleep';
import { lastRunItem, rulesItem } from '@/lib/store';
import { tidyAll } from '@/lib/tidy';
import { NO_GROUP, TIDY_COMMAND, type Request, type Response } from '@/lib/types';
import { undoLast } from '@/lib/undo';
import { isWebUrl } from '@/lib/url';

const BADGE_MS = 4000;
// A drag can pass over other groups, so a move counts only when the tab stays put this long.
const LEARN_DELAY_MS = 1500;
// The browser puts a tab opened from a grouped tab in the same group. That is not a move by the user.
const NEW_TAB_MS = 5000;

const handle = (request: Request): Promise<unknown> => {
  switch (request.type) {
    case 'tidy':
      return tidyAll(request.focusedWindowId);
    case 'sleep':
      return sleepIdleTabs();
    case 'undo':
      return undoLast();
    case 'save-session':
      return saveSession(request.windowId, request.name);
    case 'restore-session':
      return restoreSession(request.id);
    case 'delete-session':
      return deleteSession(request.id);
    case 'put-session':
      return putSession(request.session);
  }
};

const flashBadge = async (ok: boolean) => {
  await browser.action.setBadgeBackgroundColor({ color: ok ? '#1f845a' : '#c9372c' });
  await browser.action.setBadgeText({ text: ok ? '✓' : '!' });
  setTimeout(() => void browser.action.setBadgeText({ text: '' }), BADGE_MS);
};

// A pending AI check dies with the service worker that ran it.
const failStaleAiCheck = async () => {
  const last = await lastRunItem.getValue();
  if (last?.ai === 'pending') await lastRunItem.setValue({ ...last, ai: 'failed', error: 'Interrupted' });
};

const learnFromTab = async (tabId: number) => {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  const moved = tab ? toLite(tab) : null;
  if (!moved || moved.groupId === NO_GROUP || !isWebUrl(moved.url)) return;
  const [group, members] = await Promise.all([
    browser.tabGroups.get(moved.groupId).catch(() => null),
    browser.tabs.query({ groupId: moved.groupId }),
  ]);
  const rule = group && ruleFromMove(moved, group.title ?? '', members.map(toLite).filter((item) => item !== null));
  if (!rule) return;
  const rules = await rulesItem.getValue();
  const next = withRule(rules, rule);
  if (next !== rules) await rulesItem.setValue(next);
};

const watchMoves = () => {
  const createdAt = new Map<number, number>();
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  browser.tabs.onCreated.addListener((tab) => {
    if (tab.id !== undefined) createdAt.set(tab.id, Date.now());
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    createdAt.delete(tabId);
    clearTimeout(timers.get(tabId));
    timers.delete(tabId);
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.groupId === undefined || changeInfo.groupId === NO_GROUP || isBusy()) return;
    if (Date.now() - (createdAt.get(tabId) ?? 0) < NEW_TAB_MS) return;
    clearTimeout(timers.get(tabId));
    timers.set(
      tabId,
      setTimeout(() => {
        timers.delete(tabId);
        if (!isBusy()) void learnFromTab(tabId);
      }, LEARN_DELAY_MS),
    );
  });
};

export default defineBackground(() => {
  // Earlier builds stored an on-device model status; drop it.
  browser.runtime.onInstalled.addListener(() => void browser.storage.local.remove('nanoStatus'));
  void serial(failStaleAiCheck, false);
  watchMoves();

  browser.runtime.onMessage.addListener((request: Request, _sender, sendResponse: (response: Response) => void) => {
    serial(() => handle(request)).then(
      (value) => sendResponse({ ok: true, value }),
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
    return true;
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== TIDY_COMMAND) return;
    serial(() => tidyAll(tab?.windowId)).then(
      () => flashBadge(true),
      () => flashBadge(false),
    );
  });
});
