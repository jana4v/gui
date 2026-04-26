# System States - Implementation Guide

## Quick Start

### Frontend Only (Current Stage)
The basic UI is implemented and stores data in browser localStorage under key `tm.systemStates.v1`.

**To test**:
1. Navigate to TM → System States
2. Click "Create New State"
3. Define a state with name, description, and condition
4. Select mnemonics to monitor
5. Specify limits for each mnemonic
6. Save

## Frontend Features (Implemented)

### ✅ Completed
- [x] Main dashboard with state cards
- [x] Create/Edit/Delete states
- [x] State basic information (name, description)
- [x] Condition editor with two modes:
  - Visual Logic Builder (text-based, human-readable)
  - Monaco Editor mode (code-based, JavaScript expressions)
- [x] Mnemonic selection UI
- [x] Per-mnemonic limit and tolerance configuration
- [x] LocalStorage persistence
- [x] Success/error messaging
- [x] Responsive grid layout

### 📝 Code Structure

#### Main Component: `system-states.vue`
**Location**: `/GUI/app/pages/tm/system-states.vue`

**Key Functions**:
- `loadStates()` - Retrieve from localStorage
- `saveStates()` - Persist to localStorage
- `createNewState()` - New state template
- `editState(state)` - Load state into editor
- `saveState()` - Save edited state
- `openConditionEditor()` - Show condition dialog
- `saveMnemonicsSelection()` - Update mnemonic list

**Reactive State**:
```typescript
states: SystemState[]                    // All defined states
editingState: SystemState | null        // Currently being edited
showStateDialog: boolean                 // Main editor dialog
showConditionEditor: boolean             // Condition editor popup
showMnemonicsDialog: boolean             // Mnemonic selector dialog
message: { type, text }                 // User feedback
```

**Data Persistence**:
```typescript
localStorage.setItem('tm.systemStates.v1', JSON.stringify(states))
localStorage.getItem('tm.systemStates.v1')
```

## Backend Integration (Next Phase)

### Step 1: API Endpoints

Create backend API routes for state management:

#### Golang Backend Structure

**File**: `gateway/system_states.go` (new)

