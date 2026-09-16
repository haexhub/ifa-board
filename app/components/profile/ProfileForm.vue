<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProfile } from '~/composables/useProfile'
import { PHOTO_MIME_TYPES } from '~/utils/validators'

const props = defineProps<{
  displayName: string | null
  avatarUrl: string | null
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const { updateDisplayName, uploadAvatar, removeAvatar } = useProfile()

const name = ref(props.displayName ?? '')
const nameError = ref<string | null>(null)
const nameLoading = ref(false)

const avatarInput = ref<HTMLInputElement | null>(null)
const avatarError = ref<string | null>(null)
const avatarLoading = ref(false)

watch(
  () => props.displayName,
  (value) => {
    name.value = value ?? ''
  },
)

const submitName = async () => {
  nameError.value = null
  nameLoading.value = true
  try {
    await updateDisplayName(name.value)
    emit('saved')
  } catch (err) {
    nameError.value = err instanceof Error ? err.message : 'Name konnte nicht gespeichert werden.'
  } finally {
    nameLoading.value = false
  }
}

const onAvatarPick = async (evt: Event) => {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  avatarError.value = null
  avatarLoading.value = true
  try {
    await uploadAvatar(file)
    emit('saved')
  } catch (err) {
    avatarError.value = err instanceof Error ? err.message : 'Avatar konnte nicht hochgeladen werden.'
  } finally {
    avatarLoading.value = false
  }
}

const onAvatarRemove = async () => {
  avatarError.value = null
  avatarLoading.value = true
  try {
    await removeAvatar()
    emit('saved')
  } catch (err) {
    avatarError.value = err instanceof Error ? err.message : 'Avatar konnte nicht entfernt werden.'
  } finally {
    avatarLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        alt=""
        data-testid="profile-avatar-image"
        class="h-16 w-16 rounded-full object-cover bg-neutral-100"
      />
      <div
        v-else
        data-testid="profile-avatar-placeholder"
        class="h-16 w-16 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-xl"
        aria-hidden="true"
      >
        ?
      </div>
      <div class="space-y-1">
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="avatarLoading"
            class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100 disabled:opacity-50"
            @click="avatarInput?.click()"
          >
            {{ avatarLoading ? 'Lädt…' : 'Avatar wählen' }}
          </button>
          <button
            v-if="avatarUrl"
            type="button"
            :disabled="avatarLoading"
            data-testid="profile-avatar-remove"
            class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100 disabled:opacity-50"
            @click="onAvatarRemove"
          >
            Avatar entfernen
          </button>
        </div>
        <input
          ref="avatarInput"
          type="file"
          :accept="PHOTO_MIME_TYPES.join(',')"
          class="hidden"
          data-testid="profile-avatar-input"
          @change="onAvatarPick"
        />
        <p v-if="avatarError" class="text-sm text-red-700" data-testid="profile-avatar-error">
          {{ avatarError }}
        </p>
      </div>
    </div>

    <form class="space-y-3" novalidate data-testid="profile-form" @submit.prevent="submitName">
      <label class="block">
        <span class="text-sm font-medium text-neutral-800">Name</span>
        <input
          v-model="name"
          type="text"
          required
          class="mt-1 w-full min-h-touch px-3 rounded border border-neutral-300 focus:border-neutral-900 focus:outline-none"
        />
        <span v-if="nameError" class="text-sm text-red-700">{{ nameError }}</span>
      </label>
      <button
        type="submit"
        :disabled="nameLoading"
        data-testid="profile-form-save-name"
        class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-60"
      >
        {{ nameLoading ? 'Speichere…' : 'Speichern' }}
      </button>
    </form>
  </div>
</template>
