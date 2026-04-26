<script setup>
// import {useAPIFetch} from '~/composables/useAPIFetch'
import { ref } from 'vue'
import { initMenu, wamp_topic } from '@/composables/gisat/tc_sidenav.ts'
import { publishToWampTopic } from '@/composables/publishToWamp.ts'

definePageMeta({
  title: 'Telecommand',
})

initMenu(3)

const selectedcommands = ref([])
const commandsList = ref([])
const testProcedure = ref('')
const showTestProcedure = ref(false)
const showExecuteTestProcedureButton = ref(false)

useAPIFetch(`tc/getTelecommands`, { method: 'GET' }).then(async (res) => {
  if (res.error == null && res.data.length > 0) {
    commandsList.value = res.data.map(opt => ({ name: opt }))
  }
  else {
    const msg = {
      summary: 'Failed to Get Testcommands List Names from Database',
      status: `Error:${res.error.data.detail}`,
      progress: '0',
    }
    await publishToWampTopic(msg, wamp_topic)
  }
})

function gnerateTestProcedure() {
  showTestProcedure.value = false
  console.log(selectedcommands.value.map(tc => tc.tc))
  useAPIFetch(`/tc/generate_manual_commands_file`, { method: 'post', body: selectedcommands.value.map(tc => tc.tc) }).then((res) => {
    if (res.error == null && res.data.length > 0) {
      testProcedure.value = res.data.replace(/\\n/g, '\n')
      showTestProcedure.value = true
      showExecuteTestProcedureButton.value = true
    }
  })
}

function executeTestProcedure() {
  useAPIFetch(`/tc/executeTestProcedure`, { method: 'post', body: { file: testProcedure.value, wait_for_complete: true } }).then((res) => {
    if (res.error == null && res.data.length > 0) {
      showExecuteTestProcedureButton.value = false
    }
  })
}

onMounted(async () => {
})
</script>

<template>
  <div class="grid pt-4">
    <div class="col-2">
      <h3>Select Commands</h3>
      <MultiSelect
        v-model="selectedcommands" :options="commandsList" filter option-label="tc"
        placeholder="Select Commands" :max-selected-labels="3" class="w-full md:w-20rem"
      />
    </div>
  </div>

  <div class="grid pt-4">
    <div class="col-6 gap-2">
      <Button label="Generate Test Procedure" severity="info" raised @click="gnerateTestProcedure" />
    </div>
  </div>

  <div class="grid pt-4">
    <div v-if="showTestProcedure" class="col-6 gap-2">
      <payload-tc-test-procedure-display :test-procedure="testProcedure" />
    </div>
  </div>

  <div class="grid pt-4">
    <div class="col-6 gap-2">
      <Button
        v-if="showExecuteTestProcedureButton" label="Execute Test Procedure" severity="primary"
        raised @click="executeTestProcedure"
      />
    </div>
  </div>

  <div class="grid mt-4">
    <div class="col-12">
      <ExecutionStatus :topic="wamp_topic" />
    </div>
  </div>
</template>
