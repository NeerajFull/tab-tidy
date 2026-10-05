import { describe, expect, it } from 'vitest';
import { colorFor, planMoves } from '../lib/plan';
import type { Cluster } from '../lib/types';
import { makeTab } from './fixtures';

describe('colorFor', () => {
  it('gives a stable color per name', () => {
    expect(colorFor('Figma')).toBe(colorFor('figma'));
    expect(colorFor('Figma')).not.toBe('grey');
  });
});

describe('planMoves', () => {
  const jira = makeTab({ windowId: 1 });
  const wiki = makeTab({ windowId: 1 });
  const pr = makeTab({ windowId: 1 });
  const repo = makeTab({ windowId: 1 });
  const grafana = makeTab({ windowId: 1 });
  const away = makeTab({ windowId: 2 });
  const tabs = [jira, wiki, pr, repo, grafana, away];
  const atlassian: Cluster = { key: 'Atlassian', label: 'Atlassian', tabIds: [jira.id, wiki.id] };
  const github: Cluster = { key: 'GitHub', label: 'GitHub', tabIds: [pr.id, repo.id] };
  const clusters = new Map([[1, [atlassian, github]]]);
  const none = new Set<number>();

  it('puts a loose tab in the group the model names', () => {
    const { groups, moved } = planMoves(tabs, clusters, [{ tab: 4, group: 'Atlassian' }], none);
    expect(groups.get(1)).toEqual([{ ...atlassian, tabIds: [jira.id, wiki.id, grafana.id] }, github]);
    expect(moved).toEqual([grafana.id]);
  });

  it('drops a group left with one tab', () => {
    const { groups, moved } = planMoves(tabs, clusters, [{ tab: 2, group: 'Atlassian' }], none);
    expect(groups.get(1)).toEqual([{ ...atlassian, tabIds: [jira.id, wiki.id, pr.id] }]);
    expect(moved).toEqual([pr.id]);
  });

  it('ignores unknown groups, unknown tabs, other windows and repeated moves', () => {
    const { groups, moved } = planMoves(
      tabs,
      clusters,
      [
        { tab: 4, group: 'Grafana' },
        { tab: 99, group: 'Atlassian' },
        { tab: 5, group: 'Atlassian' },
        { tab: 0, group: 'Atlassian' },
        { tab: 2, group: 'Atlassian' },
        { tab: 2, group: 'GitHub' },
      ],
      none,
    );
    expect(moved).toEqual([pr.id]);
    expect(groups.get(1)).toEqual([{ ...atlassian, tabIds: [jira.id, wiki.id, pr.id] }]);
  });

  it('keeps tabs placed by a learned rule', () => {
    const { groups, moved } = planMoves(tabs, clusters, [{ tab: 0, group: 'GitHub' }], new Set([jira.id]));
    expect(moved).toEqual([]);
    expect(groups.get(1)).toEqual([atlassian, github]);
  });

  it('does not change the clusters it was given', () => {
    planMoves(tabs, clusters, [{ tab: 4, group: 'Atlassian' }], none);
    expect(atlassian.tabIds).toEqual([jira.id, wiki.id]);
  });
});
