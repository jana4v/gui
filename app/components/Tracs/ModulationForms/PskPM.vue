<script lang="ts" setup>
interface DataPropType {
  ports: string[][]
  sub_carriers: number[][]
  frequencies: string[][]
}

// watch(()=>{})

const props = defineProps({
  data: {
    type: Object as () => DataPropType,
    default: () => ({
      ports: [['EV'], ['AEV'], ['GLOBAL']],
      sub_carriers: [[32], [128]],
      frequencies: [['DF', ''], ['F1', ''], ['F2', '']],
    }),
  },
})
const isEditable = inject<Ref<boolean>>('isEditable', ref(false))
const isReadOnly = ref(true)
const counter = ref(0)

function change_editing_mode() {
  isReadOnly.value = !(isEditable.value)
  dl_port_table_hotSettings.value.readOnly = isReadOnly.value
  down_link_sub_carriers_table_hotSettings.value.readOnly = isReadOnly.value
  dl_frequency_table_hotSettings.value.readOnly = isReadOnly.value
  console.log(dl_port_table_hotSettings.value.readOnly)
  counter.value += 1
}

onMounted(async () => {
  change_editing_mode()
})

watch(isEditable, (n) => {
  change_editing_mode()
})

// if(props.data.ports == undefined) props.data.ports = [["EV"], ["AEV"], ["GLOBAL"]];
// if(props.data.sub_carriers == undefined) props.data.sub_carriers = [[32], [128]];
// if(props.data.frequencies == undefined) props.data.frequencies = [["DF",""], ["F1",""], ["F2",""]];

const ports = ref(props.data.ports)

let dl_port_table_hotSettings = ref({ height: 150, width: '100%', stretchH: 'all', colHeaders: ['DL PORTS'], readOnly: true })

const sub_carriers = ref(props.data.sub_carriers)
let down_link_sub_carriers_table_hotSettings = ref({ contextMenu: false, height: 150, width: '100%', stretchH: 'all', colHeaders: ['Sub Carriers(kHz)'], readOnly: true })

const frequencies = ref(props.data.frequencies)
let dl_frequency_table_hotSettings = ref({ height: 150, width: '100%', stretchH: 'all', colHeaders: ['Frequency Label', 'Frequency(MHz)'], colWidths: [200, 200], readOnly: true })

function get_data() {
  return {
    ports: ports.value,
    sub_carriers: sub_carriers.value,
    frequencies: frequencies.value,
  }
}
defineExpose({
  get_data,
})
</script>

<template>
  <div class="grid" style="min-height: 10px; min-width: 100%">
    <div class="col-3">
      <HandsonTableHandSonTbl :key="counter" :data="ports" :hot-settings="dl_port_table_hotSettings" />
    </div>
    <div class="col-3">
      <HandsonTableHandSonTbl :key="counter" :data="sub_carriers" :hot-settings="down_link_sub_carriers_table_hotSettings" />
    </div>
    <div class="col-6">
      <HandsonTableHandSonTbl :key="counter" :data="frequencies" :hot-settings="dl_frequency_table_hotSettings" />
    </div>
  </div>
</template>
