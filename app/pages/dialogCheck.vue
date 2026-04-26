<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useDialogRequestStore } from '@/stores/dialogRequest'

const dialogStore = useDialogRequestStore()
const { dialogRequest } = storeToRefs(dialogStore)
const appName = 'my_app'

const showDialog = ref(false)
const dialogProps = ref<Record<string, any>>({})

watch(dialogRequest, (req) => {
  if (req && req.app_name === appName) {
    dialogProps.value = {
      title: req.dialogTitle,
      message: req.dialogMessage,
      options: req.dialogOptions,
      input: req.dialogInput,
    }
    showDialog.value = true
  }
})

function onDialogResolved(result: any) {
  showDialog.value = false
  // Respond to backend if resolver exists
  if (dialogStore.dialogRequest?.__resolve) {
    dialogStore.dialogRequest.__resolve(result)
  }
  dialogStore.clearDialogRequest()
}
</script>

<template>
  <UserInputDialog
    v-if="showDialog"
    v-bind="dialogProps"
    @resolved="onDialogResolved"
  />
</template>
