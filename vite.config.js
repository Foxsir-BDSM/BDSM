import { defineConfig } from 'vite';
import { resolve } from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    open: '/index.html',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'assets'),  // 将 @/ 指向 assets 目录
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(
        glob.sync(
          [
            '**/*.html',
            // ★ 强制包含以下关键 JS 文件，确保 Token 被打包 ★
            'assets/js/content-manager.js',
            'assets/js/supabase-client.js',
            'assets/js/auth.js',
            'assets/js/identity.js',
            'assets/js/ui-helpers.js',
            'assets/js/request.js',
            'assets/js/loading.js',
            'assets/js/registry.js',
            'assets/js/content-config.js',
            'assets/js/guard.js',
            'assets/js/main.js',
            'assets/js/admin.js',
            'assets/js/avatar.js',
            'assets/js/level.js',
            'assets/js/launcher.js',
            'assets/js/identity-selector.js',
            'assets/js/config.js',
          ],
          {
            ignore: ['node_modules/**', 'dist/**', 'assets/pages/dom-archive/**'],
            cwd: __dirname,
          }
        ).map((file) => {
          const name = file.replace(/\.html$/, '').replace(/[\/\\]/g, '_');
          return [name, resolve(__dirname, file)];
        })
      ),
    },
  },
  optimizeDeps: {
    entries: [],
  },
});