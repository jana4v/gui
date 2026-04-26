import Aura from '@primeuix/themes/aura';
import MyPreset from "./CustomThemes";
import pkg from './package.json' with { type: 'json' };

export default defineNuxtConfig({
  // Nuxt 4 compatibility
  future: {
    compatibilityVersion: 4,
  },
  
  // Directory configuration for Nuxt 4
  srcDir: 'app/',
  
  css: [
    '@fortawesome/fontawesome-free/css/all.css',
    'handsontable/styles/handsontable.css',
    'handsontable/styles/ht-theme-main.css',
    'handsontable/styles/ht-icons-main.css',
  ],

  compatibilityDate: '2024-07-04',

  ssr: false,
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      APP_VERSION: pkg.version,
      APP_NAME: pkg.name,
      // eslint-disable-next-line node/prefer-global/process
      APP_MODE: process.env?.NODE_ENV,
    },
  },

  // Performance optimizations
  vite: {
    optimizeDeps: {
      exclude: ['monaco-editor'],
    },
    plugins: [
      {
        // monaco-editor's marked.js has a sourceMappingURL pointing to a file
        // that is not shipped in the npm package. Vite reads the reference at
        // load time, so strip the comment in a pre-load hook to avoid the WARN.
        name: 'monaco-sourcemap-fix',
        enforce: 'pre' as const,
        async load(id: string) {
          if (id.includes('monaco-editor') && id.replace(/\\/g, '/').includes('/marked/marked.js')) {
            const { readFile } = await import('node:fs/promises')
            const code = await readFile(id.split('?')[0], 'utf-8')
            return {
              code: code.replace(/\/\/# sourceMappingURL=\S+\.map\b/g, ''),
              map: null,
            }
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        // @univerjs packages declare react/react-dom as peer deps but this app
        // doesn't use React — mark them external so Rollup doesn't try to bundle them.
        // Catch react, react-dom, react-dom/client, react/jsx-runtime, etc.
        external: (id) => id === 'react' || id.startsWith('react-dom') || id.startsWith('react/'),
        output: {
          manualChunks: {
            vendor: ['vue', 'pinia'],
            primevue: ['primevue'],
            charts: ['ag-charts-vue3', 'ag-grid-vue3'],
            utils: ['lodash', 'uuid'],
          },
        },
      },
    },
  },

  modules: [
    '@pinia/nuxt',
    '@nuxt/content',
    '@vueuse/nuxt',
    '@nuxt/image',
    '@nuxt/fonts',
    '@primevue/nuxt-module',
    '@unocss/nuxt',
    ['@vite-pwa/nuxt', {
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mainframe GUI',
        short_name: 'GUI',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: [], // no precaching — installability only
      },
    }],
  ],

  i18n: {
    langDir: 'locales',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
    ],
    vueI18n: './vue-i18n.options.ts',
  },

  content: {
    highlight: {
      theme: {
        // Default theme (same as single string)
        default: 'github-light',
        // Theme used if `html.dark`
        dark: 'github-dark',
      }
    }
  },
  
  primevue: {
    autoImport: true,
    options: {
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
      ripple: true,
    },
    importPT: { as: 'Aura', from: '@primeuix/themes/aura' },
    components: {
      prefix: '',
    },
  },

  build: {
    transpile: ['nuxt', 'primevue'],
    
  },

  sourcemap: {
    client: 'hidden', // Better for debugging while still being production-friendly
    server: false,
  },
  app: {
    baseURL: '/',
  },

  nitro: {
    output: {
      // Static files land in GoLang New/webserver/dist/web/gui after `nuxt generate`.
      publicDir: '../GoLang New/dist/web/gui',
    },
    prerender: {
      crawlLinks: false,
      routes: ['/sitemap.xml'],
    },
    devProxy: {
      '/iam/api/v1': {
        target: 'http://localhost:21005',
        changeOrigin: true,
      },
      '/api/go/v1': {
        target: 'http://localhost:21000',
        changeOrigin: true,
      },
    },
  },
  
  
});