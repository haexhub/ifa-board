<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import RankingTable from '~/components/stats/RankingTable.vue'
import TimeframePicker from '~/components/stats/TimeframePicker.vue'
import { useRanking, type TeamRanking } from '~/composables/useRanking'
import { useTeamSettings } from '~/composables/useTeamSettings'
import { useTimeframe } from '~/composables/useTimeframe'
import type { Database } from '~/types/database'

definePageMeta({
  middleware: ['team-context'],
})

const { currentTeam, currentSlug, isTrainer } = useTeamContext()
const user = useSupabaseUser()
const client = useSupabaseClient<Database>()
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

const linkedPlayerId = ref<string | null>(null)
const ranking = ref<TeamRanking | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
let latestLoad = 0

const loadLinkedPlayer = async () => {
  if (!teamId.value || !user.value) return
  const { data } = await client
    .from('players')
    .select('id')
    .eq('team_id', teamId.value)
    .eq('linked_user_id', user.value.id)
    .maybeSingle()
  linkedPlayerId.value = (data as { id: string } | null)?.id ?? null
}

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

await loadLinkedPlayer()

watch(
  () => [teamId.value, timeframe.range.value.from, timeframe.range.value.to],
  () => void load(),
  { immediate: true },
)

const myRow = computed(() =>
  linkedPlayerId.value
    ? (ranking.value?.rows.find((r) => r.player_id === linkedPlayerId.value) ?? null)
    : null,
)

const topThree = computed(() => ranking.value?.rows.slice(0, 3) ?? [])
</script>

<template>
  <section class="space-y-6" data-testid="dashboard-page">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">{{ currentTeam?.name ?? 'Team' }}</h1>
      <p class="text-neutral-600">{{ isTrainer ? 'Trainer-Ansicht' : 'Spieler-Ansicht' }}</p>
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

    <template v-if="!isTrainer">
      <div
        v-if="myRow"
        class="rounded border border-neutral-200 bg-white p-4 flex items-center justify-between gap-4"
        data-testid="my-rank-card"
      >
        <div>
          <p class="text-sm text-neutral-500">Dein Platz</p>
          <p class="text-3xl font-semibold text-neutral-900">
            {{ myRow.rank_position }}
          </p>
        </div>
        <NuxtLink
          v-if="linkedPlayerId"
          :to="`/t/${slug}/players/${linkedPlayerId}`"
          class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
        >
          Mein Zeitverlauf
        </NuxtLink>
      </div>
      <p v-else-if="linkedPlayerId" class="text-sm text-neutral-500" data-testid="my-rank-missing">
        Für dich sind im gewählten Zeitraum keine Punkte erfasst.
      </p>
      <p v-else class="text-sm text-neutral-500" data-testid="not-linked">
        Dein Account ist noch keinem Spieler-Datensatz zugeordnet.
      </p>
    </template>

    <section class="space-y-2" data-testid="top-three">
      <h2 class="text-lg font-semibold text-neutral-900">Top 3</h2>
      <p v-if="isLoading" class="text-sm text-neutral-500">Lade…</p>
      <p v-else-if="loadError" class="text-sm text-red-700" role="alert">{{ loadError }}</p>
      <p v-else-if="topThree.length === 0" class="text-sm text-neutral-500">
        Noch keine Punkte im gewählten Zeitraum.
      </p>
      <ol v-else class="space-y-1">
        <li
          v-for="row in topThree"
          :key="row.player_id"
          class="rounded border border-neutral-200 bg-white px-3 py-2 flex justify-between items-center"
        >
          <span>
            <span class="font-semibold mr-2">{{ row.rank_position }}.</span>
            <span class="text-neutral-500 mr-1">
              {{ row.jersey_number !== null ? `#${row.jersey_number}` : '—' }}
            </span>
            {{ row.name }}
          </span>
          <NuxtLink
            :to="`/t/${slug}/players/${row.player_id}`"
            class="text-sm underline text-neutral-600"
          >
            Details
          </NuxtLink>
        </li>
      </ol>
    </section>

    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        :to="`/t/${slug}/ranking`"
        class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Vollständige Rangliste
      </NuxtLink>
      <NuxtLink
        :to="`/t/${slug}/trainings`"
        class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Trainings
      </NuxtLink>
      <NuxtLink
        v-if="isTrainer"
        :to="`/t/${slug}/team/members`"
        class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Mitglieder
      </NuxtLink>
      <NuxtLink
        v-if="isTrainer"
        :to="`/t/${slug}/categories`"
        class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Kategorien
      </NuxtLink>
      <NuxtLink
        v-if="isTrainer"
        :to="`/t/${slug}/players`"
        class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Spieler
      </NuxtLink>
      <NuxtLink
        v-if="isTrainer"
        :to="`/t/${slug}/team/settings`"
        class="min-h-touch inline-flex items-center px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
      >
        Einstellungen
      </NuxtLink>
    </nav>

    <RankingTable
      v-if="isTrainer && !loadError"
      :ranking="ranking"
      :slug="slug"
      :link-players="true"
      :highlight-player-id="linkedPlayerId"
    />
  </section>
</template>
