<script setup>
import { ref } from 'vue'
import { initMenu, wamp_topic } from '@/composables/TandE/SideNav.ts'

definePageMeta({
  title: 'Test And Evaluation',
})
initMenu(0)
const selected_sensor_name = ref({ v: 'Uplink Sensor' })
const sensor_options = [
  { v: 'Uplink Sensor' },
  { v: 'Downlink Sensor' },
  { v: 'Cal Sensor A' },
  { v: 'Cal Sensor B' },
]

const test_options = [
  { v: 'Power Linearity' },
  { v: 'Frequency Linearity' },
]

const powermeter_address = ref('GPIB0:13')
const sg_address = ref('GPIB0:1')
const sg_start_power = ref(-40)
const sg_stop_power = ref(10)
const sg_power_step = ref(1)
const selected_channel_numbers = ref('1-10,12,14-20')
const selected_test = ref({ v: 'Power Linearity' })
const show_power_settings = ref(true)
const selected_powermeter_model = ref({ v: 'ML4238' })
const powermeter_options = [
  { v: 'ML4238' },
  { v: 'E4419B' },
  { v: 'N1914A' },

]

const selected_sg_model = ref({ v: 'E8257D' })
const sg_options = [
  { v: 'E8257D' },
]

watch(selected_test, (newVal) => {
  // console.log("Selected test changed:", newVal);
  if (newVal.v == 'Power Linearity')
    show_power_settings.value = true
  else show_power_settings.value = false
  // Perform any additional actions based on the selected test
})

const freq_steps = ref(30)
function start_test() {
  const request_data = {
    type: 'start_test',
    name: selected_sensor_name.value.v,
    pm_address_v: powermeter_address.value,
    sg_address_v: sg_address.value,
    sg_start_power: sg_start_power.value,
    sg_stop_power: sg_stop_power.value,
    sg_power_step: sg_power_step.value,
    channel_numbers: selected_channel_numbers.value,
    pm_model_v: selected_powermeter_model.value.v,
    sg_model_v: selected_sg_model.value.v,
    test: selected_test.value.v,
    sg_freq_number_of_steps: freq_steps.value,
  }

  rpc('com.te.power_meter_test', [request_data]).then(
    async (res) => {
      if (res?.error != null) {
        const msg = {
          summary: 'Failed to Start Power Meter  TE',
          status: `Error:${res.error}`,
          progress: '0',
        }
        wamp_publish(wamp_topic, [], msg)
      }
    },
  )
}

function abort_test() {
  rpc('com.te.abort', [{
    type: 'abort_test',
    sensor_name: selected_sensor_name.value.v,
  }])
}
</script>

<template>
  <div class="content">
    <AppName appname="Test And Evaluation" />
    <div class="flex gap-8 mt-8">
      <div class="w-1/4">
        <label text-cyan-300> Select Sensor </label>

        <Select
          v-model="selected_sensor_name" class="mt-0 w-full" :options="sensor_options" option-label="v"
          placeholder="Select Sensor"
        />
      </div>
      <div class="w-1/4">
        <label text-cyan-300>
          Power Meter IP/GPIB Address
        </label>
        <InputText
          id="powermeter_add" v-model="powermeter_address" class="w-full"
          aria-describedby="powermeter_add"
        />
      </div>

      <div class="w-1/6">
        <label text-cyan-300>
          PM Model
        </label>
        <Select
          v-model="selected_powermeter_model" class="mt-0 w-full" :options="powermeter_options"
          option-label="v" placeholder="Select PM Model"
        />
      </div>

      <div class="w-1/4">
        <label text-cyan-300>
          Siganl Generator IP/GPIB Address
        </label>
        <InputText id="sg_add" v-model="sg_address" class="w-full" aria-describedby="sg_add" />
      </div>

      <div class="w-1/6">
        <label text-cyan-300>
          SG Model
        </label>
        <Select
          v-model="selected_sg_model" class="mt-0 w-full" :options="sg_options" option-label="v"
          placeholder="Select SG Model"
        />
      </div>
    </div>

    <div class="flex gap-8 mt-10">
      <div class="w-1/4">
        <label text-cyan-300> Select Test </label>

        <Select
          v-model="selected_test" class="mt-0 w-full" :options="test_options" option-label="v"
          placeholder="Select Test"
        />
      </div>
    </div>

    <div v-if="show_power_settings" class="flex gap-4 mt-4">
      <Card
        class="w-3/4 mt-4 border-2 border-2 border-cyan-200 border-solid p-4  text-black rounded rounded-lg p-4"
        overflow: hidden
      >
        <template #title>
          <div class="mb-2 text-cyan">
            SG Power
          </div>
        </template>
        <template #content>
          <div class="flex gap-4 justify-between">
            <div class="">
              <label text-cyan-300>
                Start
              </label>
              <InputNumber
                v-model="sg_start_power" class="w-full" show-buttons button-layout="horizontal"
                :min="-50" :max="25" :step="1" mode="decimal"
              />
            </div>

            <div class="">
              <label text-cyan-300>
                Stop
              </label>
              <InputNumber
                v-model="sg_stop_power" class="w-full" show-buttons button-layout="horizontal"
                :min="-50" :max="25" :step="1" mode="decimal"
              />
            </div>

            <div class="">
              <label text-cyan-300>
                Step
              </label>
              <InputNumber
                v-model="sg_power_step" class="w-full" show-buttons button-layout="horizontal"
                :min="0.5" :max="5" :step="0.5"
              />
            </div>
          </div>
        </template>
        <template #footer />
      </Card>
    </div>

    <div v-else class="flex gap-4 mt-4">
      <Card
        class="w-3/4 mt-4 border-2 border-2 border-cyan-200 border-solid p-4  text-black rounded rounded-lg p-4"
        overflow: hidden
      >
        <template #title>
          <div class="mb-2 text-cyan">
            SG Frequency
          </div>
        </template>
        <template #content>
          <div class="flex gap-4 justify-between">
            <div class="">
              <label text-cyan-300>
                Number Of Steps in BW
              </label>
              <InputNumber
                v-model="freq_steps" class="w-full" show-buttons button-layout="horizontal"
                :min="1" :max="500" :step="1"
              />
            </div>
          </div>
        </template>
        <template #footer />
      </Card>
    </div>

    <div class="flex gap-4 mt-4 mt-8">
      <div class="w-1/4">
        <label text-cyan-300> Enter Channels </label>
        <InputText v-model="selected_channel_numbers" class="w-full" />
      </div>
    </div>

    <div class="flex gap-4 mt-8">
      <div class="w-1/6">
        <Button class="w-full" label="Start" severity="primary" raised @click="start_test" />
      </div>
      <div class="w-1/6">
        <Button class="w-full" label="Abort" severity="warn" raised @click="abort_test" />
      </div>
    </div>

    <div class="flex">
      <div class="w-full">
        <ExecutionStatus :topic="wamp_topic" />
      </div>
    </div>
  </div>
</template>
