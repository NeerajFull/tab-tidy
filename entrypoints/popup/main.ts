import '@/assets/ui.css';
import './style.css';
import { browser } from 'wxt/browser';
import { summary, timing } from '@/lib/format';
import { send } from '@/lib/messages';
import { apiKeyItem, lastRunItem, sessionsItem, undoItem } from '@/lib/store';
import { TIDY_COMMAND, type RunStatus, type SavedSession, type UndoSnapshot } from '@/lib/types';

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const tidyButton = byId<HTMLButtonElement>('tidy');
const undoButton = byId<HTMLButtonElement>('undo');
const sleepButton = byId<HTMLButtonElement>('sleep');
const summaryText = byId<HTMLParagraphElement>('summary');
const timingText = byId<HTMLParagraphElement>('timing');
const aiHint = byId<HTMLParagraphElement>('ai-hint');
const notice = byId<HTMLParagraphElement>('notice');
const noticeText = byId<HTMLSpanElement>('notice-text');
const noticeAction = byId<HTMLButtonElement>('notice-action');
const saveForm = byId<HTMLFormElement>('save-form');
const nameInput = byId<HTMLInputElement>('session-name');
const sessionList = byId<HTMLUListElement>('sessions');
const noSessions = byId<HTMLParagraphElement>('no-sessions');
const shortcutText = byId<HTMLParagraphElement>('shortcut');

let noticeHandler: (() => Promise<void>) | null = null;

const currentWindowId = async (): Promise<number> => {
  const window = await browser.windows.getCurrent();
  return window.id ?? browser.windows.WINDOW_ID_CURRENT;
};

const showNotice = (text: string, action?: () => Promise<void>) => {
  noticeText.textContent = text;
  noticeHandler = action ?? null;
  noticeAction.hidden = !action;
  notice.hidden = false;
};

const renderRun = (status: RunStatus | null) => {
  if (!status) return;
  summaryText.textContent = summary(status);
  timingText.textContent = timing(status);
};

const renderShortcut = async () => {
  const commands = await browser.commands.getAll();
  const shortcut = commands.find((command) => command.name === TIDY_COMMAND)?.shortcut;
  shortcutText.textContent = shortcut
    ? `Shortcut: ${shortcut} tidies without opening this popup.`
    : 'No shortcut set. You can add one on the browser\'s extension shortcuts page.';
};

const renderUndo = (snapshot: UndoSnapshot | null) => {
  undoButton.disabled = !snapshot;
};

const renderAiHint = (apiKey: string) => {
  aiHint.hidden = Boolean(apiKey);
};

const run = async (button: HTMLButtonElement, job: () => Promise<void>) => {
  button.disabled = true;
  notice.hidden = true;
  try {
    await job();
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error));
  } finally {
    button.disabled = false;
    renderUndo(await undoItem.getValue());
  }
};

const sessionButton = (label: string, action: string, id: string, className = ''): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
};

const sessionItem = (session: SavedSession): HTMLLIElement => {
  const item = document.createElement('li');
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = session.name;
  name.title = `${session.tabs.length} tabs · ${new Date(session.savedAt).toLocaleString()}`;
  item.append(
    name,
    sessionButton('Restore', 'restore', session.id),
    sessionButton('Delete', 'delete', session.id, 'link danger'),
  );
  return item;
};

const renderSessions = (sessions: SavedSession[]) => {
  sessionList.replaceChildren(...sessions.map(sessionItem));
  noSessions.hidden = sessions.length > 0;
};

tidyButton.addEventListener('click', () =>
  run(tidyButton, async () => {
    renderRun(await send<RunStatus>({ type: 'tidy', focusedWindowId: await currentWindowId() }));
  }),
);

sleepButton.addEventListener('click', () =>
  run(sleepButton, async () => {
    renderRun(await send<RunStatus>({ type: 'sleep' }));
  }),
);

undoButton.addEventListener('click', () =>
  run(undoButton, async () => {
    const undone = await send<boolean>({ type: 'undo' });
    if (!undone) showNotice('Nothing to undo.');
  }),
);

noticeAction.addEventListener('click', async () => {
  const handler = noticeHandler;
  notice.hidden = true;
  await handler?.();
});

saveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = saveForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  void run(button, async () => {
    const session = await send<SavedSession>({
      type: 'save-session',
      windowId: await currentWindowId(),
      name: nameInput.value,
    });
    nameInput.value = '';
    showNotice(`Saved "${session.name}" with ${session.tabs.length} tabs.`);
  });
});

sessionList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  const id = button?.dataset.id;
  if (!button || !id) return;
  if (button.dataset.action === 'restore') {
    void run(button, async () => {
      await send<number>({ type: 'restore-session', id });
    });
    return;
  }
  void run(button, async () => {
    const removed = await send<SavedSession | null>({ type: 'delete-session', id });
    if (!removed) return;
    showNotice(`Deleted "${removed.name}".`, async () => {
      await send<void>({ type: 'put-session', session: removed });
    });
  });
});

const openSettings = () => browser.runtime.openOptionsPage();
byId<HTMLButtonElement>('settings').addEventListener('click', openSettings);
byId<HTMLButtonElement>('ai-settings').addEventListener('click', openSettings);

lastRunItem.watch(renderRun);
undoItem.watch(renderUndo);
sessionsItem.watch(renderSessions);
apiKeyItem.watch(renderAiHint);

const [lastRun, snapshot, sessions, apiKey] = await Promise.all([
  lastRunItem.getValue(),
  undoItem.getValue(),
  sessionsItem.getValue(),
  apiKeyItem.getValue(),
]);
renderRun(lastRun);
renderUndo(snapshot);
renderSessions(sessions);
renderAiHint(apiKey);
void renderShortcut();
