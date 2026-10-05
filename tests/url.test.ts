import { describe, expect, it } from 'vitest';
import { dedupeKey, isNewTabUrl, isWebUrl, siteOf, sitePath, withoutEnv } from '../lib/url';

describe('dedupeKey', () => {
  it('ignores tracking params, param order, trailing slash and www', () => {
    expect(dedupeKey('https://www.a.com/page/?b=2&a=1&utm_source=x')).toBe(dedupeKey('https://a.com/page?a=1&b=2'));
  });

  it('keeps meaningful query and fragment differences', () => {
    expect(dedupeKey('https://a.com/search?q=one')).not.toBe(dedupeKey('https://a.com/search?q=two'));
    expect(dedupeKey('https://mail.google.com/mail/u/0/#inbox')).not.toBe(dedupeKey('https://mail.google.com/mail/u/0/#sent'));
  });

  it('leaves non-web URLs untouched', () => {
    expect(dedupeKey('chrome://newtab/')).toBe('chrome://newtab/');
  });

  it('keeps staging and live apart, so neither is closed as a copy of the other', () => {
    expect(dedupeKey('https://workflow.staging.anywhere.co/q#a')).not.toBe(dedupeKey('https://workflow.anywhere.co/q#a'));
  });
});

describe('withoutEnv', () => {
  it.each([
    ['workflow.staging.anywhere.co', 'workflow.anywhere.co'],
    ['staging.anywhere.co', 'anywhere.co'],
    ['api.dev.example.com', 'api.example.com'],
    ['app.qa2.example.com', 'app.example.com'],
    ['app-staging.example.com', 'app.example.com'],
    ['dev-app.example.com', 'app.example.com'],
    ['app.pre-prod.example.com', 'app.example.com'],
    ['shop.uat.example.co.uk', 'shop.example.co.uk'],
  ])('drops the environment from %s', (site, live) => {
    expect(withoutEnv(site)).toBe(live);
  });

  it.each(['workflow.anywhere.co', 'dev.to', 'test.com', 'example.co.uk', 'test-results.example.com', 'localhost', ''])(
    'leaves %s alone',
    (site) => {
      expect(withoutEnv(site)).toBe(site);
    },
  );
});

describe('url helpers', () => {
  it('detects web URLs', () => {
    expect(isWebUrl('https://a.com')).toBe(true);
    expect(isWebUrl('chrome://extensions')).toBe(false);
  });

  it('detects new tab pages', () => {
    expect(isNewTabUrl('chrome://newtab/')).toBe(true);
    expect(isNewTabUrl('about:newtab')).toBe(true);
    expect(isNewTabUrl('https://a.com')).toBe(false);
  });

  it('extracts the site', () => {
    expect(siteOf('https://www.docs.google.com/x')).toBe('docs.google.com');
    expect(siteOf('nope')).toBe('');
  });

  it('gives the site and path without query or fragment', () => {
    expect(sitePath('https://www.github.com/o/r/pull/1?token=secret#x')).toBe('github.com/o/r/pull/1');
    expect(sitePath('https://figma.com/')).toBe('figma.com');
    expect(sitePath(`https://a.com/${'p'.repeat(100)}`)).toBe(`a.com/${'p'.repeat(59)}`);
    expect(sitePath('nope')).toBe('');
  });
});
