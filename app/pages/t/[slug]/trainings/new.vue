<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ConsentWarningBanner from '~/components/trainings/ConsentWarningBanner.vue'
import TrainingPhotoUpload from '~/components/trainings/TrainingPhotoUpload.vue'
import TrainingPointGrid from '~/components/trainings/TrainingPointGrid.vue'
import { useCategories, type ActiveCategory } from '~/composables/useCategories'
import { usePlayers, type ActivePlayer } from '~/composables/usePlayers'
import { useTrainings, type TrainingRow } from '~/composables/useTrainings'

definePageMeta({
  middleware: ['team-context', 'trainer-only'],
})

const { currentTeam } = useTeamContext()
const teamId = computed(() => currentTeam.value?.id ?? '')
const slug = computed(() => currentTeam.value?.slug ?? '')

const { listActive: listPlayers } = usePlayers()
const { listActive: listCategories } = useCategories()
const { createDraft, save } = useTrainings()

const today = new Date()
const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const training = ref<TrainingRow | null>(null)
const players = ref<ActivePlayer[]>([])
const categories = ref<ActiveCategory[]>([])
const photoCount = ref(0)
const saveError = ref<string | null>(null)
const draftError = ref<string | null>(null)
const isSaving = ref(false)
const isCreatingDraft = ref(false)
const title = ref('')
const date = ref(isoToday)

const uploader = ref<InstanceType<typeof TrainingPhotoUpload> | null>(null)

const canSave = computed(() => !!training.value && photoCount.value > 0 && !isSaving.value)

const {
  data: initialData,
  pending: isInitializing,
  error: initError,
} = await useAsyncData(
  'new-training-page-data',
  async () => {
    if (!teamId.value) return { players: [], categories: [] }
    const [ps, cs] = await Promise.all([listPlayers(teamId.value), listCategories(teamId.value)])
    return { players: ps, categories: cs }
  },
  { watch: [teamId], server: false },
)

watch(
  initialData,
  (data) => {
    players.value = data?.players ?? []
    categories.value = data?.categories ?? []
  },
  { immediate: true },
)

const createClientDraft = async () => {
  if (!teamId.value || training.value || isCreatingDraft.value) return
  isCreatingDraft.value = true
  draftError.value = null
  try {
    training.value = await createDraft({
      team_id: teamId.value,
      date: date.value,
      title: title.value || null,
    })
  } catch (err) {
    draftError.value = err instanceof Error ? err.message : 'Training konnte nicht angelegt werden'
  } finally {
    isCreatingDraft.value = false
  }
}

onMounted(() => {
  void createClientDraft()
})

watch(
  teamId,
  () => {
    if (import.meta.client) void createClientDraft()
  },
  { flush: 'post' },
)

const onPhotoUploaded = () => {
  const count = uploader.value?.photos?.length ?? 0
  photoCount.value = count
}

const onSave = async () => {
  if (!training.value) return
  saveError.value = null
  isSaving.value = true
  try {
    await save(training.value.id, {
      date: date.value,
      title: title.value.trim() || null,
    })
    await navigateTo(`/t/${slug.value}/trainings/${training.value.id}`)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Speichern fehlgeschlagen'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="space-y-6" data-testid="trainings-new-page">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">Neues Training</h1>
      <p class="text-neutral-600">Punkte je Spieler:in und Kategorie erfassen.</p>
    </header>

    <p v-if="isInitializing || isCreatingDraft" class="text-sm text-neutral-500">
      Training wird vorbereitet…
    </p>
    <p v-if="initError || draftError" class="text-sm text-red-700" role="alert">
      {{ initError?.message ?? draftError }}
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label class="block text-sm">
        Datum
        <input
          v-model="date"
          type="date"
          :max="isoToday"
          class="mt-1 block w-full min-h-touch rounded border border-neutral-300 px-2"
          data-testid="training-date-input"
        />
      </label>
      <label class="block text-sm sm:col-span-2">
        Titel (optional)
        <input
          v-model="title"
          type="text"
          class="mt-1 block w-full min-h-touch rounded border border-neutral-300 px-2"
          placeholder="z. B. Krafttraining"
        />
      </label>
    </div>

    <ConsentWarningBanner :players="players" />

    <TrainingPointGrid
      v-if="training && players.length && categories.length"
      :training-id="training.id"
      :players="players"
      :categories="categories"
    />
    <p v-else-if="!players.length" class="text-sm text-neutral-500" data-testid="no-players-hint">
      Es sind keine aktiven Spieler:innen im Team. Bitte zuerst über
      <NuxtLink :to="`/t/${slug}/players`" class="underline">Spieler-Verwaltung</NuxtLink>
      anlegen.
    </p>
    <p
      v-else-if="!categories.length"
      class="text-sm text-neutral-500"
      data-testid="no-categories-hint"
    >
      Es sind keine aktiven Kategorien im Team. Bitte zuerst über
      <NuxtLink :to="`/t/${slug}/categories`" class="underline">Kategorien</NuxtLink>
      anlegen.
    </p>

    <TrainingPhotoUpload
      v-if="training && teamId"
      ref="uploader"
      :training-id="training.id"
      :team-id="teamId"
      @uploaded="onPhotoUploaded"
    />

    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <button
        type="button"
        class="min-h-touch px-4 rounded bg-neutral-900 text-white text-sm font-semibold disabled:opacity-40"
        :disabled="!canSave"
        data-testid="training-save-button"
        @click="onSave"
      >
        {{ isSaving ? 'Speichere…' : 'Speichern' }}
      </button>
      <p v-if="photoCount === 0" class="text-sm text-neutral-600" data-testid="photo-required-hint">
        Mindestens 1 Foto ist erforderlich.
      </p>
    </div>

    <p v-if="saveError" class="text-sm text-red-700" role="alert">{{ saveError }}</p>
  </section>
</template>
