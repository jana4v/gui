# System States Configuration - Design Document

## Overview

The **System States** feature enables telemetry monitoring that adapts based on the operational state of the satellite system. Instead of fixed limits for all telemetry parameters, limits can vary depending on the system's current state (e.g., Pre-Launch, In-Orbit, Safe Mode, etc.).

## Problem Statement

Satellite telemetry parameters often have different acceptable ranges depending on the system's operational context:
- **Temperature Limits**: Different during ground operations vs. in-orbit
- **Power Requirements**: Vary between deployment phases
- **Sensor Calibration**: Different ranges for different mission modes
- **Pressure Constraints**: Depend on cabin pressurization state

Traditional fixed-limit approaches can cause false alarms or miss genuine anomalies.

## Solution Architecture

### Three-Layer Model

#### 1. **State Definition Layer**
A state is defined by a logical condition combining telemetry values:
```
State: "In-Orbit"
Condition: (ALTITUDE > 400 AND VELOCITY > 7500) AND (PRESSURE_CABIN < 10)
```

#### 2. **State-Mnemonic Mapping Layer**
For each state, select which telemetry mnemonics to monitor:
```
State: "In-Orbit"
Monitored Mnemonics:
  - TEMP_ELECTRONICS
  - TEMP_BATTERY
  - PRESSURE_CABIN
  - POWER_DRAW
  - VOLTAGE_BUS_A
```

#### 3. **Limit Specification Layer**
Define what limits apply to each mnemonic in each state:
```
Mnemonic: TEMP_ELECTRONICS
In-Orbit Limits: [-20°C, +60°C]  (different from ground limits [-10°C, +75°C])
Tolerance: ±2°C
```

## Data Model

### Core Types

```typescript
interface SystemState {
  id: string                          // Unique identifier (UUID recommended)
  name: string                        // "Pre-Launch", "In-Orbit", "Safe Mode", etc.
  description: string                 // Human-readable purpose
  
  condition: StateCondition          // How to determine if system is in this state
  mnemonics: MnemonicLimitMapping[]  // What to monitor in this state
  
  createdAt: number                  // Timestamp
  updatedAt?: number                 // Timestamp
  enabled: boolean                   // Can deactivate states temporarily
}

interface StateCondition {
  type: 'visualBuilder' | 'monacoEditor'  // Editor preference
  logic: string                            // The actual condition
}

// Example Logic Strings:
// Visual Builder: "ALTITUDE > 400 AND VELOCITY > 7500"
// Monaco: "telemetry.ALTITUDE > 400 && telemetry.VELOCITY > 7500"

interface MnemonicLimitMapping {
  mnemonic: string              // Reference to UDTM mnemonic
  limits: string[]              // Valid values (from UDTM)
  tolerance?: string            // Optional tolerance (e.g., "±2°C", "±0.5%")
  active: boolean               // Enable/disable monitoring
  customLimits?: string         // Override UDTM limits for this state
}
```

## UI Components

### 1. **System States Dashboard** (Main Page)
- **List View**: Grid of state cards showing:
  - State name & description
  - Condition preview (truncated)
  - Count of monitored mnemonics
  - Last modified timestamp
  - Action buttons (Edit, Delete)
- **Quick Info**: Intro section explaining the concept
- **Create Button**: New state creation

**File**: `/GUI/app/pages/tm/system-states.vue`

### 2. **State Editor Dialog**
Multi-section dialog for creating/editing states:

#### Section A: Basic Information
- State Name (required)
- Description
- Enable/Disable toggle

#### Section B: State Condition
- Editor type selector: Visual Builder ↔ Monaco
- Condition text area with syntax hints
- Preview pane

**Editor Types**:
- **Visual Logic Builder**: 
  - Simple text input with operator hints
  - Show examples: `(MNEM1 > 10 AND MNEM2 < 50)`
  - Document operators: ==, !=, >, <, >=, <=, AND, OR, NOT
  
- **Monaco Editor** (Future Enhancement):
  - Full JavaScript expression evaluation
  - Syntax highlighting, autocomplete
  - Variable hints: `telemetry.MNEMONIC_NAME`
  - Reuse component from UDTM integration

#### Section C: Monitored Mnemonics
- Current selection display
- Quick-add buttons for available mnemonics
- For each mnemonic:
  - Checkbox to enable/disable monitoring
  - Limits field (comma-separated or from UDTM)
  - Tolerance override field

