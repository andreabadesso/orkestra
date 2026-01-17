import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Orkestra',
  description: 'AI-native workflow orchestration with human-in-the-loop capabilities',
  lang: 'en-US',
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started/' },
      { text: 'Concepts', link: '/concepts/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'API Reference', link: '/api-reference/' },
      { text: 'Examples', link: '/examples/' },
    ],

    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Quick Start', link: '/getting-started/quick-start' },
            { text: 'First Workflow', link: '/getting-started/first-workflow' },
          ],
        },
      ],

      '/concepts/': [
        {
          text: 'Concepts',
          items: [
            { text: 'Architecture', link: '/concepts/architecture' },
            { text: 'Workflows', link: '/concepts/workflows' },
            { text: 'Tasks', link: '/concepts/tasks' },
            { text: 'Multi-tenancy', link: '/concepts/multi-tenancy' },
            { text: 'SLA and Escalation', link: '/concepts/sla-escalation' },
          ],
        },
      ],

      '/guides/': [
        {
          text: 'Guides',
          items: [
            { text: 'Writing Workflows', link: '/guides/writing-workflows' },
            { text: 'Form Schemas', link: '/guides/form-schemas' },
            { text: 'Assignment Strategies', link: '/guides/assignment-strategies' },
            { text: 'Notifications', link: '/guides/notifications' },
            { text: 'Deployment', link: '/guides/deployment' },
          ],
        },
      ],

      '/api-reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'MCP Tools', link: '/api-reference/mcp-tools' },
            { text: 'REST API', link: '/api-reference/rest-api' },
            { text: 'SDK Reference', link: '/api-reference/sdk-reference' },
            { text: 'CLI Reference', link: '/api-reference/cli-reference' },
          ],
        },
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Support Bot', link: '/examples/support-bot' },
            { text: 'Approval Workflow', link: '/examples/approval-workflow' },
            { text: 'Sales Pipeline', link: '/examples/sales-pipeline' },
          ],
        },
      ],

      '/': [
        {
          text: 'Documentation',
          items: [
            { text: 'Getting Started', link: '/getting-started/' },
            { text: 'Concepts', link: '/concepts/' },
            { text: 'Guides', link: '/guides/' },
            { text: 'API Reference', link: '/api-reference/' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/anomalyco/orkestra' }],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Orkestra Contributors',
    },
  },
});
