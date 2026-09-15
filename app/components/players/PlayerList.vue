<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Database } from '~/types/database'

const props = defineProps<{
  teamId: string
}>()

const emit = defineEmits<{
  (e: 'edit', player: PlayerRow): void
  (e: 'invite'): void
}>()

const client = useSupabaseClient<Database>()
const { list, setActive, setConsent, linkUser } = usePlayers()

type PlayerRow = Awaited<ReturnType<typeof list>>[number]
type Candidate = { user_id: string; display_name: string | null }

const players = ref<PlayerRow[]>([])
const candidates = ref<Candidate[]>([])
const linkSelection = ref<Record<string, string>>({})
const loading = ref(false)
const error = ref<string | null>(null)
let latestLoad = 0

const loadCandidates = async () => {
  const { data: memberships, error: memErr } = await client
    .from('memberships')
    .select('user_id')
    .eq('team_id', props.teamId)
    .eq('role', 'player')
  if (memErr) throw memErr

  const linkedIds = new Set(
    players.value.map((p) => p.linked_user_id).filter((id): id is string => !!id),
  )
  const unlinkedIds = (memberships ?? []).map((m) => m.user_id).filter((id) => !linkedIds.has(id))
  if (unlinkedIds.length === 0) {
    candidates.value = []
    return
  }

  const { data: profiles, error: profErr } = await client
    .from('user_profiles')
    .select('id, display_name')
    .in('id', unlinkedIds)
  if (profErr) throw profErr
  candidates.value = (profiles ?? []).map((p) => ({ user_id: p.id, display_name: p.display_name }))
}

const load = async () => {
  const loadId = ++latestLoad
  loading.value = true
  error.value = null
  try {
    const rows = await list(props.teamId)
    if (loadId !== latestLoad) return
    players.value = rows
    await loadCandidates()
    if (loadId !== latestLoad) return
  } catch (err) {
    if (loadId === latestLoad) error.value = (err as Error).message
  } finally {
    if (loadId === latestLoad) loading.value = false
  }
}

watch(() => props.teamId, load, { immediate: true })

const onToggleConsent = async (row: PlayerRow) => {
  const next = !row.photo_consent
  try {
    await setConsent(row.id, next)
    row.photo_consent = next
  } catch (err) {
    error.value = (err as Error).message
  }
}

const onDeactivate = async (row: PlayerRow) => {
  try {
    await setActive(row.id, false)
    row.active = false
  } catch (err) {
    error.value = (err as Error).message
  }
}

const onLink = async (row: PlayerRow) => {
  const userId = linkSelection.value[row.id]
  if (!userId) return
  try {
    await linkUser(row.id, userId)
    await load()
  } catch (err) {
    error.value = (err as Error).message
  }
}

defineExpose({ reload: load })
</script>

<template>
  <div class="space-y-3" data-testid="player-list">
    <h3 class="text-sm font-semibold text-neutral-900">Spieler:innen</h3>
    <p v-if="loading" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-else-if="players.length === 0" class="text-sm text-neutral-500">
      Keine Spieler:innen vorhanden.
    </p>
    <div v-else class="overflow-x-auto rounded border border-neutral-200 bg-white">
      <table class="w-full text-sm border-collapse" data-testid="player-table">
        <thead class="bg-neutral-100">
          <tr>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">#</th>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">Name</th>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">Position</th>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">Foto-OK</th>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">Status</th>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">Konto</th>
            <th scope="col" class="border-b border-neutral-200 px-3 py-2 text-left font-semibold">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in players"
            :key="row.id"
            data-testid="player-row"
            :class="{ 'opacity-60': !row.active }"
          >
            <td class="border-b border-neutral-200 px-3 py-2">{{ row.jersey_number ?? '—' }}</td>
            <td class="border-b border-neutral-200 px-3 py-2 font-medium text-neutral-900">
              {{ row.name }}
            </td>
            <td class="border-b border-neutral-200 px-3 py-2 text-neutral-600">
              {{ row.position ?? '—' }}
            </td>
            <td class="border-b border-neutral-200 px-3 py-2">
              <input
                type="checkbox"
                :checked="row.photo_consent"
                :aria-label="`Foto-Einwilligung ${row.name}`"
                class="h-5 w-5"
                @change="onToggleConsent(row)"
              />
            </td>
            <td class="border-b border-neutral-200 px-3 py-2">{{ row.active ? 'Aktiv' : 'Inaktiv' }}</td>
            <td class="border-b border-neutral-200 px-3 py-2">
              <span v-if="row.linked_user_id" class="text-neutral-500" data-testid="player-linked">
                Verknüpft
              </span>
              <div v-else-if="candidates.length" class="flex items-center gap-1">
                <select
                  v-model="linkSelection[row.id]"
                  :aria-label="`Konto für ${row.name} wählen`"
                  class="min-h-touch px-2 rounded border border-neutral-300 text-xs bg-white"
                >
                  <option value="">Konto wählen…</option>
                  <option v-for="c in candidates" :key="c.user_id" :value="c.user_id">
                    {{ c.display_name ?? c.user_id }}
                  </option>
                </select>
                <button
                  type="button"
                  data-testid="player-link-button"
                  class="min-h-touch px-2 rounded border border-neutral-300 text-xs hover:bg-neutral-50"
                  @click="onLink(row)"
                >
                  Verknüpfen
                </button>
              </div>
              <span v-else class="text-neutral-400">—</span>
            </td>
            <td class="border-b border-neutral-200 px-3 py-2">
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="player-edit-button"
                  class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-50"
                  @click="emit('edit', row)"
                >
                  Bearbeiten
                </button>
                <button
                  v-if="row.active"
                  type="button"
                  class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-50"
                  @click="onDeactivate(row)"
                >
                  Deaktivieren
                </button>
                <button
                  type="button"
                  data-testid="player-invite-button"
                  class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-50"
                  @click="emit('invite')"
                >
                  Einladen
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