### 3. **Condition Editor Popup**
Dedicated full-screen editor for complex conditions:
- Syntax highlighting with Monaco (when available)
- Context-aware autocomplete showing available mnemonics
- Expression validation
- Live preview of condition logic

### 4. **Mnemonics Selector Dialog**
- Two-pane interface:
  - Left: Selected mnemonics (with remove buttons)
  - Right: Available mnemonics (pooled from UDTM)
- Drag-and-drop support (optional)
- Search/filter capability

## Workflow Examples

### Example 1: Pre-Launch Equipment Check
```
State Name: Pre-Launch
Description: Equipment checkout before launch

Condition:
  HATCH_STATUS == "CLOSED" AND 
  LAUNCH_COUNTDOWN > 0 AND 
  EXTERNAL_POWER == "CONNECTED"

Monitored Mnemonics:
  - BATTERY_VOLTAGE: Limits [27V, 32V] (ground test range)
  - TEMPERATURE_AVIONICS: Limits [-5°C, 45°C]
  - PRESSURE_CABIN: Limits [900mb, 1050mb]
  - SOLAR_PANEL_ANGLE: Limits [-2°, 2°] (stowed for launch)
```

### Example 2: In-Orbit Operations
```
State Name: In-Orbit
Description: Normal orbital operations

Condition:
  ALTITUDE > 400 km AND 
  ORBIT_VELOCITY > 7500 m/s AND 
  EQUIPMENT_MODE == "NOMINAL"

Monitored Mnemonics:
  - BATTERY_VOLTAGE: Limits [24V, 30V] (orbital range)
  - TEMPERATURE_ELECTRONICS: Limits [-20°C, +60°C]
  - PRESSURE_CABIN: Limits [95mb, 102mb] (depressurized)
  - SOLAR_PANEL_ANGLE: Limits [-180°, 180°] (tracking)
  - RADIATION_DETECTOR: Limits [0, 1000] (counts/sec)
```

### Example 3: Safe Mode
```
State Name: Safe Mode
Description: Reduced operations during anomalies

Condition:
  ANOMALY_FLAG == "TRUE" OR 
  BATTERY_LOW == "TRUE" OR 
  TEMP_CRITICAL == "TRUE"

Monitored Mnemonics:
  - BATTERY_VOLTAGE: Limits [20V, 32V] (wider tolerance)
  - TEMPERATURE_CRITICALSENSORS: Limits [-40°C, 80°C]
  - ALL_SUBSYSTEMS: Status only (SAFE, CRITICAL_ERROR)
```

## Storage & Persistence

### Frontend (Stage 1)
- **Local Storage Key**: `tm.systemStates.v1`
- **Format**: JSON array of SystemState objects
- **Limitations**: Single user, single browser, ~5-10MB limit

### Backend Integration (Stage 2)
- **API Endpoint**: `POST /gateway/api/go/v1/system-states`
- **Database**: Store in MongoDB with:
  - Versioning support
  - Audit trail (created_by, updated_by, timestamps)
  - Project/workspace association
  - History of state changes

**Proposed Backend Schema**:
```typescript
interface SystemStateDB {
  _id: ObjectId
  project: string
  state_id: string
  name: string
  description: string
  condition: {
    type: 'visual' | 'monaco'
    logic: string
  }
  mnemonics: {
    [mnemonic]: {
      limits: string[]
      tolerance?: string
      active: boolean
    }
  }
  created_at: Date
  updated_at: Date
  created_by: string
  updated_by: string
  enabled: boolean
}
```

## Integration Points

### 1. **UDTM Integration**
- Fetch available mnemonics from UDTM data
- Use UDTM limits as defaults
- Allow override of limits per-state
- Reference UDTM structure: `/tm/udtm`

**Implementation**:
```typescript
// In system-states.vue
import type { UdtmUiRow } from '../tm/udtm.vue'

async function loadUdtmMnemonics() {
  const stored = localStorage.getItem('tm.udtm.rows.v2')
  if (stored) {
    const udtmRows = JSON.parse(stored) as UdtmUiRow[]
    availableMnemonicsFromUdtm.value = udtmRows.map(r => ({
      mnemonic: r.mnemonic,
      defaultLimits: splitMultiValueInput(r.limitsText)
    }))
  }
}
```

