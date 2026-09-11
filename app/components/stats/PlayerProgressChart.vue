<script setup lang="ts">
import { VisAxis, VisLine, VisScatter, VisXYContainer } from '@unovis/vue'
import { computed } from 'vue'
import type { ActiveCategory } from '~/composables/useCategories'
import type { CategoryScoreRow } from '~/composables/usePlayerScores'

type SeriesPoint = { date: string; value: number }

const props = defineProps<{
  categories: ActiveCategory[]
  timeSeries: Map<string, SeriesPoint[]>
  scores: CategoryScoreRow[]
}>()

type ChartRow = {
  ts: number
  player: number | null
  avg: number | null
  median: number | null
}

const scoresById = computed(() => {
  const m = new Map<string, CategoryScoreRow>()
  for (const s of props.scores) m.set(s.category_id, s)
  return m
})

const chartData = (categoryId: string): ChartRow[] => {
  const points = props.timeSeries.get(categoryId) ?? []
  const summary = scoresById.value.get(categoryId)
  const avg = summary?.avg_value ?? null
  const median = summary?.median_value ?? null
  return points.map((p) => ({
    ts: new Date(`${p.date}T00:00:00`).getTime(),
    player: p.value,
    avg,
    median,
  }))
}

const xAccessor = (d: ChartRow) => d.ts
const playerAccessor = (d: ChartRow) => d.player
const avgAccessor = (d: ChartRow) => d.avg
const medianAccessor = (d: ChartRow) => d.median

const tickFormat = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

const isEmpty = (categoryId: string) => (props.timeSeries.get(categoryId) ?? []).length === 0
</script>

<template>
  <div class="space-y-6" data-testid="player-progress-chart">
    <section
      v-for="c in categories"
      :key="c.id"
      class="rounded border border-neutral-200 bg-white p-4"
      :data-testid="`player-progress-chart-${c.id}`"
    >
      <header class="flex items-baseline justify-between mb-2">
        <h3 class="font-semibold text-neutral-900">{{ c.name }}</h3>
        <p v-if="!isEmpty(c.id)" class="text-xs text-neutral-500">
          Ø Team {{ scoresById.get(c.id)?.avg_value?.toFixed(1) ?? '—' }} · Median
          {{ scoresById.get(c.id)?.median_value?.toFixed(1) ?? '—' }}
        </p>
      </header>
      <p
        v-if="isEmpty(c.id)"
        class="text-sm text-neutral-500"
        :data-testid="`player-progress-empty-${c.id}`"
      >
        Keine Werte im gewählten Zeitraum.
      </p>
      <VisXYContainer v-else :height="180" :data="chartData(c.id)">
        <VisAxis type="x" :tick-format="tickFormat" :num-ticks="4" />
        <VisAxis type="y" />
        <VisLine :x="xAccessor" :y="avgAccessor" color="#9ca3af" :line-dash-array="[4, 4]" />
        <VisLine :x="xAccessor" :y="medianAccessor" color="#d1d5db" :line-dash-array="[2, 6]" />
        <VisLine :x="xAccessor" :y="playerAccessor" color="#111827" />
        <VisScatter :x="xAccessor" :y="playerAccessor" color="#111827" :size="6" />
      </VisXYContainer>
    </section>
  </div>
</template>
