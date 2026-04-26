<script setup>
import { initMenu } from '@/composables/tracs/SideNav.ts'

definePageMeta({
  title: 'Telecommand',
})

initMenu(0)
</script>

<template>
  <AppName appname="TTC RF Automated Checkout Software" />
  <div class="">
    <Splitter class="h-[80vh] w-full">
      <SplitterPanel class="" :size="70" :min-size="50">
        <tracs-test-selection />
      </SplitterPanel>
      <SplitterPanel class="" :size="30" :min-size="30">
        Panel 2
      </SplitterPanel>
    </Splitter>
  </div>
  <!-- <div class="grid">
        <div class="col-8" style="max-height: 85vh;">

        </div>
        <div class="col-4" style="max-height: 85vh;">
           <tracs-test-execution-console style="min-height: 85vh;"></tracs-test-execution-console>
        </div>
    </div> -->
</template>
