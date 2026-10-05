import { defineConfig } from 'wxt';
import { TIDY_COMMAND } from './lib/types';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Tab Tidy',
    description: 'One click groups your tabs by site, closes duplicates, and saves sessions.',
    permissions: ['tabs', 'tabGroups', 'storage'],
    action: { default_title: 'Tab Tidy' },
    commands: {
      [TIDY_COMMAND]: {
        suggested_key: { default: 'Alt+Shift+G' },
        description: 'Tidy all windows',
      },
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: '@tab-tidy',
          strict_min_version: '139.0',
          // With an API key, tab titles and site paths go to Anthropic.
          data_collection_permissions: { required: ['browsingActivity'] },
        },
      },
    }),
  }),
});
