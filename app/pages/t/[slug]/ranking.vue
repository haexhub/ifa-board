<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RankingTable from '~/components/stats/RankingTable.vue'
import TimeframePicker from '~/components/stats/TimeframePicker.vue'
import { useRanking, type TeamRanking } from '~/composables/useRanking'
import { useTeamSettings } from '~/composables/useTeamSettings'
import { useTimeframe } from '~/composables/useTimeframe'

definePageMeta({
  middleware: ['team-context'],
})

const { currentTeam, currentSlug } = useTeamContext()
const teamId = computed(() => currentTeam.value?.id ?? '')
const slug = computed(() => currentSlug.value ?? '')

const { getTeamRanking } = useRanking()
const { get: getSettings } = useTeamSettings()

const seasonStart = ref<string | null>(null)
if (teamId.value) {
  const s = await getSettings(teamId.value)
  seasonStart.value = s?.season_start ?? null
}

const timeframe = useTimeframe(slug, seasonStart)

const ranking = ref<TeamRanking | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
let latestLoad = 0

const load = async () => {
  if (!teamId.value) return
  const loadId = ++latestLoad
  isLoading.value = true
  loadError.value = null
  try {
    const nextRanking = await getTeamRanking(
      teamId.value,
      timeframe.range.value.from,
      timeframe.range.value.to,
    )
    if (loadId === latestLoad) ranking.value = nextRanking
  } catch (err) {
    if (loadId === latestLoad) {
      loadError.value = err instanceof Error ? err.message : 'Konnte Rangliste nicht laden'
    }
  } finally {
    if (loadId === latestLoad) isLoading.value = false
  }
}

watch(
  () => [teamId.value, timeframe.range.value.from, timeframe.range.value.to],
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <section class="space-y-6" data-testid="ranking-page">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">Rangliste</h1>
      <p class="text-sm text-neutral-600">
        Punkte je Spieler:in und Kategorie über den gewählten Zeitraum.
      </p>
    </header>

    <TimeframePicker
      :preset="timeframe.preset.value"
      :range="timeframe.range.value"
      :custom-from="timeframe.customFrom.value"
      :custom-to="timeframe.customTo.value"
      :season-available="!!seasonStart"
      @update:preset="timeframe.setPreset"
      @update:custom="(v) => timeframe.setCustom(v.from, v.to)"
    />

    <p v-if="isLoading" class="text-sm text-neutral-500">Lade Rangliste…</p>
    <p v-else-if="loadError" class="text-sm text-red-700" role="alert">{{ loadError }}</p>
    <RankingTable v-else :ranking="ranking" :slug="slug" :link-players="true" />
  </section>
</template>
