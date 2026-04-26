<script setup>
import { ref } from 'vue'
// import AppMenuItem from '@/layouts/AppMenuItem.vue';
import { useLayout } from '@/layouts/composables/layout'

const { layoutConfig, layoutState, isSidebarActive } = useLayout()

const sidebar_minimal = computed(() => layoutState.staticMenuDesktopInactive.value && layoutConfig.menuMode.value === 'static')
const model = ref([
  {
    label: 'TC Application',
    items: [
      {
        label: 'CFG Based Commands',
        icon: 'pi pi-microsoft',
        to: '/payloadTc',
      },

      {
        label: 'Data Commands',
        icon: 'pi pi-calculator',
        to: '/payloadTc/dataCommands',
      },
      {
        label: 'Manual Commands',
        icon: 'i-carbon-settings',
        to: '/payloadTc/manualCommands',
      },
      {
        label: 'TC Files',
        icon: 'pi pi-file',
        to: '/payloadTc/files',
      },
      {
        label: 'Utility',
        icon: 'pi pi-file',
        to: '/payloadTc/utility',
      },
    ],
  },
])
</script>

<template>
  <div class="container">
    <div class="layout-menu">
      <ul>
        <img class="antenna" src="/tc.gif" alt="logo">
        <template v-for="(item, i) in model" :key="item">
          <app-menu-item v-if="!item.separator" :item="item" :index="i" />
          <li v-if="item.separator" class="menu-separator" />
        </template>
      </ul>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: calc(100vh - 10rem);
}
.antenna{
    width: 100px;
    margin-right: 10px;
    color: brown;

}
</style>
