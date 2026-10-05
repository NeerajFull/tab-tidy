# Tab Tidy

One click groups the tabs in every window by site, closes duplicates, and lets you save and restore named sessions. Groups get names such as "GitHub", "Figma" or "youtube.com". Every action can be undone.

Staging and live copies of a site share one group. Drag a tab into another site's group once, and Tab Tidy remembers it. With your own Anthropic API key, Claude also moves related tabs, for example a Grafana dashboard of Jira bugs into the Atlassian group. Without a key, everything runs inside the browser.

Works in Chrome, Edge and Firefox 139+. Safari is not supported, because Safari extensions cannot create tab groups.

## How it works

1. **Grouping.** Tabs are grouped in the browser in a few milliseconds, one group per site. Groups need at least 2 tabs. Some apps span several sites and get one group each:
   - **Atlassian:** Jira and Confluence (`*.atlassian.net`, `*.atlassian.com`, `*.jira.com`).
   - **GitHub:** `github.com` and its subdomains.
   - **Figma:** `figma.com` and its subdomains.
   - **Google Cloud:** the console and the docs (`*.cloud.google.com`).

   Other sites are named by host, such as `youtube.com` or `mail.google.com`.
2. **Environments.** Copies of a site on another environment join the live site's group. `workflow.staging.anywhere.co` goes with `workflow.anywhere.co`, and the group takes the live name. Tab Tidy removes these words from host names: `staging`, `stage`, `stg`, `dev`, `develop`, `development`, `qa`, `uat`, `test`, `testing`, `preprod`, `pre-prod`, `sandbox`, `preview`, `beta`, `demo`, `prod` and `production`. A number may follow (`qa2`). Hyphen forms such as `app-staging` and `dev-app` count too, for `staging`, `stage`, `stg`, `dev`, `qa`, `uat`, `preprod` and `prod`. The domain itself is never changed, so `dev.to` stays `dev.to`.
3. **Learned rules.** Drag a tab into a group named after another app or site, for example a Grafana tab into the Atlassian group. When the tab stays there for 1.5 seconds, Tab Tidy saves a rule: tabs from `grafana.anywhere.co` go with Atlassian. Every later tidy applies it. Moves into groups with other names, such as a group you named by hand, are not learned. To remove a rule, drag the tab back into its own site's group, or delete the rule in Settings.
4. **AI check (optional).** If you saved an API key, Claude Opus 5.5 checks the groups after each tidy. It moves tabs that belong with another group in the same window. It never makes or renames groups, and it leaves tabs placed by your rules alone. The site groups appear at once; the AI moves usually follow a few seconds later. If the check fails, the site groups stay.
5. **Undo.** Undo puts back the tab order and groups from before the last action, and reopens closed duplicates. It also undoes the AI moves.

The popup shows measured times, for example "Grouped in 14 ms · AI moved 1 tab in 3.2 s".

**Shortcut:** `Alt+Shift+G` (`⌥⇧G` on Mac) tidies all windows without opening the popup. The icon badge shows ✓ when done. To change it, open `chrome://extensions/shortcuts` (Chrome), `edge://extensions/shortcuts` (Edge) or **Manage Extension Shortcuts** in `about:addons` (Firefox).

## Rules

- Tidy covers every normal window. A tab group cannot span windows, so each window gets its own groups.
- Duplicates are found across all windows. The copy in the window you tidied from is kept.
- Incognito and private windows are skipped.
- Pinned tabs, tabs playing audio, and tabs in a call (Google Meet, Zoom, Teams, Whereby, Slack huddles) are never grouped, closed or put to sleep.
- Tidy regroups every tab, including tabs in groups you made by hand. Undo puts your groups back. Tabs that are not web pages (such as `chrome://` pages) are taken out of groups and left loose.
- Duplicates are matched on the full URL. Tracking parameters (`utm_*`, `fbclid`, `gclid` and similar), a trailing slash and `www.` are ignored. The active tab, a pinned tab or a tab in a group is kept over a loose copy. A staging tab is never a duplicate of the live tab.
- **Sleep idle tabs** discards tabs in all windows that you have not used for the number of minutes set in Settings (default 30). Undo reloads them.
- **Saved sessions** save the tabs and groups of the current window. Restore opens them in a new window.

## Privacy

- Without an API key, nothing leaves the browser.
- With a key, only tab titles (first 80 characters), `site/path` (first 60 characters) and group names go to Claude. Query strings and `#fragments` are removed first.
- Requests go straight from the browser to `api.anthropic.com`. There is no Tab Tidy server.
- The API key and the learned rules are stored in `storage.local` for this browser profile only. They are not synced.
- Saved sessions stay on the device.

Permissions: `tabs`, `tabGroups` and `storage`. No host permissions are needed, because the Anthropic API allows direct browser requests (CORS). On Firefox, the add-on declares that it collects browsing activity, because tab titles and paths go to Claude when a key is saved.

## Development

```bash
npm install
npm run dev            # Chrome with hot reload
npm run dev:firefox
npm test               # unit tests (Vitest)
npm run compile        # type check
npm run build          # .output/chrome-mv3
npm run build:edge     # .output/edge-mv3
npm run build:firefox  # .output/firefox-mv3
npm run zip            # store-ready zip
```

Load a build by hand:

- **Chrome / Edge:** open `chrome://extensions` or `edge://extensions`, turn on Developer mode, click **Load unpacked**, and select `.output/chrome-mv3`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`.

Then open **Settings** from the popup and paste an Anthropic API key (`sk-ant-…`). Without a key, tabs are grouped by site and by your learned rules only.

## Known limits

- Rules apply to a whole site, not to one page. After you drag one Grafana dashboard into the Atlassian group, every Grafana tab goes there.
- Each tidy with a saved key sends one Claude Opus 5.5 request, billed to your key. To use a faster, cheaper model, change `MODEL` in `lib/ai.ts`.

- Undo covers the last tidy or sleep action, across all windows. It is lost when the browser restarts.
- Reopened duplicates start with fresh history (Tab Tidy does not use the `sessions` permission).
- The icons are WXT placeholders.
