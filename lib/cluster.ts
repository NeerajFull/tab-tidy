import { siteOf, withoutEnv } from './url';
import type { Cluster, Rule, TabLite } from './types';

// Apps that span several hosts get one group. Each host also matches its subdomains.
const APPS: { name: string; hosts: string[] }[] = [
  { name: 'Atlassian', hosts: ['atlassian.net', 'atlassian.com', 'jira.com'] },
  { name: 'GitHub', hosts: ['github.com'] },
  { name: 'Figma', hosts: ['figma.com'] },
  { name: 'Google Cloud', hosts: ['cloud.google.com'] },
];
const APP_NAMES = new Set(APPS.map((app) => app.name));

export type Rules = ReadonlyMap<string, string>;

export const toRules = (rules: Rule[]): Rules => new Map(rules.map((rule) => [rule.from, rule.to]));

const onHost = (site: string, host: string): boolean => site === host || site.endsWith(`.${host}`);

// The app name for a known app, else the site without "www." and environment labels. Empty for URLs without a host.
export const appOf = (url: string): string => {
  const site = siteOf(url);
  return APPS.find((app) => app.hosts.some((host) => onHost(site, host)))?.name ?? withoutEnv(site);
};

// The app, after learned rules such as "grafana.anywhere.co goes with Atlassian". Stops at loops.
export const groupKeyOf = (url: string, rules: Rules): string => {
  let key = appOf(url);
  const seen = new Set<string>();
  for (let next = rules.get(key); next !== undefined && !seen.has(key); next = rules.get(key)) {
    seen.add(key);
    key = next;
  }
  return key;
};

const mostCommon = (values: string[]): string => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0] ?? '';
  for (const [value, count] of counts) if (count > (counts.get(best) ?? 0)) best = value;
  return best;
};

// Names a group after its own tabs: the app name, or the site most of them are on.
// Staging and live tabs get the live site; staging tabs alone keep the staging site.
const labelFor = (key: string, urls: string[]): string => {
  const home = urls.filter((url) => appOf(url) === key);
  if (APP_NAMES.has(key) && home.length > 0) return key;
  const sites = (home.length > 0 ? home : urls).map(siteOf);
  return sites.includes(key) ? key : mostCommon(sites);
};

export const clusterTabs = (tabs: TabLite[], rules: Rules = new Map(), minSize = 2): Cluster[] => {
  const buckets = new Map<string, TabLite[]>();
  for (const tab of tabs) {
    const key = groupKeyOf(tab.url, rules);
    if (!key) continue;
    buckets.set(key, [...(buckets.get(key) ?? []), tab]);
  }
  return [...buckets]
    .filter(([, members]) => members.length >= minSize)
    .map(([key, members]) => ({
      key,
      label: labelFor(key, members.map((tab) => tab.url)),
      tabIds: members.map((tab) => tab.id),
    }));
};
