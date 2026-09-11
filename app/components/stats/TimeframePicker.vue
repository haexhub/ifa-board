<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TimeframePreset, TimeframeRange } from '~/composables/useTimeframe'

const props = defineProps<{
  preset: TimeframePreset
  range: TimeframeRange
  customFrom: string | null
  customTo: string | null
  seasonAvailable: boolean
}>()

const emit = defineEmits<{
  'update:preset': [TimeframePreset]
  'update:custom': [{ from: string; to: string }]
}>()

const localFrom = ref(props.customFrom ?? props.range.from)
const localTo = ref(props.customTo ?? props.range.to)

watch(
  () => [props.customFrom, props.customTo, props.range.from, props.range.to],
  () => {
    localFrom.value = props.customFrom ?? props.range.from
    localTo.value = props.customTo ?? props.range.to
  },
)

const onPresetChange = (evt: Event) => {
  const v = (evt.target as HTMLSelectElement).value as TimeframePreset
  emit('update:preset', v)
}

const applyCustom = () => {
  if (!localFrom.value || !localTo.value) return
  emit('update:custom', { from: localFrom.value, to: localTo.value })
}

const isCustom = computed(() => props.preset === 'custom')
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-end gap-3" data-testid="timeframe-picker">
    <label class="flex flex-col text-sm">
      <span class="text-neutral-700">Zeitraum</span>
      <select
        :value="preset"
        class="mt-1 min-h-touch rounded border border-neutral-300 px-2"
        data-testid="timeframe-preset"
        @change="onPresetChange"
      >
        <option value="last-4-weeks">Letzte 4 Wochen</option>
        <option value="season" :disabled="!seasonAvailable">Saison</option>
        <option value="custom">Benutzerdefiniert</option>
      </select>
    </label>

    <label v-if="isCustom" class="flex flex-col text-sm">
      <span class="text-neutral-700">Von</span>
      <input
        v-model="localFrom"
        type="date"
        class="mt-1 min-h-touch rounded border border-neutral-300 px-2"
        data-testid="timeframe-from"
        @blur="applyCustom"
      />
    </label>
    <label v-if="isCustom" class="flex flex-col text-sm">
      <span class="text-neutral-700">Bis</span>
      <input
        v-model="localTo"
        type="date"
        class="mt-1 min-h-touch rounded border border-neutral-300 px-2"
        data-testid="timeframe-to"
        @blur="applyCustom"
      />
    </label>

    <p v-if="!isCustom" class="text-xs text-neutral-500">
      {{ range.from }} – {{ range.to }}
    </p>
  </div>
</template>
