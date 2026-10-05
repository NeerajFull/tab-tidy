import '@/assets/ui.css';
import './style.css';
import { apiKeyItem, idleMinutesItem, rulesItem } from '@/lib/store';
import type { Rule } from '@/lib/types';

const KEY_PREFIX = 'sk-ant-';
const MIN_IDLE = 5;
const MAX_IDLE = 1440;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const keyForm = byId<HTMLFormElement>('key-form');
const keyInput = byId<HTMLInputElement>('api-key');
const keyStatus = byId<HTMLParagraphElement>('key-status');
const removeKey = byId<HTMLButtonElement>('remove-key');
const ruleList = byId<HTMLUListElement>('rules');
const noRules = byId<HTMLParagraphElement>('no-rules');
const idleForm = byId<HTMLFormElement>('idle-form');
const idleInput = byId<HTMLInputElement>('idle-minutes');
const idleStatus = byId<HTMLParagraphElement>('idle-status');

const maskKey = (key: string): string => `${key.slice(0, KEY_PREFIX.length + 4)}…${key.slice(-4)}`;

const renderKey = (key: string) => {
  keyInput.value = '';
  keyStatus.textContent = key ? `Saved key: ${maskKey(key)}` : 'No key saved. The AI check is off.';
  removeKey.disabled = !key;
};

const ruleItem = (rule: Rule): HTMLLIElement => {
  const item = document.createElement('li');
  const text = document.createElement('span');
  text.className = 'grow';
  text.textContent = `${rule.from} goes with ${rule.to}`;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'link danger';
  remove.textContent = 'Delete';
  remove.dataset.from = rule.from;
  item.append(text, remove);
  return item;
};

const renderRules = (rules: Rule[]) => {
  ruleList.replaceChildren(...rules.map(ruleItem));
  noRules.hidden = rules.length > 0;
};

keyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key.startsWith(KEY_PREFIX)) {
    keyStatus.textContent = `Key should start with ${KEY_PREFIX}`;
    return;
  }
  await apiKeyItem.setValue(key);
  renderKey(key);
});

removeKey.addEventListener('click', async () => {
  await apiKeyItem.removeValue();
  renderKey('');
});

ruleList.addEventListener('click', async (event) => {
  const from = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-from]')?.dataset.from;
  if (from === undefined) return;
  await rulesItem.setValue((await rulesItem.getValue()).filter((rule) => rule.from !== from));
});

idleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const minutes = Number(idleInput.value);
  if (!Number.isInteger(minutes) || minutes < MIN_IDLE || minutes > MAX_IDLE) {
    idleStatus.textContent = `Use a whole number from ${MIN_IDLE} to ${MAX_IDLE}.`;
    return;
  }
  await idleMinutesItem.setValue(minutes);
  idleStatus.textContent = 'Saved.';
});

rulesItem.watch(renderRules);

const [key, rules, minutes] = await Promise.all([
  apiKeyItem.getValue(),
  rulesItem.getValue(),
  idleMinutesItem.getValue(),
]);
renderKey(key);
renderRules(rules);
idleInput.value = String(minutes);
