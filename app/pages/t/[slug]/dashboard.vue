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
    .eq('linked_user_id', user.value.sub)
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
    <header class="space-y-1.5">
      <h1 class="text-2xl font-semibold text-foreground">{{ currentTeam?.name ?? 'Team' }}</h1>
      <ShadcnBadge variant="secondary">
        {{ isTrainer ? 'Trainer-Ansicht' : 'Spieler-Ansicht' }}
      </ShadcnBadge>
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
      <ShadcnCard v-if="myRow" data-testid="my-rank-card">
        <ShadcnCardContent class="flex items-center justify-between gap-4">
          <div>
            <p class="text-sm text-muted-foreground">Dein Platz</p>
            <p class="text-3xl font-semibold text-foreground">
              {{ myRow.rank_position }}
            </p>
          </div>
          <ShadcnButton v-if="linkedPlayerId" as-child variant="outline" size="sm">
            <NuxtLink :to="`/t/${slug}/players/${linkedPlayerId}`"> Mein Zeitverlauf </NuxtLink>
          </ShadcnButton>
        </ShadcnCardContent>
      </ShadcnCard>
      <p
        v-else-if="linkedPlayerId"
        class="text-sm text-muted-foreground"
        data-testid="my-rank-missing"
      >
        Für dich sind im gewählten Zeitraum keine Punkte erfasst.
      </p>
      <p v-else class="text-sm text-muted-foreground" data-testid="not-linked">
        Dein Account ist noch keinem Spieler-Datensatz zugeordnet.
      </p>
    </template>

    <section class="space-y-2" data-testid="top-three">
      <h2 class="text-lg font-semibold text-foreground">Top 3</h2>
      <p v-if="isLoading" class="text-sm text-muted-foreground">Lade…</p>
      <p v-else-if="loadError" class="text-sm text-destructive" role="alert">{{ loadError }}</p>
      <p v-else-if="topThree.length === 0" class="text-sm text-muted-foreground">
        Noch keine Punkte im gewählten Zeitraum.
      </p>
      <ol v-else class="space-y-1.5">
        <li v-for="row in topThree" :key="row.player_id">
          <ShadcnCard class="py-0 gap-0">
            <ShadcnCardContent class="flex items-center justify-between px-3 py-2">
              <span class="flex items-center gap-2">
                <ShadcnBadge variant="default" class="min-w-6 justify-center tabular-nums">
                  {{ row.rank_position }}
                </ShadcnBadge>
                <span class="text-muted-foreground text-sm">
                  {{ row.jersey_number !== null ? `#${row.jersey_number}` : '—' }}
                </span>
                {{ row.name }}
              </span>
              <ShadcnButton as-child variant="link" size="sm">
                <NuxtLink :to="`/t/${slug}/players/${row.player_id}`"> Details </NuxtLink>
              </ShadcnButton>
            </ShadcnCardContent>
          </ShadcnCard>
        </li>
      </ol>
    </section>

    <RankingTable
      v-if="isTrainer && !loadError"
      :ranking="ranking"
      :slug="slug"
      :link-players="true"
      :highlight-player-id="linkedPlayerId"
    />
  </section>
</template>
