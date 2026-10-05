import { describe, expect, it } from 'vitest';
import { isInCall, isProtected } from '../lib/protect';
import { makeTab } from './fixtures';

describe('isProtected', () => {
  it('protects pinned tabs', () => {
    expect(isProtected(makeTab({ pinned: true }))).toBe(true);
  });

  it('protects audible tabs', () => {
    expect(isProtected(makeTab({ audible: true }))).toBe(true);
  });

  it.each([
    'https://meet.google.com/abc-defg-hij',
    'https://us02web.zoom.us/j/123456789',
    'https://teams.microsoft.com/v2/',
    'https://app.slack.com/huddle/T01/C02',
  ])('protects call tab %s', (url) => {
    expect(isInCall(makeTab({ url }))).toBe(true);
  });

  it('does not protect a normal tab', () => {
    expect(isProtected(makeTab({ url: 'https://meet.google.com/landing' }))).toBe(false);
  });
});
