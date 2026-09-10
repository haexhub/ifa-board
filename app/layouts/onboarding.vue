<script setup lang="ts">
const user = useSupabaseUser()
const client = useSupabaseClient()

const signOut = async () => {
  await client.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <header class="border-b bg-white">
      <div class="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
        <span class="font-semibold text-neutral-900">ifa-board</span>
        <button
          v-if="user"
          type="button"
          class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
          @click="signOut"
        >
          Abmelden
        </button>
      </div>
    </header>
    <main class="mx-auto max-w-2xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>