```go
package api

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
)

// SystemStateCondition represents the condition logic
type SystemStateCondition struct {
	Type  string `json:"type" bson:"type"` // "visual" or "monaco"
	Logic string `json:"logic" bson:"logic"`
}

// MnemonicMapping represents limits for a mnemonic in a specific state
type MnemonicMapping struct {
	Limits   []string `json:"limits" bson:"limits"`
	Tolerance string  `json:"tolerance,omitempty" bson:"tolerance,omitempty"`
	Active   bool     `json:"active" bson:"active"`
}

// SystemState represents a complete state configuration
type SystemState struct {
	ID          string                      `json:"id" bson:"_id"`
	Project     string                      `json:"project" bson:"project"`
	Name        string                      `json:"name" bson:"name"`
	Description string                      `json:"description" bson:"description"`
	Condition   SystemStateCondition        `json:"condition" bson:"condition"`
	Mnemonics   map[string]MnemonicMapping `json:"mnemonics" bson:"mnemonics"`
	CreatedAt   int64                       `json:"created_at" bson:"created_at"`
	UpdatedAt   int64                       `json:"updated_at" bson:"updated_at"`
	CreatedBy   string                      `json:"created_by" bson:"created_by"`
	UpdatedBy   string                      `json:"updated_by" bson:"updated_by"`
	Enabled     bool                        `json:"enabled" bson:"enabled"`
}

// CreateSystemState handles POST /system-states
func CreateSystemState(c *gin.Context) {
	var state SystemState
	if err := c.ShouldBindJSON(&state); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Validate required fields
	if state.Name == "" {
		c.JSON(400, gin.H{"error": "State name is required"})
		return
	}
	if state.Condition.Logic == "" {
		c.JSON(400, gin.H{"error": "Condition logic is required"})
		return
	}

	// Generate ID if not provided
	if state.ID == "" {
		state.ID = generateUUID()
	}

	// Set timestamps
	now := time.Now().UnixMilli()
	state.CreatedAt = now
	state.UpdatedAt = now

	// Save to MongoDB
	db := getMongoClient()
	collection := db.Database("satellites").Collection("system_states")

	_, err := collection.InsertOne(c.Request.Context(), state)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to save state"})
		return
	}

	c.JSON(201, state)
}

// GetSystemStates handles GET /system-states?project=...
func GetSystemStates(c *gin.Context) {
	project := c.Query("project")
	if project == "" {
		project = "default"
	}

	db := getMongoClient()
	collection := db.Database("satellites").Collection("system_states")

	cursor, err := collection.Find(c.Request.Context(), bson.M{
		"project": project,
	})
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch states"})
		return
	}

	var states []SystemState
	if err := cursor.All(c.Request.Context(), &states); err != nil {
		c.JSON(500, gin.H{"error": "Failed to parse states"})
		return
	}

	c.JSON(200, states)
}

// UpdateSystemState handles PUT /system-states/:id
func UpdateSystemState(c *gin.Context) {
	id := c.Param("id")

	var updates SystemState
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	updates.UpdatedAt = time.Now().UnixMilli()

	db := getMongoClient()
	collection := db.Database("satellites").Collection("system_states")

	result := collection.FindOneAndUpdate(
		c.Request.Context(),
		bson.M{"_id": id},
		bson.M{"$set": updates},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	)

	var updated SystemState
	if err := result.Decode(&updated); err != nil {
		c.JSON(404, gin.H{"error": "State not found"})
		return
	}

	c.JSON(200, updated)
}

// DeleteSystemState handles DELETE /system-states/:id
func DeleteSystemState(c *gin.Context) {
	id := c.Param("id")

	db := getMongoClient()
	collection := db.Database("satellites").Collection("system_states")

	result, err := collection.DeleteOne(c.Request.Context(), bson.M{"_id": id})
	if err != nil || result.DeletedCount == 0 {
		c.JSON(404, gin.H{"error": "State not found"})
		return
	}

	c.JSON(200, gin.H{"message": "State deleted"})
}

// ValidateCondition handles POST /system-states/validate-condition
func ValidateCondition(c *gin.Context) {
	var req struct {
		Condition string            `json:"condition"`
		Context   map[string]interface{} `json:"context"`
		Type      string            `json:"type"` // "visual" or "monaco"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Parse and validate condition
	valid, result, err := evaluateCondition(req.Type, req.Condition, req.Context)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"valid":  valid,
		"result": result,
	})
}
```

**File**: `gateway/condition_evaluator.go` (new)

```go
package api

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// evaluateCondition evaluates a condition against a context
func evaluateCondition(condType string, logic string, context map[string]interface{}) (bool, interface{}, error) {
	switch condType {
	case "visual":
		return evaluateVisualCondition(logic, context)
	case "monaco":
		return evaluateMonacoCondition(logic, context)
	default:
		return false, nil, fmt.Errorf("unknown condition type: %s", condType)
	}
}

// evaluateVisualCondition evaluates simple logical expressions
// Examples:
//   TEMP > 50 AND PRESSURE < 100
//   (ALTITUDE > 400 AND VELOCITY > 7500) OR (SAFE_MODE == TRUE)
func evaluateVisualCondition(logic string, context map[string]interface{}) (bool, interface{}, error) {
	// Implement a simple expression parser
	// For production, consider using expr library: https://github.com/antonmedv/expr

	// Simple implementation using regex
	// This is a basic version - production should use proper parser

	// Replace mnemonic names with context values
	expr := logic
	for key, val := range context {
		// Handle different value types
		strVal := fmt.Sprintf("%v", val)
		expr = strings.ReplaceAll(expr, key, strVal)
	}

	// For now, return a validation placeholder
	// Production implementation would use expr library or similar
	return true, "Condition validation not yet implemented in backend", nil
}

// evaluateMonacoCondition evaluates JavaScript-like expressions
// Would require a JavaScript runtime (e.g., goja or otto)
func evaluateMonacoCondition(logic string, context map[string]interface{}) (bool, interface{}, error) {
	// Requires embedding JavaScript runtime
	// Consider using: github.com/dop251/goja
	// Or: github.com/robertkrimen/otto

	return false, nil, fmt.Errorf("Monaco conditions require JavaScript runtime - TODO")
}
```

