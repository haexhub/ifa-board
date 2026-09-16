// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

const nuxtGlobals = {
  defineNuxtConfig: 'readonly',
  defineNuxtRouteMiddleware: 'readonly',
  navigateTo: 'readonly',
  useAsyncData: 'readonly',
  useRequestURL: 'readonly',
  useRoute: 'readonly',
  useSupabaseClient: 'readonly',
  useSupabaseUser: 'readonly',
  definePageMeta: 'readonly',
  useTeamContext: 'readonly',
  usePlayers: 'readonly',
  useAuth: 'readonly',
  useCategories: 'readonly',
  useInvitations: 'readonly',
  useProfile: 'readonly',
  useTeams: 'readonly',
  useTeamSettings: 'readonly',
}

export default [
  {
    ignores: ['.output/**', '.nuxt/**', 'dist/**', 'node_modules/**', 'supabase/**', 'playwright-report/**', 'coverage/**', 'app/types/database.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: nuxtGlobals,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
]
