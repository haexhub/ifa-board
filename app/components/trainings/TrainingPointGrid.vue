<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { ActiveCategory } from '~/composables/useCategories'
import type { ActivePlayer } from '~/composables/usePlayers'
import { useTrainings } from '~/composables/useTrainings'
import { pointValueSchema } from '~/utils/validators'

const props = defineProps<{
  trainingId: string
  players: ActivePlayer[]
  categories: ActiveCategory[]
  initialEntries?: Array<{ player_id: string; category_id: string; value: number }>
}>()

type CellKey = `${string}:${string}`
type CellStatus = 'idle' | 'saving' | 'saved' | 'error'
type CellState = {
  value: number | null
  status: CellStatus
  error?: string
}

const { updateEntry, deleteEntry } = useTrainings()

const key = (playerId: string, categoryId: string): CellKey => `${playerId}:${categoryId}`

const cells = reactive<Record<CellKey, CellState>>({})

const initialMap = computed(() => {
  const m = new Map<CellKey, number>()
  for (const e of props.initialEntries ?? []) m.set(key(e.player_id, e.category_id), e.value)
  return m
})

for (const p of props.players) {
  for (const c of props.categories) {
    const k = key(p.id, c.id)
    cells[k] = { value: initialMap.value.get(k) ?? null, status: 'idle' }
  }
}

const jerseyLabel = (p: ActivePlayer) => (p.jersey_number !== null ? `#${p.jersey_number}` : '')

const savingCount = ref(0)
const dirtyCount = ref(0)
const cellRevisions = new Map<CellKey, number>()
const cellQueues = new Map<CellKey, Promise<void>>()

const commitCell = (playerId: string, categoryId: string, category: ActiveCategory) => {
  const k = key(playerId, categoryId)
  const state = cells[k]
  if (!state) return
  const revision = cellRevisions.get(k) ?? 0
  const value = state.value

  if (value !== null && !Number.isNaN(value)) {
    const parsed = pointValueSchema(category.value_min, category.value_max).safeParse(value)
    if (!parsed.success) {
      state.status = 'error'
      state.error = parsed.error.issues[0]?.message ?? 'Ungültig'
      return
    }
  }

  state.status = 'saving'
  state.error = undefined
  savingCount.value += 1

  const previous = cellQueues.get(k) ?? Promise.resolve()
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      try {
        if (value === null || Number.isNaN(value)) {
          await deleteEntry({
            training_id: props.trainingId,
            player_id: playerId,
            category_id: categoryId,
          })
        } else {
          const parsed = pointValueSchema(category.value_min, category.value_max).parse(value)
          await updateEntry({
            training_id: props.trainingId,
            player_id: playerId,
            category_id: categoryId,
            value: parsed,
          })
        }
        if (cellRevisions.get(k) === revision) state.status = 'saved'
      } catch (err) {
        if (cellRevisions.get(k) === revision) {
          state.status = 'error'
          state.error = err instanceof Error ? err.message : 'Speichern fehlgeschlagen'
        }
      } finally {
        savingCount.value -= 1
      }
    })

  cellQueues.set(k, current)
  void current.then(
    () => {
      if (cellQueues.get(k) === current) cellQueues.delete(k)
    },
    () => {
      if (cellQueues.get(k) === current) cellQueues.delete(k)
    },
  )
}

const onInput = (playerId: string, categoryId: string, evt: Event) => {
  const target = evt.target as HTMLInputElement
  const k = key(playerId, categoryId)
  const cell = cells[k]
  if (!cell) return
  cellRevisions.set(k, (cellRevisions.get(k) ?? 0) + 1)
  cell.status = 'idle'
  if (target.value === '') {
    cell.value = null
  } else {
    const n = Number(target.value)
    cell.value = Number.isNaN(n) ? null : n
  }
  dirtyCount.value += 1
}

const onBlur = (player: ActivePlayer, category: ActiveCategory) => {
  void commitCell(player.id, category.id, category)
}

defineExpose({ savingCount, dirtyCount })
</script>

<template>
  <div class="relative overflow-x-auto rounded border border-neutral-200 bg-white">
    <table class="w-full text-sm border-collapse" data-testid="training-point-grid">
      <thead class="sticky top-0 z-10 bg-neutral-100">
        <tr>
          <th
            scope="col"
            class="sticky left-0 z-20 bg-neutral-100 border-b border-r border-neutral-200 px-3 py-2 text-left font-semibold min-w-[10rem]"
          >
            Spieler:in
          </th>
          <th
            v-for="c in categories"
            :key="c.id"
            scope="col"
            class="border-b border-neutral-200 px-2 py-2 text-left font-semibold whitespace-nowrap"
          >
            {{ c.name }}
            <span class="block text-[10px] font-normal text-neutral-500">
              {{ c.value_min }}–{{ c.value_max }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in players" :key="p.id" class="min-h-touch">
          <th
            scope="row"
            class="sticky left-0 bg-white border-b border-r border-neutral-200 px-3 py-2 text-left font-medium align-middle min-h-touch"
          >
            <span class="text-neutral-500 mr-1">{{ jerseyLabel(p) }}</span>
            {{ p.name }}
          </th>
          <td
            v-for="c in categories"
            :key="c.id"
            class="border-b border-neutral-200 px-1 py-1 align-middle"
            :data-testid="`cell-${p.id}-${c.id}`"
          >
            <div class="flex items-center gap-1">
              <input
                type="number"
                inputmode="numeric"
                :min="c.value_min"
                :max="c.value_max"
                :value="cells[key(p.id, c.id)]?.value ?? ''"
                :aria-label="`${p.name} — ${c.name}`"
                class="min-h-touch w-20 rounded border border-neutral-300 px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-neutral-900"
                :class="{
                  'border-red-500': cells[key(p.id, c.id)]?.status === 'error',
                  'border-green-500': cells[key(p.id, c.id)]?.status === 'saved',
                }"
                @input="onInput(p.id, c.id, $event)"
                @blur="onBlur(p, c)"
              />
              <span
                v-if="cells[key(p.id, c.id)]?.status === 'saving'"
                class="text-xs text-neutral-500"
              >
                …
              </span>
              <span
                v-else-if="cells[key(p.id, c.id)]?.status === 'saved'"
                class="text-xs text-green-700"
                aria-label="gespeichert"
              >
                ✓
              </span>
              <span
                v-else-if="cells[key(p.id, c.id)]?.status === 'error'"
                class="text-xs text-red-700"
                :title="cells[key(p.id, c.id)]?.error"
              >
                !
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
