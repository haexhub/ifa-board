<script setup lang="ts">
import { computed, ref } from 'vue'
import CategoryForm from '~/components/categories/CategoryForm.vue'
import CategoryList from '~/components/categories/CategoryList.vue'

definePageMeta({
  middleware: ['team-context', 'trainer-only'],
})

const { currentTeam } = useTeamContext()
const teamId = computed(() => currentTeam.value?.id ?? '')

type Cat = {
  id: string
  name: string
  value_min: number
  value_max: number
  sort_order: number
  active: boolean
}

const categoryList = ref<InstanceType<typeof CategoryList> | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const nextSortOrder = ref(1)
const editingCategory = ref<Cat | null>(null)
const dialogSeq = ref(0)

const openCreateDialog = () => {
  editingCategory.value = null
  nextSortOrder.value = (categoryList.value?.maxSortOrder() ?? 0) + 1
  dialogSeq.value += 1
  dialog.value?.showModal()
}

const openEditDialog = (category: Cat) => {
  editingCategory.value = category
  dialogSeq.value += 1
  dialog.value?.showModal()
}

const onSaved = () => {
  dialog.value?.close()
  categoryList.value?.reload?.()
}
</script>

<template>
  <section class="space-y-8" data-testid="categories-page">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-neutral-900">Punktekategorien</h1>
      <p class="text-neutral-600">Kategorien für {{ currentTeam?.name ?? 'Team' }} verwalten.</p>
    </header>

    <button
      type="button"
      data-testid="category-new-button"
      class="min-h-touch px-4 rounded bg-neutral-900 text-white font-medium hover:bg-neutral-800"
      @click="openCreateDialog"
    >
      Neue Kategorie
    </button>

    <CategoryList v-if="teamId" ref="categoryList" :team-id="teamId" @edit="openEditDialog" />

    <dialog
      ref="dialog"
      data-testid="category-dialog"
      class="rounded-lg p-0 backdrop:bg-black/40 w-full max-w-md"
    >
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-neutral-900">
            {{ editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie' }}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            class="text-neutral-500 hover:text-neutral-900"
            @click="dialog?.close()"
          >
            ✕
          </button>
        </div>
        <CategoryForm
          v-if="teamId"
          :key="`${dialogSeq}-${editingCategory?.id ?? 'new'}`"
          :team-id="teamId"
          :next-sort-order="nextSortOrder"
          :category="editingCategory"
          @saved="onSaved"
        />
      </div>
    </dialog>
  </section>
</template>
