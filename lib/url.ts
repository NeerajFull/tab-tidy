const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|_gl)$/i;
const NEW_TAB_URLS = new Set(['chrome://newtab/', 'edge://newtab/', 'about:newtab', 'about:home', 'about:blank']);
const MAX_PATH = 60;

// Environment labels in host names, such as "staging" in workflow.staging.anywhere.co. A number may follow (qa2).
const ENV_LABEL =
  /^(staging|stage|stg|dev|develop|development|qa|uat|test|testing|preprod|pre-prod|sandbox|preview|beta|demo|prod|production)\d*$/;
// The same words joined to a name with a hyphen, as in app-staging or dev-app.
const ENV_PREFIX = /^(staging|stage|stg|dev|qa|uat|preprod|prod)\d*-(?=.)/;
const ENV_SUFFIX = /(?<=.)-(staging|stage|stg|dev|qa|uat|preprod|prod)\d*$/;
// Second-level labels under a country code, as in co.uk or com.au.
const COUNTRY_SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go']);

const parse = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

export const isWebUrl = (raw: string): boolean => {
  const url = parse(raw);
  return url?.protocol === 'http:' || url?.protocol === 'https:';
};

export const isNewTabUrl = (raw: string): boolean => NEW_TAB_URLS.has(raw);

export const siteOf = (raw: string): string => parse(raw)?.hostname.replace(/^www\./, '') ?? '';

// Labels that name the domain itself (anywhere.co, bbc.co.uk). They are never treated as environments.
const domainLength = (labels: string[]): number => {
  const [second = '', top = ''] = labels.slice(-2);
  return labels.length > 2 && top.length === 2 && COUNTRY_SLD.has(second) ? 3 : 2;
};

// The site without environment labels, so staging and live share one site. dev.to stays dev.to.
export const withoutEnv = (site: string): string => {
  const labels = site.split('.');
  const keep = domainLength(labels);
  if (labels.length <= keep) return site;
  const subdomain = labels
    .slice(0, -keep)
    .filter((label) => !ENV_LABEL.test(label))
    .map((label) => label.replace(ENV_PREFIX, '').replace(ENV_SUFFIX, ''))
    .filter((label) => !ENV_LABEL.test(label));
  return [...subdomain, ...labels.slice(-keep)].join('.');
};

// Site and path only. Query strings and #fragments can hold tokens, so they never leave the browser.
export const sitePath = (raw: string): string => {
  const url = parse(raw);
  if (!url) return '';
  const path = url.pathname === '/' ? '' : url.pathname.slice(0, MAX_PATH);
  return `${url.hostname.replace(/^www\./, '')}${path}`;
};

export const dedupeKey = (raw: string): string => {
  const url = parse(raw);
  if (!url || !isWebUrl(raw)) return raw;
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${url.host.replace(/^www\./, '')}${path}${url.search}${url.hash}`;
};
