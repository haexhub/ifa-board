<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Database } from '~/types/database'

const props = defineProps<{
  teamId: string
  isTrainer: boolean
}>()

type Row = {
  user_id: string
  role: 'trainer' | 'player'
  display_name: string | null
  avatar_path: string | null
}

const client = useSupabaseClient<Database>()
const currentUser = useSupabaseUser()
const { moderateProfile } = useProfile()

const rows = ref<Row[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const { data, error: err } = await client
      .from('memberships')
      .select('user_id, role')
      .eq('team_id', props.teamId)
      .order('role', { ascending: true })
    if (err) throw err

    const userIds = (data ?? []).map((r) => r.user_id)
    let profiles: { id: string; display_name: string | null; avatar_path: string | null }[] = []
    if (userIds.length > 0) {
      const { data: profileRows, error: profErr } = await client
        .from('user_profiles')
        .select('id, display_name, avatar_path')
        .in('id', userIds)
      if (profErr) throw profErr
      profiles = profileRows ?? []
    }
    const profileById = new Map(profiles.map((p) => [p.id, p]))

    rows.value = (data ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role as 'trainer' | 'player',
      display_name: profileById.get(r.user_id)?.display_name ?? null,
      avatar_path: profileById.get(r.user_id)?.avatar_path ?? null,
    }))
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

watch(() => props.teamId, load, { immediate: true })

const trainerCount = computed(() => rows.value.filter((r) => r.role === 'trainer').length)

const changeRole = async (row: Row, next: 'trainer' | 'player') => {
  error.value = null
  const { data, error: err } = await client
    .from('memberships')
    .update({ role: next })
    .eq('team_id', props.teamId)
    .eq('user_id', row.user_id)
    .select('user_id')
  if (err) {
    error.value = /at least one trainer/i.test(err.message)
      ? 'Ein Team braucht mindestens einen Trainer.'
      : err.message
    return
  }
  if (!data || data.length === 0) {
    error.value = 'Mitglied konnte nicht aktualisiert werden.'
    return
  }
  row.role = next
}

const remove = async (row: Row) => {
  error.value = null
  const { data, error: err } = await client
    .from('memberships')
    .delete()
    .eq('team_id', props.teamId)
    .eq('user_id', row.user_id)
    .select('user_id')
  if (err) {
    error.value = /at least one trainer/i.test(err.message)
      ? 'Ein Team braucht mindestens einen Trainer.'
      : err.message
    return
  }
  if (!data || data.length === 0) {
    error.value = 'Mitglied konnte nicht entfernt werden.'
    return
  }
  rows.value = rows.value.filter((r) => r.user_id !== row.user_id)
}

const resetAvatar = async (row: Row) => {
  error.value = null
  try {
    await moderateProfile({ target_user_id: row.user_id, team_id: props.teamId, field: 'avatar' })
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Avatar konnte nicht zurückgesetzt werden.'
  }
}

const resetName = async (row: Row) => {
  error.value = null
  try {
    await moderateProfile({ target_user_id: row.user_id, team_id: props.teamId, field: 'name' })
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Name konnte nicht zurückgesetzt werden.'
  }
}

defineExpose({ reload: load })
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-semibold text-neutral-900">Mitglieder</h3>
    <p v-if="loading" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <ul v-else class="divide-y border rounded bg-white">
      <li v-for="row in rows" :key="row.user_id" class="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3">
        <div class="flex items-center gap-3 text-sm">
          <img
            v-if="row.avatar_path"
            :src="`/api/profile/avatar/${row.user_id}`"
            alt=""
            data-testid="member-avatar-image"
            class="h-8 w-8 rounded-full object-cover bg-neutral-100"
          />
          <div
            v-else
            class="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-xs"
            aria-hidden="true"
          >
            ?
          </div>
          <div>
            <p class="font-medium text-neutral-900">
              {{ row.display_name ?? row.user_id }}
              <span v-if="row.user_id === currentUser?.sub" class="text-xs text-neutral-500">(du)</span>
            </p>
            <p class="text-neutral-500">{{ row.role === 'trainer' ? 'Trainer' : 'Spieler' }}</p>
          </div>
        </div>
        <div v-if="isTrainer" class="flex gap-2">
          <select
            :value="row.role"
            class="min-h-touch px-2 rounded border border-neutral-300 text-sm bg-white"
            @change="(e) => changeRole(row, (e.target as HTMLSelectElement).value as 'trainer' | 'player')"
          >
            <option value="player">Spieler</option>
            <option value="trainer" :disabled="row.role === 'trainer' && trainerCount === 1">Trainer</option>
          </select>
          <button
            type="button"
            data-testid="member-reset-avatar"
            class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
            @click="resetAvatar(row)"
          >
            Avatar zurücksetzen
          </button>
          <button
            type="button"
            data-testid="member-reset-name"
            class="min-h-touch px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-100"
            @click="resetName(row)"
          >
            Namen zurücksetzen
          </button>
          <button
            type="button"
            class="min-h-touch px-3 rounded border border-red-300 text-red-700 text-sm hover:bg-red-50"
            @click="remove(row)"
          >
            Entfernen
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