### 2. **Live TM Integration** (Future)
- Real-time state detection
- Compare current telemetry against conditions
- Highlight which state system is currently in
- Show applicable limits for current state

### 3. **Monaco Editor Enhancement**
Similar to UDTM's `MonacoDsl` component:

```typescript
interface MonacoEditorConfig {
  language: 'javascript' | 'custom-logic'
  theme: 'light' | 'dark'
  defaultValue: string
  onChange: (value: string) => void
  contextVariables: string[] // List of available mnemonics
}
```

**Component Location**: `/GUI/app/components/tm/MonacoDsl.vue` (shared)

## Future Enhancements

### Short Term (Phase 2)
- [ ] Background color/icon for each state
- [ ] State hierarchy (parent/child states)
- [ ] Time-based states (automatic transitions)
- [ ] State transition visualization (state machine diagram)
- [ ] Import/export states as JSON

### Medium Term (Phase 3)
- [ ] Monaco editor with full syntax highlighting
- [ ] Visual logic builder (drag-drop condition builder)
- [ ] Condition validation & testing UI
- [ ] State conflict detection (overlapping conditions)
- [ ] Performance impact analysis

### Long Term (Phase 4)
- [ ] Real-time state machine engine
- [ ] State transition logging & history
- [ ] Machine learning-based state prediction
- [ ] Integration with alerting/notification system
- [ ] Multi-user collaboration & approval workflow

## Testing Strategy

### Unit Tests
```typescript
// Test condition evaluation
describe('StateCondition', () => {
  it('should evaluate visual builder conditions correctly', () => {
    const condition = parseVisualCondition("TEMP > 50 AND PRESSURE < 100")
    expect(condition({ TEMP: 55, PRESSURE: 95 })).toBe(true)
  })
})

// Test mnemonic mapping
describe('MnemonicLimitMapping', () => {
  it('should validate telemetry against state limits', () => {
    // ...
  })
})
```

### Integration Tests
```typescript
// Test state persistence
describe('State Persistence', () => {
  it('should save and load states from localStorage', () => {
    // ...
  })
})
```

### UI Tests
- State creation flow
- Condition editor interactions
- Mnemonic selection workflow
- Save/load cycle

## Migration Guide (From Fixed Limits)

For existing UDTM users:
1. Create a "Default" state with condition always true
2. Copy all mnemonics and limits from UDTM
3. Create additional states for specific operational phases
4. Override limits as needed per-state
5. Test extensively in non-critical environments

## API Reference (Backend Stage)

### Create State
```bash
POST /gateway/api/go/v1/system-states
Content-Type: application/json

{
  "project": "default",
  "name": "In-Orbit",
  "description": "...",
  "condition": {
    "type": "visual",
    "logic": "ALTITUDE > 400 AND VELOCITY > 7500"
  },
  "mnemonics": {
    "TEMP_ELECTRONICS": {
      "limits": ["-20", "60"],
      "tolerance": "±2",
      "active": true
    }
  },
  "created_by": "user@example.com"
}
```

### List States
```bash
GET /gateway/api/go/v1/system-states?project=default
```

### Update State
```bash
PUT /gateway/api/go/v1/system-states/{state_id}
```

### Delete State
```bash
DELETE /gateway/api/go/v1/system-states/{state_id}
```

### Validate Condition
```bash
POST /gateway/api/go/v1/system-states/validate-condition
{
  "condition": "ALTITUDE > 400 AND VELOCITY > 7500",
  "context": {"ALTITUDE": 450, "VELOCITY": 7600}
}
```

## Performance Considerations

- **Condition Evaluation**: Compile conditions to VM bytecode for production
- **Mnemonic Matching**: Pre-compile state mnemonics to sets for O(1) lookups
- **State Detection**: Use state machine library (e.g., xstate) for complex scenarios
- **Caching**: Cache parsed conditions and compiled state machines

## Accessibility

- Use semantic HTML (fieldset, legend for grouped controls)
- Provide keyboard shortcuts for state switching
- High contrast for state status indicators
- Screen reader labels for condition previews
- ARIA attributes for dynamic dialogs

## References

**Related Pages**:
- UDTM Configuration: `/tm/udtm`
- Live TM Monitoring: `/tm`
- Documentation: See `/docs/telemetry-system-states.md`

**External Resources**:
- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [State Machines (xstate)](https://xstate.js.org/)
- [Satellite Telemetry Standards](https://example.com)
