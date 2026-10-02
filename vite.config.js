import { defineConfig } from 'vite';
import { resolve } from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ================================================================
// 功能性质隔离后的目录结构
// ================================================================
//  src/
//   ├── launcher/   启动器（公开层：引导页 / 用户指南 / 登录注册 / 控制中心 / 模块介绍 / 404）
//   ├── admin/      管理后台（admin.html + 两个内容管理台 + 私有模块）
//   ├── modules/    业务模块（一个模块一个文件夹，自包含）
//   │    ├── dom-archive/    欲主之殿（占位）
//   │    ├── sub-archive/    欲渊之庭（下位者档案馆）
//   │    ├── knowledge/      欲识之海（知识区）
//   │    ├── mission/        欲炼之途（任务区）
//   │    └── random/         淫梦织境 / 欲缘之遇（占位）
//   └── shared/     共享层（js / css / config / assets）
//
//  别名 @ 指向 src/ ，因此：
//    @/shared/js/auth.js              共享基础设施
//    @/shared/config/archive/*.js     共享配置
//    @/admin/content-manager.js       管理后台私有模块
// ================================================================

/** 强制纳入构建的 JS 入口（确保被内联 script 引用的模块一定产出 chunk） */
const JS_ENTRIES = [
  'src/shared/js/supabase-client.js',
  'src/shared/js/auth.js',
  'src/shared/js/identity.js',
  'src/shared/js/identity-selector.js',
  'src/shared/js/loading.js',
  'src/shared/js/cache.js',
  'src/shared/js/ui-helpers.js',
  'src/shared/js/config.js',
  'src/shared/js/registry.js',
  'src/shared/js/guard.js',
  'src/shared/js/request.js',
  'src/shared/js/level.js',
  'src/shared/js/avatar.js',
  'src/shared/js/launcher.js',
  'src/shared/js/main.js',
  'src/admin/content-config.js',
  'src/admin/content-manager.js',
  'src/admin/admin.js',
];

// ================================================================
//  开发态路由中间件
// ----------------------------------------------------------------
//  站点 URL 与磁盘路径是解耦的（src/launcher/index.html 对外是 /index.html），
//  生产构建由 Vite 自动重写为扁平结构，但 dev server 按磁盘路径解析，
//  因此需要在 dev 模式下做一次 URL → 磁盘文件 的映射，否则所有页面 404。
// ================================================================
const LAUNCHER_PAGES = ['404', 'about', 'auth', 'index', 'landing', 'module'];
const ADMIN_PAGES = ['admin', 'admin-article', 'admin-article-simple'];

function devRoutePlugin() {
  return {
    name: 'foxsir-dev-route',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '/';
        const qIndex = url.indexOf('?');
        const pathname = qIndex >= 0 ? url.slice(0, qIndex) : url;
        const search = qIndex >= 0 ? url.slice(qIndex) : '';
        const rel = decodeURIComponent(pathname).replace(/^\/+/, '');

        /** 把站点 URL 改写为磁盘路径 */
        const rewrite = (target) => {
          req.url = '/' + target + search;
        };

        // 站点根
        if (!rel) {
          rewrite('src/launcher/index.html');
          return next();
        }

        // /index.html、/about.html … → src/launcher/* 或 src/admin/*
        const pageMatch = rel.match(/^([^/]+)\.html$/);
        if (pageMatch) {
          if (LAUNCHER_PAGES.includes(pageMatch[1])) {
            rewrite(`src/launcher/${rel}`);
            return next();
          }
          if (ADMIN_PAGES.includes(pageMatch[1])) {
            rewrite(`src/admin/${rel}`);
            return next();
          }
        }

        // /modules/<mod> 或 /modules/<mod>/ → src/modules/<mod>/index.html
        const modDir = rel.match(/^modules\/([^/]+)\/?$/);
        if (modDir) {
          rewrite(`src/modules/${modDir[1]}/index.html`);
          return next();
        }

        // /modules/<mod>/xxx.html|css|js|jpg → src/modules/<mod>/...
        if (rel.startsWith('modules/')) {
          rewrite(`src/${rel}`);
          return next();
        }

        // /shared/... → src/shared/...
        if (rel.startsWith('shared/')) {
          rewrite(`src/${rel}`);
          return next();
        }

        // 管理后台的同级脚本：/admin.js → src/admin/admin.js
        if (rel === 'admin.js') {
          rewrite('src/admin/admin.js');
          return next();
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [devRoutePlugin()],
  server: {
    port: 5173,
    open: '/index.html',
  },
  resolve: {
    alias: {
      // ★ 别名根 = src/ ，与目录结构语义一致
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(
        glob.sync(
          ['src/**/*.html', ...JS_ENTRIES],
          {
            // _archive/ 为不参与构建的历史归档；dist 与 node_modules 排除
            ignore: ['node_modules/**', 'dist/**', '_archive/**', 'tools/**', 'sop/**', 'docs/**'],
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
