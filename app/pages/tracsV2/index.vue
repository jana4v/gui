<template>
  <div class="content">
    <AppName appname="TRACS V2 - Measure" />
    <div class="coming-soon">
      <i class="pi pi-chart-line" />
      <p>Measure workspace</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { initMenu } from '@/composables/tracsV2/SideNav';

definePageMeta({
  title: 'TRACS V2 Measure',
});

initMenu(0);
</script>

<style scoped>
.coming-soon {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  color: #64748b;
}

.coming-soon .pi {
  font-size: 2.5rem;
  color: #22d3ee;
}
</style>
