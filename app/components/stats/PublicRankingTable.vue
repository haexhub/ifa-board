<script setup lang="ts">
import { computed } from 'vue'
import type { PublicRanking, PublicRankingCategory, PublicRankingRow } from '~/composables/usePublicRanking'

const props = defineProps<{
  ranking: PublicRanking | null
}>()

const rows = computed<PublicRankingRow[]>(() => props.ranking?.rows ?? [])
const cats = computed<PublicRankingCategory[]>(() => props.ranking?.categories ?? [])

const scoreFor = (row: PublicRankingRow, categoryName: string): number =>
  Number(row.scores?.[categoryName] ?? 0)

const totalFor = (row: PublicRankingRow): number =>
  cats.value.reduce((sum, c) => sum + scoreFor(row, c.name), 0)
</script>

<template>
  <div class="overflow-x-auto rounded border border-neutral-200 bg-white">
    <table class="w-full text-sm border-collapse" data-testid="public-ranking-table">
      <thead class="bg-neutral-100">
        <tr>
          <th class="sticky left-0 bg-neutral-100 border-b border-r border-neutral-200 px-3 py-2 text-left font-semibold">
            #
          </th>
          <th class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">
            Trikot
          </th>
          <th
            v-for="c in cats"
            :key="c.name"
            class="border-b border-neutral-200 px-3 py-2 text-right font-semibold whitespace-nowrap"
          >
            {{ c.name }}
          </th>
          <th class="border-b border-neutral-200 px-3 py-2 text-right font-semibold">
            Gesamt
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length">
          <td
            :colspan="cats.length + 3"
            class="px-3 py-6 text-center text-neutral-500"
            data-testid="public-ranking-empty"
          >
            Keine Punkte im gewählten Zeitraum.
          </td>
        </tr>
        <tr
          v-for="row in rows"
          :key="`${row.rank_position}-${row.jersey_number ?? 'none'}`"
          class="align-middle"
          data-testid="public-ranking-row"
        >
          <th
            scope="row"
            class="sticky left-0 bg-inherit border-b border-r border-neutral-200 px-3 py-2 text-left font-medium"
          >
            {{ row.rank_position }}
          </th>
          <td class="border-b border-neutral-200 px-3 py-2">
            {{ row.jersey_number !== null ? `#${row.jersey_number}` : '—' }}
          </td>
          <td
            v-for="c in cats"
            :key="c.name"
            class="border-b border-neutral-200 px-3 py-2 text-right tabular-nums"
          >
            {{ scoreFor(row, c.name) }}
          </td>
          <td class="border-b border-neutral-200 px-3 py-2 text-right font-semibold tabular-nums">
            {{ totalFor(row) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
