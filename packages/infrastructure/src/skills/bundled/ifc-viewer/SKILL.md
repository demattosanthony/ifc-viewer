---
name: ifc-viewer
description: Control the 3D IFC model viewer to load models, explore the building hierarchy, inspect element properties, navigate floor plans, and select/highlight elements. Use when users ask about the loaded model, building structure, element details, or want to visualize specific parts.
---

# IFC Viewer Skill

## Overview

The `executeViewer` tool runs JavaScript code in the browser's 3D viewer. Use it to explore BIM models, inspect elements, and help users understand their building data.

## When to Use This Skill

- User asks "what models are loaded?" or "show me the building structure"
- User wants to find specific elements (walls, doors, floors, etc.)
- User asks about element properties or materials
- User wants to navigate to a specific floor or area
- User asks to highlight or select elements

## API Reference

### Model Management

```javascript
// List models available in the project (not yet loaded)
const available = await viewer.getAvailableModels()
// → [{ id: "abc123", name: "Building.ifc", hasFragment: true }]

// List models currently loaded in the viewer
const loaded = viewer.getLoadedModels()
// → [{ id: "frag-xyz", name: "Building.ifc" }]

// Load a model by its project ID
await viewer.loadModel("abc123")
// → { loaded: "Building.ifc" }

// Unload a model by its viewer ID
await viewer.unloadModel("frag-xyz")

// Unload all models
await viewer.unloadAllModels()
```

### Hierarchy Navigation

The spatial hierarchy represents the IFC structure: Project → Site → Building → Storey → Elements.

```javascript
// Get the hierarchy (truncated to 15 children per node for large models)
const hierarchy = await viewer.getHierarchy()
// → [{
//   id: "model-123",
//   modelId: "frag-xyz",
//   name: "Building.ifc",
//   category: null,
//   localId: null,
//   children: [...],
//   totalChildren: 3
// }]

// If totalChildren > children.length, get the full list
const allChildren = await viewer.getChildren(modelId, localId)
```

**TreeNode Structure:**
| Field | Description |
|-------|-------------|
| `id` | Unique node identifier |
| `modelId` | Viewer model ID (use for API calls) |
| `name` | Element name or category label |
| `category` | IFC category (IFCSITE, IFCBUILDING, IFCWALL, etc.) |
| `localId` | IFC Express ID (use for selecting/getting details) |
| `children` | Child nodes (may be truncated) |
| `totalChildren` | Actual child count |

### Element Details

```javascript
// Get full details for an element
const details = await viewer.getElement(modelId, localId)
// → {
//   basicInfo: { name, type, tag, ifcType, predefinedType },
//   materials: [{ name, thickness }],
//   propertySets: [{ name, properties: [{ name, value }] }],
//   location: { level, building }
// }
```

### Selection

```javascript
// Select elements (highlights them in the viewer)
// Returns details for each selected element
const selected = await viewer.select(modelId, [localId1, localId2])
// → [{ elementId: 123, data: { basicInfo, materials, ... } }]

// Select and zoom to fit the elements in view
const selected = await viewer.select(modelId, [localId], { fitToView: true })

// Clear selection
viewer.clearSelection()
```

### Floor Plans

```javascript
// Get available floor plans
const plans = viewer.getPlans()
// → [{ id: "plan-1", name: "Level 1", elevation: 0, modelId: "frag-xyz" }]

// Open a floor plan (switches to 2D plan view)
viewer.openPlan("plan-1")

// Close plan view (return to 3D)
viewer.closePlan()

// Check which plan is active
const activePlan = viewer.getActivePlan()
// → "plan-1" or null
```

## Common Workflows

### Explore a Model

```javascript
// 1. Check what's loaded
const loaded = viewer.getLoadedModels()
if (loaded.length === 0) {
  // Load first available model
  const available = await viewer.getAvailableModels()
  if (available.length > 0) {
    await viewer.loadModel(available[0].id)
  }
}

// 2. Get the hierarchy
const hierarchy = await viewer.getHierarchy()
return hierarchy
```

### Find and Select Elements

```javascript
// Navigate to find a storey
const hierarchy = await viewer.getHierarchy()
const building = hierarchy[0]?.children[0]
const storey = building?.children?.find(c => c.name.includes("Level 1"))

if (storey?.localId) {
  // Select it, zoom to fit, and get details
  return await viewer.select(storey.modelId, [storey.localId], { fitToView: true })
}
```

### Get Element Properties

```javascript
// Get detailed properties for a specific element
const hierarchy = await viewer.getHierarchy()
const element = hierarchy[0]?.children[0]?.children[0]?.children[0]

if (element?.localId) {
  const details = await viewer.getElement(element.modelId, element.localId)
  return {
    name: details.basicInfo.name,
    type: details.basicInfo.ifcType,
    materials: details.materials,
    properties: details.propertySets
  }
}
```

### Navigate Floor Plans

```javascript
// List available floors and open one
const plans = viewer.getPlans()
const groundFloor = plans.find(p => p.name.includes("Ground") || p.elevation === 0)

if (groundFloor) {
  viewer.openPlan(groundFloor.id)
  return { opened: groundFloor.name }
}

return { plans: plans.map(p => p.name) }
```

## Tips

1. **Always check if models are loaded** before trying to access hierarchy or elements
2. **Use `totalChildren`** to know if the children array was truncated
3. **The `modelId` in hierarchy nodes** is what you use for API calls (not the project model ID)
4. **`localId` is the IFC Express ID** - use it for `getElement`, `select`, and `getChildren`
5. **Selection returns element details** - no need to call `getElement` separately after selecting
6. **Use `{ fitToView: true }` in select** to zoom the camera to focus on selected elements
7. **Floor plans change the camera** - opening a plan switches to 2D orthographic view
