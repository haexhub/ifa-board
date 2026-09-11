import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  devtools: { enabled: true },
  ssr: true,

  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],

  typescript: {
    strict: true,
    typeCheck: false,
  },

  css: ['~/assets/css/main.css'],

  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/callback',
      include: undefined,
      exclude: ['/login', '/callback', '/public/**', '/invite/**'],
      cookieRedirect: false,
    },
    types: '~/types/database.ts',
  },

  imports: {
    dirs: ['composables/**'],
  },

  runtimeConfig: {
    supabaseServiceRoleKey: '',
    supabaseDbUrl: '',
  },

  alias: {
    '@': fileURLToPath(new URL('./app', import.meta.url)),
    '~': fileURLToPath(new URL('./app', import.meta.url)),
    '~~': fileURLToPath(new URL('.', import.meta.url)),
    '@@': fileURLToPath(new URL('.', import.meta.url)),
  },

  srcDir: 'app/',
  serverDir: 'app/server',

  future: {
    compatibilityVersion: 4,
  },
})