#### Register Routes

In your main router setup (`gateway/router.go`):

```go
// Add to your Gin router setup
publicAPI := router.Group("/api/go/v1")

// System States endpoints
publicAPI.POST("/system-states", CreateSystemState)
publicAPI.GET("/system-states", GetSystemStates)
publicAPI.PUT("/system-states/:id", UpdateSystemState)
publicAPI.DELETE("/system-states/:id", DeleteSystemState)
publicAPI.POST("/system-states/validate-condition", ValidateCondition)
```

### Step 2: Update Frontend to Use Backend

**File**: `GUI/app/pages/tm/system-states.vue`

Update the `loadStates()`, `saveStates()`, and related functions:

```typescript
const gatewayBase = import.meta.client
  ? `http://${window.location.hostname}/gateway/api/go/v1`
  : ''
const project = 'default' // Could come from URL params

async function loadStates() {
  try {
    const response = await fetch(`${gatewayBase}/system-states?project=${project}`)
    if (response.ok) {
      states.value = await response.json()
    } else {
      loadStatesLocal() // Fallback to localStorage
    }
  } catch (e) {
    console.warn('Backend unavailable, using localStorage')
    loadStatesLocal()
  }
}

function loadStatesLocal() {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      states.value = JSON.parse(stored)
    }
  } catch {
    states.value = []
  }
}

async function saveState() {
  if (!editingState.value) return

  // Validation...
  if (!editingState.value.name.trim()) {
    message.value = { type: 'error', text: 'State name is required' }
    return
  }

  try {
    const isNew = !states.value.some(s => s.id === editingState.value!.id)
    const method = isNew ? 'POST' : 'PUT'
    const endpoint = isNew ? '/system-states' : `/system-states/${editingState.value.id}`

    const response = await fetch(`${gatewayBase}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editingState.value,
        project,
        updated_by: 'current-user', // Get from auth context
      }),
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const saved = await response.json()

    if (isNew) {
      states.value.push(saved)
    } else {
      const idx = states.value.findIndex(s => s.id === saved.id)
      if (idx >= 0) {
        states.value[idx] = saved
      }
    }

    saveStatesLocal(states.value) // Cache locally too
    showStateDialog.value = false
    editingState.value = null
    message.value = { type: 'success', text: 'State saved successfully' }
  } catch (e: any) {
    message.value = { type: 'error', text: e.message || 'Failed to save state' }
  }
}

async function deleteState(id: string) {
  try {
    const response = await fetch(`${gatewayBase}/system-states/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete')
    }

    states.value = states.value.filter(s => s.id !== id)
    saveStatesLocal(states.value)
    message.value = { type: 'success', text: 'State deleted' }
  } catch (e: any) {
    message.value = { type: 'error', text: 'Failed to delete state' }
  }
}

