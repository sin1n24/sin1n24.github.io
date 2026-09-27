import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';

// https://astro.build/config
export default defineConfig({
  site: 'https://sin1.studio',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin/'),
      // public/ 配下の静的ページ（Astro管理外）もサイトマップに載せる
      customPages: ['https://sin1.studio/hikageneko/'],
    }),
  ],
  vite: {
    plugins: [yaml()],
  },
});
