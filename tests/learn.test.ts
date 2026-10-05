import { describe, expect, it } from 'vitest';
import { ruleFromMove, withRule } from '../lib/learn';
import { makeTab } from './fixtures';

const jira = makeTab({ url: 'https://anywhereworks.atlassian.net/browse/FC-1598' });
const grafana = makeTab({ url: 'https://grafana.anywhere.co/d/aeik/bug-slo-dashboard-bc' });

describe('ruleFromMove', () => {
  it('learns a site from a tab put in another app group', () => {
    expect(ruleFromMove(grafana, 'Atlassian', [jira, grafana])).toEqual({ from: 'grafana.anywhere.co', to: 'Atlassian' });
  });

  it('learns from groups named after a site, including a staging site', () => {
    const staging = makeTab({ url: 'https://workflow.staging.anywhere.co/q' });
    expect(ruleFromMove(grafana, 'workflow.staging.anywhere.co', [staging, grafana])).toEqual({
      from: 'grafana.anywhere.co',
      to: 'workflow.anywhere.co',
    });
  });

  it('learns nothing from groups named after a task or left unnamed', () => {
    expect(ruleFromMove(grafana, 'Sprint 42', [jira, grafana])).toBeNull();
    expect(ruleFromMove(grafana, '', [jira, grafana])).toBeNull();
  });

  it('does not count the moved tab as the reason for the group name', () => {
    expect(ruleFromMove(grafana, 'grafana.anywhere.co', [grafana])).toBeNull();
  });

  it('marks a tab put back in its own app group', () => {
    const other = makeTab({ url: 'https://grafana.anywhere.co/d/2' });
    expect(ruleFromMove(grafana, 'grafana.anywhere.co', [other, grafana])).toEqual({
      from: 'grafana.anywhere.co',
      to: 'grafana.anywhere.co',
    });
  });
});

describe('withRule', () => {
  const rule = { from: 'grafana.anywhere.co', to: 'Atlassian' };

  it('adds and replaces rules', () => {
    expect(withRule([], rule)).toEqual([rule]);
    expect(withRule([rule], { from: 'grafana.anywhere.co', to: 'GitHub' })).toEqual([
      { from: 'grafana.anywhere.co', to: 'GitHub' },
    ]);
  });

  it('removes the rule when the tab goes back to its own group', () => {
    expect(withRule([rule], { from: 'grafana.anywhere.co', to: 'grafana.anywhere.co' })).toEqual([]);
  });

  it('returns the same array when nothing changes', () => {
    const rules = [rule];
    expect(withRule(rules, { ...rule })).toBe(rules);
    expect(withRule(rules, { from: 'a.com', to: 'a.com' })).toBe(rules);
  });
});
