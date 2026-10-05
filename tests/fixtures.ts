import { NO_GROUP, type TabLite } from '../lib/types';

let nextId = 1;

export const makeTab = (overrides: Partial<TabLite> = {}): TabLite => {
  const id = overrides.id ?? nextId++;
  return {
    windowId: 1,
    index: id,
    url: 'https://example.com/',
    title: 'Example',
    pinned: false,
    active: false,
    audible: false,
    discarded: false,
    groupId: NO_GROUP,
    ...overrides,
    id,
  };
};
