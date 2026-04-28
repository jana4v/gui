<template>
  <div class="db-page">
    <!-- Sidebar -->
    <aside class="db-sidebar-wrapper">
      <TracsV2DBSidebar
        :active-section="activeSection"
        @select="activeSection = $event"
        @add="handleAdd"
        @remove="handleRemove"
      />
    </aside>

    <!-- Main content -->
    <main class="db-content">
      <!-- Systems → Transmitter -->
      <TracsV2DatabaseSystemsTransmitterPanel v-if="activeSection === 'transmitter'" />

      <!-- Systems → Receiver -->
      <TracsV2DatabaseSystemsReceiverPanel v-else-if="activeSection === 'receiver'" />

      <!-- Systems → Transponder (placeholder) -->
      <div v-else-if="activeSection === 'transponder'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Transponder management — coming soon</p>
      </div>

      <!-- Specifications -->
      <TracsV2DatabaseSpecificationsPanel
        v-else-if="selectedSpecParameter"
        :active-parameter="selectedSpecParameter"
      />

      <!-- Test Profiles → Transmitter / Spurious / Bands -->
      <SpuriousSearchBandsPanel v-else-if="activeSection === 'tp_tx_spurious_bands'" />

      <!-- Test Profiles → Transmitter / Spurious / Profile -->
      <SpuriousProfilePanel v-else-if="activeSection === 'tp_tx_spurious_profile'" />

      <!-- Test Profiles → Receiver (coming soon) -->
      <div v-else-if="activeSection === 'test_profiles_receiver'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Test Profiles / <strong class="section-name">Receiver</strong> — coming soon</p>
      </div>

      <!-- Test Profiles → Transponder (coming soon) -->
      <div v-else-if="activeSection === 'test_profiles_transponder'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Test Profiles / <strong class="section-name">Transponder</strong> — coming soon</p>
      </div>

      <!-- Test Systems → Instruments -->
      <TestSystemsInstrumentsPanel v-else-if="activeSection === 'test_systems_instruments'" />

      <!-- Test Systems → TSM Paths -->
      <TestSystemsTsmPathsPanel v-else-if="activeSection === 'test_systems_tsm_paths'" />

      <!-- Test Systems → Power Meter -->
      <TestSystemsPowerMeterPanel v-else-if="activeSection === 'test_systems_power_meter'" />

      <!-- On Board Losses → Transmitter -->
      <OnBoardLossesTransmitterLossPanel v-else-if="activeSection === 'on_board_losses_transmitter'" />

      <!-- On Board Losses → Receiver (coming soon) -->
      <div v-else-if="activeSection === 'on_board_losses_receiver'" class="coming-soon">
        <i class="pi pi-server" />
        <p>On Board Losses / <strong class="section-name">Receiver</strong> — coming soon</p>
      </div>

      <!-- On Board Losses → Transponder (coming soon) -->
      <div v-else-if="activeSection === 'on_board_losses_transponder'" class="coming-soon">
        <i class="pi pi-server" />
        <p>On Board Losses / <strong class="section-name">Transponder</strong> — coming soon</p>
      </div>

      <!-- Calibration → Transmitter -->
      <CalibrationTransmitterPanel v-else-if="activeSection === 'calibration_transmitter'" />

      <!-- Calibration → Receiver (coming soon) -->
      <div v-else-if="activeSection === 'calibration_receiver'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Calibration / <strong class="section-name">Receiver</strong> — coming soon</p>
      </div>

      <!-- Calibration → Transponder (coming soon) -->
      <div v-else-if="activeSection === 'calibration_transponder'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Calibration / <strong class="section-name">Transponder</strong> — coming soon</p>
      </div>

      <!-- Test Plan → Transmitter -->
      <TestPlanTransmitterPanel v-else-if="activeSection === 'test_plan_transmitter'" />

      <!-- Test Plan → Receiver (coming soon) -->
      <div v-else-if="activeSection === 'test_plan_receiver'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Test Plan / <strong class="section-name">Receiver</strong> — coming soon</p>
      </div>

      <!-- Test Plan → Transponder (coming soon) -->
      <div v-else-if="activeSection === 'test_plan_transponder'" class="coming-soon">
        <i class="pi pi-server" />
        <p>Test Plan / <strong class="section-name">Transponder</strong> — coming soon</p>
      </div>

      <!-- ENV Data -->
      <EnvDataPanel v-else-if="activeSection === 'env_data'" />

      <!-- All other sections (placeholder) -->
      <div v-else class="coming-soon">
        <i class="pi pi-database" />
        <p>
          <strong class="section-name">{{ sectionLabel }}</strong> — coming soon
        </p>
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { initMenu } from '@/composables/tracsV2/SideNav';
import SpuriousSearchBandsPanel from '@/components/TracsV2/Database/TestProfiles/SpuriousSearchBandsPanel.vue';
import SpuriousProfilePanel from '@/components/TracsV2/Database/TestProfiles/SpuriousProfilePanel.vue';
import TestSystemsInstrumentsPanel from '@/components/TracsV2/Database/TestSystems/InstrumentsPanel.vue';
import TestSystemsTsmPathsPanel from '@/components/TracsV2/Database/TestSystems/TsmPathsPanel.vue';
import TestSystemsPowerMeterPanel from '@/components/TracsV2/Database/TestSystems/PowerMeterPanel.vue';
import OnBoardLossesTransmitterLossPanel from '@/components/TracsV2/Database/OnBoardLosses/TransmitterLossPanel.vue';
import CalibrationTransmitterPanel from '@/components/TracsV2/Database/Calibration/TransmitterCalibrationPanel.vue';
import TestPlanTransmitterPanel from '@/components/TracsV2/Database/TestPlan/TransmitterTestPlanPanel.vue';
import EnvDataPanel from '@/components/TracsV2/Database/EnvData/EnvDataPanel.vue';

