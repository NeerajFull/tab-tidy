import { describe, expect, it } from 'vitest';
import { findDuplicateTabIds } from '../lib/dedupe';
import { makeTab } from './fixtures';

describe('findDuplicateTabIds', () => {
  it('closes later copies and keeps the first', () => {
    const first = makeTab({ url: 'https://a.com/x', index: 0 });
    const second = makeTab({ url: 'https://a.com/x/', index: 1 });
    const third = makeTab({ url: 'https://a.com/x?utm_source=mail', index: 2 });
    expect(findDuplicateTabIds([first, second, third])).toEqual([second.id, third.id]);
  });

  it('keeps the active tab over an earlier copy', () => {
    const early = makeTab({ url: 'https://a.com', index: 0 });
    const active = makeTab({ url: 'https://a.com', index: 5, active: true });
    expect(findDuplicateTabIds([early, active])).toEqual([early.id]);
  });

  it('never closes pinned or call tabs', () => {
    const loose = makeTab({ url: 'https://a.com', index: 0, active: true });
    const pinned = makeTab({ url: 'https://a.com', index: 1, pinned: true });
    const playing = makeTab({ url: 'https://a.com', index: 2, audible: true });
    expect(findDuplicateTabIds([loose, pinned, playing])).toEqual([]);
  });

  it('keeps a grouped copy over a loose one', () => {
    const loose = makeTab({ url: 'https://a.com', index: 0 });
    const grouped = makeTab({ url: 'https://a.com', index: 3, groupId: 7 });
    expect(findDuplicateTabIds([loose, grouped])).toEqual([loose.id]);
  });

  it('finds duplicates across windows and keeps the focused window copy', () => {
    const other = makeTab({ url: 'https://a.com', index: 0, windowId: 2, active: true });
    const focused = makeTab({ url: 'https://a.com', index: 4, windowId: 1, active: true });
    expect(findDuplicateTabIds([other, focused], 1)).toEqual([other.id]);
  });

  it('closes duplicate new tab pages', () => {
    const one = makeTab({ url: 'chrome://newtab/', index: 0 });
    const two = makeTab({ url: 'chrome://newtab/', index: 1 });
    expect(findDuplicateTabIds([one, two])).toEqual([two.id]);
  });
});
