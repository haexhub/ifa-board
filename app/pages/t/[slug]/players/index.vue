<script setup lang="ts">
import { computed, ref } from 'vue'
import InviteForm from '~/components/team/InviteForm.vue'
import PlayerForm from '~/components/players/PlayerForm.vue'
import PlayerList from '~/components/players/PlayerList.vue'

definePageMeta({
  middleware: ['team-context', 'trainer-only'],
})

const { currentTeam } = useTeamContext()
const teamId = computed(() => currentTeam.value?.id ?? '')

type PlayerRow = {
  id: string
  name: string
  jersey_number: number | null
  position: string | null
  photo_consent: boolean
  active: boolean
}

const playerList = ref<InstanceType<typeof PlayerList> | null>(null)
const playerDialog = ref<HTMLDialogElement | null>(null)
const inviteDialog = ref<HTMLDialogElement | null>(null)
const editingPlayer = ref<PlayerRow | null>(null)
const dialogSeq = ref(0)

const openCreateDialog = () => {
  editingPlayer.value = null
  dialogSeq.value += 1
  playerDialog.value?.showModal()
}

const openEditDialog = (player: PlayerRow) => {
  editingPlayer.value = player
  dialogSeq.value += 1
  playerDialog.value?.showModal()
}

const onPlayerSaved = () => {
  playerDialog.value?.close()
  playerList.value?.reload?.()
}

const openInviteDialog = () => {
  inviteDialog.value?.showModal()
}

const onInvited = () => {
  inviteDialog.value?.close()
}
</script>

<template>
  <section class="space-y-8" data-testid="players-page">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">Spielerstamm</h1>
      <p class="text-neutral-600">Kader für {{ currentTeam?.name ?? 'Team' }} verwalten.</p>
    </header>

    <button
      type="button"
      data-testid="player-new-button"
      class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800"
      @click="openCreateDialog"
    >
      Neuer Spieler
    </button>

    <PlayerList v-if="teamId" ref="playerList" :team-id="teamId" @edit="openEditDialog" @invite="openInviteDialog" />

    <dialog
      ref="playerDialog"
      data-testid="player-dialog"
      class="rounded-lg p-0 backdrop:bg-black/40 w-full max-w-md"
    >
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-neutral-900">
            {{ editingPlayer ? 'Spieler bearbeiten' : 'Neuer Spieler' }}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            class="text-neutral-500 hover:text-neutral-900"
            @click="playerDialog?.close()"
          >
            ✕
          </button>
        </div>
        <PlayerForm
          v-if="teamId"
          :key="`${dialogSeq}-${editingPlayer?.id ?? 'new'}`"
          :team-id="teamId"
          :player="editingPlayer"
          @saved="onPlayerSaved"
        />
      </div>
    </dialog>

    <dialog
      ref="inviteDialog"
      data-testid="player-invite-dialog"
      class="rounded-lg p-0 backdrop:bg-black/40 w-full max-w-md"
    >
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-neutral-900">Spieler einladen</h2>
          <button
            type="button"
            aria-label="Schließen"
            class="text-neutral-500 hover:text-neutral-900"
            @click="inviteDialog?.close()"
          >
            ✕
          </button>
        </div>
        <InviteForm v-if="teamId" :team-id="teamId" default-role="player" @issued="onInvited" />
      </div>
    </dialog>
  </section>
</template>
