<script setup lang="ts">
definePageMeta({
  middleware: ['team-context'],
})

const { currentTeam, isTrainer } = useTeamContext()
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">{{ currentTeam?.name ?? 'Team' }}</h1>
      <p class="text-neutral-600">
        {{ isTrainer ? 'Trainer-Ansicht' : 'Spieler-Ansicht' }}
      </p>
    </header>
    <p class="text-neutral-500 text-sm">
      Dashboard-Inhalte kommen mit US2 (Rangliste + Zeitverlauf).
    </p>
    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        v-if="isTrainer"
        :to="`/t/${currentTeam?.slug}/team/members`"
        class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Mitglieder verwalten
      </NuxtLink>
    </nav>
  </section>
</template>
