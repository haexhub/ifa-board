<script setup lang="ts">
import { computed, ref } from 'vue'
import TeamSwitcher from '~/components/team/TeamSwitcher.vue'

const route = useRoute()
const user = useSupabaseUser()
const client = useSupabaseClient()
const signOutError = ref<string | null>(null)

const currentSlug = computed(() => (route.params as { slug?: string }).slug ?? null)

const signOut = async () => {
  signOutError.value = null
  const { error } = await client.auth.signOut()
  if (error) {
    signOutError.value = 'Abmelden fehlgeschlagen. Bitte versuche es erneut.'
    return
  }
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="border-b bg-card sticky top-0 z-10">
      <div class="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
        <NuxtLink
          v-if="currentSlug"
          :to="`/t/${currentSlug}`"
          class="font-semibold text-foreground truncate"
        >
          ifa-board
        </NuxtLink>
        <span v-else class="font-semibold text-foreground">ifa-board</span>

        <div class="flex items-center gap-2">
          <TeamSwitcher v-if="currentSlug" />
          <span v-if="user?.email" class="text-sm text-muted-foreground hidden sm:inline">
            {{ user.email }}
          </span>
          <ShadcnButton type="button" variant="outline" size="sm" @click="signOut">
            Abmelden
          </ShadcnButton>
        </div>
      </div>
      <p v-if="signOutError" class="px-4 pb-2 text-center text-sm text-destructive" role="alert">
        {{ signOutError }}
      </p>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
