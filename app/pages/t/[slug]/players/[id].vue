<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PlayerProgressChart from '~/components/stats/PlayerProgressChart.vue'
import TimeframePicker from '~/components/stats/TimeframePicker.vue'
import { useCategories, type ActiveCategory } from '~/composables/useCategories'
import { usePlayerScores, type CategoryScoreRow } from '~/composables/usePlayerScores'
import { useTeamSettings } from '~/composables/useTeamSettings'
import { useTimeframe } from '~/composables/useTimeframe'
import type { Database } from '~/types/database'

definePageMeta({
  middleware: ['team-context'],
})

const route = useRoute()
const playerId = String(route.params.id)

const { currentTeam, currentSlug } = useTeamContext()
const client = useSupabaseClient<Database>()
const teamId = computed(() => currentTeam.value?.id ?? '')
const slug = computed(() => currentSlug.value ?? '')

const { listActive: listCategories } = useCategories()
const { forPlayer, playerTimeSeries } = usePlayerScores()
const { get: getSettings } = useTeamSettings()

const seasonStart = ref<string | null>(null)
if (teamId.value) {
  const s = await getSettings(teamId.value)
  seasonStart.value = s?.season_start ?? null
}

type PlayerInfo = {
  id: string
  name: string
  jersey_number: number | null
  position: string | null
}

const player = ref<PlayerInfo | null>(null)
const categories = ref<ActiveCategory[]>([])
const scores = ref<CategoryScoreRow[]>([])
const timeSeries = ref<Map<string, { date: string; value: number }[]>>(new Map())
const isLoading = ref(false)

const timeframe = useTimeframe(slug, seasonStart)

const loadStatic = async () => {
  const [{ data: p }, cs] = await Promise.all([
    client
      .from('players')
      .select('id, name, jersey_number, position')
      .eq('id', playerId)
      .maybeSingle(),
    teamId.value ? listCategories(teamId.value) : Promise.resolve([]),
  ])
  player.value = (p as PlayerInfo) ?? null
  categories.value = cs
}

const loadTimeframed = async () => {
  if (!teamId.value) return
  isLoading.value = true
  try {
    const [s, series] = await Promise.all([
      forPlayer(teamId.value, playerId, timeframe.range.value.from, timeframe.range.value.to),
      playerTimeSeries(
        teamId.value,
        playerId,
        timeframe.range.value.from,
        timeframe.range.value.to,
      ),
    ])
    scores.value = s
    timeSeries.value = series
  } finally {
    isLoading.value = false
  }
}

await loadStatic()

watch(
  () => [timeframe.range.value.from, timeframe.range.value.to],
  () => void loadTimeframed(),
  { immediate: true },
)
</script>

<template>
  <section v-if="player" class="space-y-6" data-testid="player-detail-page">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">
        <span class="text-neutral-500 mr-2">
          {{ player.jersey_number !== null ? `#${player.jersey_number}` : '—' }}
        </span>
        {{ player.name }}
      </h1>
      <p v-if="player.position" class="text-sm text-neutral-600">
        Position: {{ player.position }}
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

    <p v-if="isLoading" class="text-sm text-neutral-500">Lade Verlauf…</p>
    <PlayerProgressChart
      v-else
      :categories="categories"
      :time-series="timeSeries"
      :scores="scores"
    />

    <NuxtLink :to="`/t/${slug}/ranking`" class="text-sm underline text-neutral-600">
      ← Zur Rangliste
    </NuxtLink>
  </section>
  <p v-else class="text-neutral-500">Spieler:in nicht gefunden.</p>
</template>