async function validateCondition() {
  if (!editingState.value?.condition.logic) return

  try {
    const response = await fetch(`${gatewayBase}/system-states/validate-condition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition: editingState.value.condition.logic,
        type: editingState.value.condition.type,
        context: {
          // Sample telemetry values for validation
          ALTITUDE: 400,
          VELOCITY: 7500,
          TEMP_1: 50,
          PRESSURE_1: 100,
        },
      }),
    })

    const result = await response.json()
    message.value = {
      type: result.valid ? 'success' : 'error',
      text: `Condition validation: ${result.valid ? 'Valid' : 'Invalid'} - ${result.result}`,
    }
  } catch (e: any) {
    message.value = { type: 'error', text: 'Failed to validate condition' }
  }
}
```

## MongoDB Schema

### Create Collection Index

```javascript
db.system_states.createIndex({ project: 1, name: 1 }, { unique: true })
db.system_states.createIndex({ created_at: -1 })
db.system_states.createIndex({ project: 1, enabled: 1 })
```

## Monaco Editor Integration (Optional Enhancement)

If you want to add Monaco editor support similar to UDTM:

### Option 1: Use Existing Component
If UDTM's `MonacoDsl` component is generic enough:

```vue
<template>
  <Dialog v-model:visible="showConditionEditor" modal header="Edit Condition" style="width: 80vw">
    <div v-if="conditionType === 'monacoEditor'">
      <MonacoDsl v-model="conditionDraft" height="50vh" />
    </div>
    <!-- ... -->
  </Dialog>
</template>

<script setup>
import MonacoDsl from '@/components/tm/MonacoDsl.vue'
</script>
```

### Option 2: Create Specialized Component

**File**: `GUI/app/components/tm/SystemStateConditionEditor.vue`

```vue
<script setup lang="ts">
import { defineProps, defineEmits, ref } from 'vue'

interface Props {
  modelValue: string
  type: 'visualBuilder' | 'monacoEditor'
  mnemonics?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  mnemonics: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:type': [value: 'visualBuilder' | 'monacoEditor']
}>()

const code = ref(props.modelValue)
let monaco: any = null
let editor: any = null

onMounted(async () => {
  if (props.type === 'monacoEditor') {
    await loadMonaco()
  }
})

async function loadMonaco() {
  // Lazy load Monaco - typical pattern
  const { loader } = await import('@monaco-editor/loader')
  monaco = await loader.init()

  if (editor) {
    editor.dispose()
  }

  editor = monaco.editor.create(document.getElementById('monaco-container'), {
    value: code.value,
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    suggestions: true,
  })

  editor.onDidChangeModelContent(() => {
    code.value = editor.getValue()
    emit('update:modelValue', code.value)
  })

  // Would need to add autocomplete function here
}

function addMnemonicToCondition(mnemonic: string) {
  code.value += `telemetry.${mnemonic} `
  emit('update:modelValue', code.value)
  editor?.focus()
}
</script>

<template>
  <div class="condition-editor">
    <div v-if="type === 'monacoEditor'" id="monaco-container" style="height: 500px" />
    <div v-else>
      <Textarea
        :model-value="code"
        @input="(e: any) => emit('update:modelValue', e.target.value)"
        rows="10"
        class="w-full font-mono"
      />
    </div>

    <div v-if="mnemonics.length > 0" class="mt-3">
      <p class="text-xs font-semibold">Quick References:</p>
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="mnem in mnemonics"
          :key="mnem"
          :label="mnem"
          size="small"
          text
          @click="addMnemonicToCondition(mnem)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
#monaco-container {
  border: 1px solid var(--surface-border);
  border-radius: 4px;
}
</style>
```

## Testing Checklist

### Frontend Tests
- [ ] Create new state with minimal data
- [ ] Edit existing state
- [ ] Delete state
- [ ] Switch between Visual and Monaco editors
- [ ] Add/remove mnemonics
- [ ] Persist data after page reload
- [ ] Condition evaluation errors
- [ ] Responsive layout on mobile

### Backend Tests
- [ ] POST /system-states - create
- [ ] GET /system-states - list with project filter
- [ ] PUT /system-states/:id - update
- [ ] DELETE /system-states/:id - delete
- [ ] POST /system-states/validate-condition - validation
- [ ] MongoDB data persistence
- [ ] Concurrent updates
- [ ] Data validation (required fields)

### Integration Tests
- [ ] Frontend ↔ Backend data sync
- [ ] Fallback to localStorage when backend unavailable
- [ ] UDTM mnemonic integration
- [ ] State machine state detection

## Deployment Notes

### Frontend
- No additional dependencies required for current implementation
- Optional: Install Monaco editor library when adding monacoEditor support
  ```bash
  npm install @monaco-editor/loader
  ```

### Backend
- MongoDB must be running and accessible
- Ensure indices are created on `system_states` collection
- Add project indexing for multi-tenant support

### Environment Variables
```bash
MONGO_URL=mongodb://localhost:27017
MONGO_DB=satellites
SYSTEM_STATES_COLLECTION=system_states
```

## Troubleshooting

- **States not persisting?** Check localStorage quota and browser dev tools
- **Backend not responding?** Verify API endpoint and CORS settings
- **Conditions not evaluating?** Add console.log in condition evaluator
- **Monaco not loading?** Check browser console for CDN errors

## References

- Monaco Editor: https://github.com/microsoft/monaco-editor
- Expr language: https://github.com/antonmedv/expr
- Goja (Go JavaScript): https://github.com/dop251/goja
