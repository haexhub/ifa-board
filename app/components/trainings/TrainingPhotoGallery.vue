<script setup lang="ts">
import { computed } from 'vue'
import type { ConsentStatus, TrainingPhotoView } from '~/composables/useTrainingPhotos'

const props = defineProps<{
  photos: TrainingPhotoView[]
  consentStatus: ConsentStatus
  isTrainer: boolean
}>()

const isBlocked = computed(() => !props.isTrainer && props.consentStatus === 'blocked')
</script>

<template>
  <div data-testid="training-photo-gallery">
    <div
      v-if="isBlocked"
      class="rounded border border-neutral-200 bg-neutral-100 p-4 text-sm text-neutral-600"
      data-testid="photo-gallery-blocked"
    >
      Fotos sind aktuell ausgeblendet, weil nicht für alle aktiven Spieler:innen im Team eine
      Foto-Einwilligung vorliegt.
    </div>
    <p
      v-else-if="photos.length === 0"
      class="text-sm text-neutral-500"
      data-testid="photo-gallery-empty"
    >
      Keine Fotos zu diesem Training.
    </p>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="photo-gallery-grid">
      <a
        v-for="p in photos"
        :key="p.id"
        :href="p.signed_url"
        target="_blank"
        rel="noopener"
        class="block aspect-square overflow-hidden rounded border border-neutral-200 bg-neutral-100"
      >
        <img
          :src="p.signed_url"
          :alt="`Foto ${p.id}`"
          class="w-full h-full object-cover"
          loading="lazy"
        />
      </a>
    </div>
  </div>
</template>