const activeSection = ref('transmitter');

const sectionLabels: Record<string, string> = {
  configurations: 'Configurations',
  specifications_power: 'Specifications / Power',
  specifications_frequency: 'Specifications / Frequency',
  specifications_modulation_index: 'Specifications / Modulation Index',
  specifications_spurious: 'Specifications / Spurious',
  specifications_command_threshold: 'Specifications / Command Threshold',
  test_systems_instruments: 'Test Systems / Instruments',
  test_systems_tsm_paths: 'Test Systems / TSM Paths',
  test_systems_power_meter: 'Test Systems / Power Meter',
  on_board_losses_transmitter: 'On Board Losses / Transmitter',
  on_board_losses_receiver: 'On Board Losses / Receiver',
  on_board_losses_transponder: 'On Board Losses / Transponder',
  calibration_transmitter: 'Calibration / Transmitter',
  calibration_receiver: 'Calibration / Receiver',
  calibration_transponder: 'Calibration / Transponder',
  test_plan_transmitter: 'Test Plan / Transmitter',
  test_plan_receiver: 'Test Plan / Receiver',
  test_plan_transponder: 'Test Plan / Transponder',
  tp_tx_spurious_bands: 'Test Profiles / Transmitter / Spurious / Bands',
  tp_tx_spurious_profile: 'Test Profiles / Transmitter / Spurious / Profile',
  test_profiles_receiver: 'Test Profiles / Receiver',
  test_profiles_transponder: 'Test Profiles / Transponder',
  tm_tc: 'TM TC',
  env_data: 'ENV Data',
};

const specSectionToParameter: Record<string, 'power' | 'frequency' | 'modulation_index' | 'spurious' | 'command_threshold'> = {
  specifications_power: 'power',
  specifications_frequency: 'frequency',
  specifications_modulation_index: 'modulation_index',
  specifications_spurious: 'spurious',
  specifications_command_threshold: 'command_threshold',
};

const selectedSpecParameter = computed(() => specSectionToParameter[activeSection.value]);

const sectionLabel = computed(() => sectionLabels[activeSection.value] ?? activeSection.value);

initMenu(3);

function handleAdd() {
  // Future: trigger add action in active panel via event bus or store
}

function handleRemove() {
  // Future: trigger remove action in active panel
}
</script>

<style scoped>
.db-page {
  display: flex;
  height: calc(100vh - 4rem);
  min-height: 0;
  background: #081525;
}

.db-sidebar-wrapper {
  width: 220px;
  flex-shrink: 0;
}

.db-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
}

/* Placeholder "coming soon" panels */
.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 60vh;
  color: #475569;
  font-size: 1rem;
}

.coming-soon .pi {
  font-size: 3rem;
  color: #1e3a5f;
}

.section-name {
  color: #22d3ee;
}
</style>
