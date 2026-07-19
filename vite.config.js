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
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(
        glob.sync('**/*.html', {
          ignore: ['node_modules/**', 'dist/**', 'assets/pages/dom-archive/**'],
          cwd: __dirname,
        }).map(file => {
          const name = file.replace(/\.html$/, '').replace(/[\/\\]/g, '_');
          return [name, resolve(__dirname, file)];
        })
      ),
    },
  },
  // ⚠️ 确保下面这行被删除或注释掉
  // publicDir: 'assets',
  optimizeDeps: {
    entries: [],
  }
});