<script setup>
import { ref } from 'vue'
import { table_config_func } from '@/components/gisat/tableConfigurations'
import { initMenu, wamp_topic } from '@/composables/gisat/tc_sidenav.ts'

definePageMeta({
  title: 'Telecommand',
})

initMenu(1)
const testProcedure = ref('')
const showTestProcedure = ref(false)
const ag_grid_boa_phase = ref(null)
const showExecuteTestProcedureButton = ref(false)

async function gnerateTestProcedure() {
  showTestProcedure.value = false
  const data = await ag_grid_boa_phase.value.getUpdatedRows()
  // console.log(data);

  useAPIFetch(`/tc/generate_boa_phase_file`, { method: 'post', body: data }).then((res) => {
    if (res.error.value == null && res.data.value.length > 0) {
      // console.log(res.data);

      testProcedure.value = res.data.value.replace(/\\n/g, '\n')
      showTestProcedure.value = true
      showExecuteTestProcedureButton.value = true
    }
  })
}

function executeTestProcedure() {
  useAPIFetch(`/tc/executeTestProcedure`, { method: 'post', body: { file: testProcedure.value, wait_for_complete: true } }).then((res) => {
    if (res.error.value == null && res.data.value.length > 0) {
      showExecuteTestProcedureButton.value = false
    }
  })
}
const test_execution_status_store = useTestExecutionStatusStore()
</script>

<template>
  <div>
    <div class="grid">
      <div class="col-6">
        <h2>Select SSPA BOA and Phase</h2>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-4">
      <div class="">
        <!-- <AgGridAgTable :use_local_data="true" table_height="70vh" table_width="100%" app_name="test" ref="ag_grid_boa_phase"
                table_name="sspa#boa_phase" get_url="tc/boa_phase_data" :enable_column_auto_size="false"
                :table_configuration_func=table_config_func></AgGridAgTable> -->

        <AgGridTable
          ref="ag_grid_boa_phase" :use_local_data="true" table_height="60vh" table_width="100%"
          app_name="test" table_name="sspa#boa_phase" get_url="tc/boa_phase_data"
          :enable_column_auto_size="false" :table_configuration_func="table_config_func" :show_filter="false"
        />
      </div>
      <div class="col-span-2">
        <div class="grid pt-2">
          <div class="col-6 gap-2">
            <Button
              label="Generate Boa & Phase File" severity="info" raised
              @click="gnerateTestProcedure"
            />
          </div>
        </div>

        <div class="grid pt-5">
          <div v-if="showTestProcedure" class="col-6 gap-2">
            <payload-tc-test-procedure-display :test-procedure="testProcedure" />
          </div>
        </div>

        <div class="grid pt-4">
          <div class="col-6 gap-2">
            <Button
              v-if="showExecuteTestProcedureButton" label="Execute Test Procedure"
              severity="primary" raised @click="executeTestProcedure"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-1">
      <div class="">
        <ExecutionStatus :topic="wamp_topic" />
      </div>
    </div>
  </div>
</template>
