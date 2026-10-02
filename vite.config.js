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

export default defineConfig({
  base: '/',
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
