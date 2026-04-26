<template>
  <div class="cal-page">
    <main class="cal-content">
      <TracsV2CalibrationCalIdSelector 
        v-model="activeCalId" 
        v-model:cal-type="activeSection"
        v-model:include-spurious-bands="includeSpuriousBands"
        :is-running="isCalRunning"
        @generate-report="onGenerateReport"
      />

      <!-- ── Section panels ─────────────────────────────────────────── -->
      <div class="section-body">
        <div v-if="activeSection === 'uplink'" class="coming-soon">
          <i class="pi pi-arrow-up-right" />
          <p>Calibration / <strong class="section-name">Uplink</strong> — coming soon</p>
        </div>

        <TracsV2CalibrationDownlinkChannelsPanel
          v-else-if="activeSection === 'downlink'"
          :cal-id="activeCalId"
          :cal-type="activeSection"
          :include-spurious-bands="includeSpuriousBands"
        />

        <TracsV2CalibrationCalSgChannelsPanel
          v-else-if="activeSection === 'cal_sg' || activeSection === 'inject_cal'"
          :cal-id="activeCalId"
          :cal-type="activeSection"
          :include-spurious-bands="includeSpuriousBands"
          :trigger-generate-report="generateReportTrigger"
          @update:is-running="isCalRunning = $event"
        />

        <div v-else-if="activeSection === 'tvac_ref'" class="coming-soon">
          <i class="pi pi-sliders-v" />
          <p>Calibration / <strong class="section-name">TVAC Ref</strong> — coming soon</p>
        </div>

        <div v-else-if="activeSection === 'fixed_pad'" class="coming-soon">
          <i class="pi pi-minus-circle" />
          <p>Calibration / <strong class="section-name">Fixed Pad</strong> — coming soon</p>
        </div>

        <div v-else class="coming-soon">
          <i class="pi pi-cog" />
          <p>Calibration / <strong class="section-name">Unknown Type</strong> — coming soon</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { initMenu } from '@/composables/tracsV2/SideNav';
import { useToast } from 'primevue/usetoast';

const activeSection = ref('uplink');
const activeCalId = ref('');
const includeSpuriousBands = ref(true);
const isCalRunning = ref(false);
const generateReportTrigger = ref(0);

const toast = useToast();

definePageMeta({
  title: 'TRACS V2 Calibration',
});

initMenu(1);

async function onGenerateReport() {
  if (!['cal_sg', 'inject_cal'].includes(activeSection.value)) {
    toast.add({ severity: 'warn', summary: 'Unsupported', detail: 'Report generation is available only for cal_sg and inject_cal.', life: 3200 });
    return;
  }

  const calId = activeCalId.value.trim();
  if (!calId) {
    toast.add({ severity: 'warn', summary: 'Cal ID Required', detail: 'Please enter Cal ID to generate report.', life: 3200 });
    return;
  }

  // Increment trigger counter — CalSgChannelsPanel watches this and runs generation with status messages.
  generateReportTrigger.value += 1;
}
</script>

<style scoped>
.cal-page {
  display: flex;
  height: calc(100vh - 4rem);
  min-height: 0;
  background: #081525;
}

.cal-content {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.section-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.section-body > * {
  flex: 1;
  min-height: 0;
}

.coming-soon {
  min-height: 60vh;
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

.section-name {
  color: #22d3ee;
}
</style>
