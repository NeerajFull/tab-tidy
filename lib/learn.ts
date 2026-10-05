import { appOf } from './cluster';
import type { Rule, TabLite } from './types';
import { siteOf } from './url';

type TabRef = Pick<TabLite, 'id' | 'url'>;

// The user put a tab in a group named after another app or site, so that tab's site goes there from now on.
// Groups with other names (made by hand, or named after a task) teach nothing: a whole site should not follow them.
export const ruleFromMove = (moved: TabRef, groupTitle: string, members: TabRef[]): Rule | null => {
  const from = appOf(moved.url);
  if (!from || !groupTitle) return null;
  const anchor = members.find(
    (tab) => tab.id !== moved.id && (appOf(tab.url) === groupTitle || siteOf(tab.url) === groupTitle),
  );
  return anchor ? { from, to: appOf(anchor.url) } : null;
};

// Adds or replaces the rule for `from`. A tab put back in its own app's group removes the rule.
// Returns the same array when nothing changes.
export const withRule = (rules: Rule[], rule: Rule): Rule[] => {
  const current = rules.find((item) => item.from === rule.from);
  const removing = rule.from === rule.to;
  if (removing ? !current : current?.to === rule.to) return rules;
  const others = rules.filter((item) => item.from !== rule.from);
  return removing ? others : [...others, rule];
};
