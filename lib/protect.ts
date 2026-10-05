import type { TabLite } from './types';

const CALL_URLS = [
  /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/,
  /^https:\/\/([\w-]+\.)?zoom\.us\/(wc|j|s)\//,
  /^https:\/\/teams\.(microsoft|live)\.com\//,
  /^https:\/\/([\w-]+\.)?whereby\.com\/[\w-]+/,
  /^https:\/\/app\.slack\.com\/huddle\//,
];

export const isInCall = (tab: Pick<TabLite, 'audible' | 'url'>): boolean =>
  tab.audible || CALL_URLS.some((pattern) => pattern.test(tab.url));

export const isProtected = (tab: Pick<TabLite, 'pinned' | 'audible' | 'url'>): boolean =>
  tab.pinned || isInCall(tab);
