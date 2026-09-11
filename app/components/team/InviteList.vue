<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  teamId: string
}>()

const { listOpenByTeam, revoke } = useInvitations()

type Invite = Awaited<ReturnType<typeof listOpenByTeam>>[number]

const invitations = ref<Invite[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    invitations.value = await listOpenByTeam(props.teamId)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

watch(() => props.teamId, load, { immediate: true })

const remove = async (id: string) => {
  try {
    await revoke(id)
    invitations.value = invitations.value.filter((i) => i.id !== id)
  } catch (err) {
    error.value = (err as Error).message
  }
}

defineExpose({ reload: load })
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-semibold text-neutral-900">Offene Einladungen</h3>
    <p v-if="loading" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-else-if="invitations.length === 0" class="text-sm text-neutral-500">
      Keine offenen Einladungen.
    </p>
    <ul v-else class="divide-y border rounded bg-white">
      <li v-for="inv in invitations" :key="inv.id" class="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3">
        <div class="text-sm">
          <p class="font-medium text-neutral-900">{{ inv.email }}</p>
          <p class="text-neutral-500">
            Rolle: {{ inv.role === 'trainer' ? 'Trainer' : 'Spieler' }} · gültig bis
            {{ new Date(inv.expires_at).toLocaleDateString('de-DE') }}
          </p>
        </div>
        <button
          type="button"
          class="min-h-touch px-3 rounded border border-red-300 text-red-700 text-sm hover:bg-red-50"
          @click="remove(inv.id)"
        >
          Widerrufen
        </button>
      </li>
    </ul>
  </div>
</template>
