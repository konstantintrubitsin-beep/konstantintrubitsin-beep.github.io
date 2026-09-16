import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://coslovs-copy.local',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
