<script setup lang="ts">
import { computed } from 'vue'
import type { RankingCategory, RankingRow, TeamRanking } from '~/composables/useRanking'

const props = defineProps<{
  ranking: TeamRanking | null
  slug: string
  highlightPlayerId?: string | null
  linkPlayers?: boolean
}>()

const rows = computed<RankingRow[]>(() => props.ranking?.rows ?? [])
const cats = computed<RankingCategory[]>(() => props.ranking?.categories ?? [])

const scoreFor = (row: RankingRow, catId: string): number => Number(row.scores?.[catId] ?? 0)

const totalFor = (row: RankingRow): number =>
  cats.value.reduce((sum, c) => sum + scoreFor(row, c.id), 0)
</script>

<template>
  <div class="overflow-x-auto rounded border border-neutral-200 bg-white">
    <table class="w-full text-sm border-collapse" data-testid="ranking-table">
      <thead class="bg-neutral-100">
        <tr>
          <th class="sticky left-0 bg-neutral-100 border-b border-r border-neutral-200 px-3 py-2 text-left font-semibold">
            #
          </th>
          <th class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">
            Spieler:in
          </th>
          <th
            v-for="c in cats"
            :key="c.id"
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
            data-testid="ranking-empty"
          >
            Keine Punkte im gewählten Zeitraum.
          </td>
        </tr>
        <tr
          v-for="row in rows"
          :key="row.player_id"
          class="align-middle"
          :class="{ 'bg-amber-50': row.player_id === highlightPlayerId }"
          :data-testid="`ranking-row-${row.player_id}`"
        >
          <th
            scope="row"
            class="sticky left-0 bg-inherit border-b border-r border-neutral-200 px-3 py-2 text-left font-medium"
          >
            {{ row.rank_position }}
          </th>
          <td class="border-b border-neutral-200 px-3 py-2">
            <NuxtLink
              v-if="linkPlayers"
              :to="`/t/${slug}/players/${row.player_id}`"
              class="underline"
            >
              <span class="text-neutral-500 mr-1">
                {{ row.jersey_number !== null ? `#${row.jersey_number}` : '—' }}
              </span>
              {{ row.name }}
            </NuxtLink>
            <template v-else>
              <span class="text-neutral-500 mr-1">
                {{ row.jersey_number !== null ? `#${row.jersey_number}` : '—' }}
              </span>
              {{ row.name }}
            </template>
          </td>
          <td
            v-for="c in cats"
            :key="c.id"
            class="border-b border-neutral-200 px-3 py-2 text-right tabular-nums"
          >
            {{ scoreFor(row, c.id) }}
          </td>
          <td class="border-b border-neutral-200 px-3 py-2 text-right font-semibold tabular-nums">
            {{ totalFor(row) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
