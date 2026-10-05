import { describe, expect, it } from 'vitest';
import { appOf, clusterTabs, groupKeyOf, toRules } from '../lib/cluster';
import { makeTab } from './fixtures';

describe('appOf', () => {
  it('names apps that span several hosts', () => {
    expect(appOf('https://x.atlassian.net/browse/FC-1610')).toBe('Atlassian');
    expect(appOf('https://x.atlassian.net/wiki/spaces/ENG')).toBe('Atlassian');
    expect(appOf('https://home.atlassian.com/')).toBe('Atlassian');
    expect(appOf('https://gist.github.com/u/1')).toBe('GitHub');
    expect(appOf('https://www.figma.com/design/abc')).toBe('Figma');
    expect(appOf('https://console.cloud.google.com/run/detail/us-central1/default')).toBe('Google Cloud');
    expect(appOf('https://cloud.google.com/run/docs')).toBe('Google Cloud');
  });

  it('uses the site for other URLs', () => {
    expect(appOf('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(appOf('https://mail.google.com/mail/u/0')).toBe('mail.google.com');
    expect(appOf('https://notgithub.com/')).toBe('notgithub.com');
    expect(appOf('not a url')).toBe('');
  });

  it('gives staging and live the same site', () => {
    expect(appOf('https://workflow.staging.anywhere.co/adminqueuegae#AgentSkill')).toBe('workflow.anywhere.co');
    expect(appOf('https://workflow.anywhere.co/adminqueuegae#AgentSkill')).toBe('workflow.anywhere.co');
  });
});

describe('groupKeyOf', () => {
  it('follows learned rules, including chains', () => {
    const rules = toRules([
      { from: 'grafana.anywhere.co', to: 'Atlassian' },
      { from: 'sentry.io', to: 'grafana.anywhere.co' },
    ]);
    expect(groupKeyOf('https://grafana.anywhere.co/d/1/bugs', rules)).toBe('Atlassian');
    expect(groupKeyOf('https://grafana.staging.anywhere.co/d/1/bugs', rules)).toBe('Atlassian');
    expect(groupKeyOf('https://sentry.io/issues/1', rules)).toBe('Atlassian');
    expect(groupKeyOf('https://github.com/o/r', rules)).toBe('GitHub');
  });

  it('stops at a loop', () => {
    const rules = toRules([
      { from: 'a.com', to: 'b.com' },
      { from: 'b.com', to: 'a.com' },
    ]);
    expect(groupKeyOf('https://a.com/', rules)).toBe('a.com');
  });
});

describe('clusterTabs', () => {
  it('keeps each app in its own group, even when tabs share a ticket key', () => {
    const jira = makeTab({ url: 'https://x.atlassian.net/browse/FC-1610', title: 'FC-1610 Rate limit' });
    const pr = makeTab({ url: 'https://github.com/o/r/pull/1', title: 'FC-1610: Rate limit' });
    const figma = makeTab({ url: 'https://www.figma.com/design/1', title: 'FC-1610 design' });
    const wiki = makeTab({ url: 'https://x.atlassian.net/wiki/spaces/ENG/pages/1', title: 'Rate limit spec' });
    const repo = makeTab({ url: 'https://github.com/o/r', title: 'o/r' });
    const figma2 = makeTab({ url: 'https://figma.com/design/2', title: 'Design 2' });
    expect(clusterTabs([jira, pr, figma, wiki, repo, figma2])).toEqual([
      { key: 'Atlassian', label: 'Atlassian', tabIds: [jira.id, wiki.id] },
      { key: 'GitHub', label: 'GitHub', tabIds: [pr.id, repo.id] },
      { key: 'Figma', label: 'Figma', tabIds: [figma.id, figma2.id] },
    ]);
  });

  it('puts the Cloud console and Cloud docs in one group', () => {
    const run = makeTab({ url: 'https://console.cloud.google.com/run?project=p' });
    const docs = makeTab({ url: 'https://cloud.google.com/run/docs' });
    expect(clusterTabs([run, docs])).toEqual([{ key: 'Google Cloud', label: 'Google Cloud', tabIds: [run.id, docs.id] }]);
  });

  it('puts staging and live in one group named after the live site', () => {
    const live = makeTab({ url: 'https://workflow.anywhere.co/adminqueuegae#AgentSkill' });
    const staging = makeTab({ url: 'https://workflow.staging.anywhere.co/adminqueuegae#AgentSkill' });
    expect(clusterTabs([staging, live])).toEqual([
      { key: 'workflow.anywhere.co', label: 'workflow.anywhere.co', tabIds: [staging.id, live.id] },
    ]);
  });

  it('names a group of staging tabs after the staging site', () => {
    const one = makeTab({ url: 'https://workflow.staging.anywhere.co/a' });
    const two = makeTab({ url: 'https://workflow.staging.anywhere.co/b' });
    expect(clusterTabs([one, two])[0]?.label).toBe('workflow.staging.anywhere.co');
  });

  it('puts tabs in the group a learned rule names', () => {
    const rules = toRules([{ from: 'grafana.anywhere.co', to: 'Atlassian' }]);
    const jira = makeTab({ url: 'https://x.atlassian.net/browse/BC-17593' });
    const grafana = makeTab({ url: 'https://grafana.anywhere.co/d/aeik/bug-slo-dashboard-bc' });
    expect(clusterTabs([jira, grafana], rules)).toEqual([
      { key: 'Atlassian', label: 'Atlassian', tabIds: [jira.id, grafana.id] },
    ]);
  });

  it('names a rule group after its own tabs when the target app has no tabs', () => {
    const rules = toRules([{ from: 'grafana.anywhere.co', to: 'Atlassian' }]);
    const one = makeTab({ url: 'https://grafana.anywhere.co/d/1' });
    const two = makeTab({ url: 'https://grafana.anywhere.co/d/2' });
    expect(clusterTabs([one, two], rules)[0]?.label).toBe('grafana.anywhere.co');
  });

  it('drops single-tab clusters', () => {
    expect(clusterTabs([makeTab({ url: 'https://a.com' }), makeTab({ url: 'https://b.com' })])).toEqual([]);
  });
});
