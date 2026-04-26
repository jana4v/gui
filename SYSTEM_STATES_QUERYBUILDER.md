# System States - Visual Query Builder Integration

## What's New

The System States feature has been enhanced with:

1. **API-Driven Mnemonics** - Mnemonics are now fetched from your backend API in `pid_mnemonic` format (same as UDTM)
2. **Visual Logic Builder** - jQuery QueryBuilder-style UI for building conditions without writing code
3. **Dynamic Condition Generation** - Rules are converted to readable logical expressions

## Key Features

### 1. Mnemonic Loading from API
- On page load, the system fetches all available mnemonics from:
  ```
  GET /gateway/api/go/v1/telemetry/subsystems
  GET /gateway/api/go/v1/mnemonics/tm/{subsystem}
  ```
- Mnemonics are displayed in `subsystem:mnemonic` format
- Shows mnemonic type and unit information in tooltips

### 2. Visual Logic Builder (jQuery QueryBuilder Style)

#### Components:
- **QueryBuilder.vue** - Main builder interface
- **QueryBuilderRuleRenderer.vue** - Displays rule hierarchy

#### Features:
- **Add Rules** - Combine mnemonic + operator + value
- **Add Groups** - Nest conditions with AND/OR operators
- **Operators Supported**:
  - Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `!contains`
  - Logical: `AND`, `OR`
  - Negation: `NOT` toggle on each rule
- **Visual Hierarchy** - Rules displayed in nested tree format with indentation
- **Real-time Preview** - Generated logic updates as you build
- **Copy Logic** - Export generated condition to code editor

### 3. Dual Editor Modes

**Mode 1: Visual Logic Builder**
```
Clicks build this structure:
  SUBSYSTEM_1:TEMPERATURE > 45
  AND
  SUBSYSTEM_1:PRESSURE < 100
```

**Mode 2: Monaco Code Editor**
```javascript
(SUBSYSTEM_1:TEMPERATURE > 45 && SUBSYSTEM_1:PRESSURE < 100) || 
(SUBSYSTEM_2:STATUS_FLAG === 'ACTIVE')
```

## Usage Flow

### Creating a State with Visual Builder

1. **Navigate** to TM → System States
2. **Click** "Create New State"
3. **Fill** state name and description
4. **Click** "Edit Condition"
5. **Select** "Visual Logic Builder" mode
6. **Build condition**:
   - Select mnemonic from dropdown (e.g., `SUBSYSTEM_1:TEMPERATURE`)
   - Choose comparison operator (e.g., `>`)
   - Enter value (e.g., `50`)
   - Click "Add Rule"
7. **Add more rules** with AND/OR/NOT operations
8. **View generated logic** at the bottom
9. **Save condition**

### Example: In-Orbit State Detection

Visual builder input:
```
SUBSYSTEM_1:ALTITUDE > 400
AND
SUBSYSTEM_1:VELOCITY > 7500
```

Generated logic:
```
SUBSYSTEM_1:ALTITUDE > 400 AND SUBSYSTEM_1:VELOCITY > 7500
```

## Component APIs

### QueryBuilder.vue
```typescript
interface Props {
  modelValue: ConditionRule | null          // Current rule structure
  mnemonics: Array<{                         // Available mnemonics
    mnemonic: string
    type: string
    unit: string
  }>
  mode?: 'compact' | 'full'                  // Display mode
}

emits {
  'update:modelValue': (rule: ConditionRule) => void
  'generate': (logic: string) => void        // Emits generated logic
}
```

### Internal Rule Structure
```typescript
interface ConditionRule {
  id: string
  type: 'rule' | 'group'
  
  // For 'rule' type:
  mnemonic?: string           // e.g., "SUBSYSTEM_1:TEMPERATURE"
  condition?: string          // e.g., ">"
  value?: string              // e.g., "45"
  negate?: boolean            // NOT operator
  
  // For 'group' type:
  operator?: string           // 'AND' or 'OR'
  rules?: ConditionRule[]    // Nested rules
}
```

## Comparison with jQuery QueryBuilder

| Feature | jQuery QueryBuilder | Our Implementation |
|---------|-------------------|-------------------|
| Rule/Group nesting | ✅ | ✅ |
| Drag-and-drop | ✅ | ⏳ Future enhancement |
| Operators | Limited | Satellite domain-specific |
| Copy output | ✅ | ✅ |
| Validation | ✅ | ⏳ Backend validation ready |
| Themes | ✅ | PrimeVue themed |

## Backend Integration

### API Endpoints Used

1. **Get Subsystems**
   ```bash
   GET /gateway/api/go/v1/telemetry/subsystems
   Response: { "subsystems": ["SUBSYSTEM_1", "SUBSYSTEM_2", ...] }
   ```

2. **Get Mnemonics for Subsystem**
   ```bash
   GET /gateway/api/go/v1/mnemonics/tm/{subsystem}
   Response: [
     {
       "cdbMnemonic": "TEMPERATURE",
       "type": "ANALOG",
       "unit": "°C",
       "description": "Electronics Module Temperature",
       ...
     },
     ...
   ]
   ```

### How Mnemonics Are Displayed
- Full name: `SUBSYSTEM_1:TEMPERATURE`
- Type + Unit in tooltip: `ANALOG (°C)`
- Description in tooltip: `Electronics Module Temperature`

## Error Handling

- **API unavailable?** Falls back to empty mnemonic list with error message
- **Loading slow?** Shows spinner during API load
- **Invalid condition?** Visual builder prevents invalid operators
- **Parsing failed?** Returns placeholder text

## Performance

- **Mnemonic fetch**: Single async call on page load (parallelized per subsystem)
- **Rendering**: Recursive component handles deep nesting efficiently
- **Logic generation**: Sync O(n) walk through rule tree
- **Memory**: Rules stored in localStorage (localStorage.tm.systemStates.v1)

## Future Enhancements

- [ ] Drag-and-drop rule reordering
- [ ] Rule duplication
- [ ] Condition validation against sample telemetry data
- [ ] Advanced operators: `between`, `in`, `regex`
- [ ] Template library for common conditions
- [ ] Export as REST API query format
- [ ] Mobile-friendly compact mode

## Troubleshooting

**Q: Mnemonics not loading?**
A: Check:
- Backend API is running (`http://hostname/gateway/api/go/v1/telemetry/subsystems`)
- Browser console for CORS errors
- Network tab to see actual API responses

**Q: Logic looks wrong?**
A: Remember:
- AND has higher precedence than OR
- Groups are explicitly parenthesized
- Use NOT to negate individual rules

**Q: How to save and reload?**
A: States are persisted in localStorage automatically. Click "Save State" to persist all changes.

## Code Examples

### Accessing from other components
```typescript
import type { SystemState } from '@/pages/tm/system-states.vue'

const states = JSON.parse(localStorage.getItem('tm.systemStates.v1')) as SystemState[]
```

### Converting visual rule to logic string
```typescript
function ruleToLogic(rule: ConditionRule): string {
  if (rule.type === 'rule') {
    return `${rule.mnemonic} ${rule.condition} ${rule.value}`
  }
  if (rule.type === 'group' && rule.rules?.length) {
    const parts = rule.rules.map(ruleToLogic)
    return `(${parts.join(' ' + (rule.operator || 'AND') + ' ')})`
  }
  return ''
}
```

## Related Pages

- 📊 [UDTM Configuration](./SYSTEM_STATES_DESIGN.md)
- 🚀 [Backend Implementation Guide](./SYSTEM_STATES_IMPLEMENTATION.md)
- 📈 [Live TM Monitoring](/tm)
