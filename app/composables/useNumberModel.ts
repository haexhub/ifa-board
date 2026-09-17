import { computed, type Ref, type WritableComputedRef } from 'vue'

export const useNumberModel = (source: Ref<number>): WritableComputedRef<string | number> =>
  computed({
    get: () => source.value,
    set: (v) => {
      source.value = Number(v)
    },
  })

export const useNullableNumberModel = (
  source: Ref<number | null>,
): WritableComputedRef<string | number> =>
  computed({
    get: () => source.value ?? '',
    set: (v) => {
      source.value = v === '' ? null : Number(v)
    },
  })
