# Skills vs Agents Strategy Analysis

## Research: What Anthropic Said About "Skills, Not Agents"

The core insight from Anthropic's agent design discussions (particularly from their engineering teams and published guidance) is a paradigm shift in how to build AI-powered systems:

### The Traditional "Agent-First" Approach (Problems)

- Build a monolithic agent with broad capabilities
- Agent reasons about how to solve any problem from scratch
- Focus on making the agent "smarter" through prompting
- Results in: unpredictable behavior, hard to debug, unreliable outcomes

### The "Skills-First" Approach (Recommended)

Instead of asking "How do I build a smart agent?", ask:
**"What specific capabilities (skills) do my users need, and how can I make each one excellent?"**

Key principles:

1. **Skills are atomic, tested, reliable operations**
   - Each skill does ONE thing well
   - Skills have clear inputs and outputs
   - Skills are deterministic where possible
   - Skills handle their own error cases gracefully

2. **Skills are domain-specific, not generic**
   - Instead of `executePython` → `extractWallSchedule`, `calculateAreas`, `validateIFC`
   - Instead of `executeCommand` → `installDependencies`, `runAnalysis`, `exportReport`
   - The skill name tells you exactly what it does

3. **The AI orchestrates skills, doesn't invent solutions**
   - AI picks which skills to use based on user intent
   - AI fills in parameters for skills
   - AI chains skills together logically
   - AI explains what it's doing and why

4. **Skills are composable and testable**
   - You can unit test each skill independently
   - Skills can be composed into workflows
   - Reliability compounds (5 reliable skills = reliable workflow)

### Why This Matters

> "When you have a general-purpose agent with tools like 'execute python' and 'run shell command', you're essentially asking the model to be an expert programmer every single time. But if you build a skill called 'extract_door_schedule', you've encoded that expertise once, tested it, and now the model just needs to know WHEN to use it, not HOW to implement it."

---

## Analysis: Your Current Codebase

### What You're Building

A **BIM IDE** with:
- IFC file viewing (Three.js + web-ifc)
- AI agent integration for BIM workflows
- Sandboxed compute environment (Docker with ifcopenshell, Python, Node.js)
- Clean architecture (core, infrastructure, interface layers)

### Current Agent Architecture

Your agent currently has **three generic tools**:

```
readFile     → Read any file
writeFile    → Write any file  
executeCommand → Run any shell command
executePython  → Run any Python code
```

This is the **"agent-first"** approach:
- Tools are maximally generic
- Agent must figure out HOW to accomplish tasks
- Agent must write IFC-specific Python code each time
- Reliability depends on the model's coding ability

### What's Working Well

1. **Clean Architecture** - Great separation of concerns
2. **Ports & Adapters** - Easy to swap implementations
3. **Compute Environment** - Well-equipped Docker container
4. **Streaming Infrastructure** - Solid real-time event system
5. **Change Tracking** - Smart file sync mechanism

### The Gap

Your IFC viewer frontend has sophisticated domain knowledge (element properties, materials, property sets, spatial hierarchy), but your AI agent has NONE of this. It's starting from zero every time.

---

## Strategic Recommendations

### Phase 1: Identify High-Value BIM Skills

Before writing code, identify what your users actually need. Survey these categories:

**Data Extraction Skills**
- `extractElementSchedule(type: "IfcWall" | "IfcDoor" | ...)` → Returns structured data
- `getMaterialTakeoff(elements: string[])` → Material quantities
- `getSpatialBreakdown()` → Building → Storey → Space hierarchy
- `getElementProperties(guid: string)` → All psets for an element

**Analysis Skills**
- `validateModel()` → Run standard IFC validation checks
- `findClashes(types: string[])` → Basic clash detection
- `calculateAreas(scope: "building" | "floor" | "space")` → Area calculations
- `checkCompleteness()` → Missing properties, incomplete data

**Export Skills**
- `exportSchedule(type: string, format: "xlsx" | "csv")` → Create spreadsheet
- `exportReport(template: string)` → Generate PDF report
- `exportElements(filter: ElementFilter)` → Export subset to new IFC

**Query Skills**
- `findElements(query: NaturalLanguageQuery)` → "All exterior doors on level 2"
- `compareModels(model1, model2)` → Diff two IFC versions
- `searchByProperty(pset: string, property: string, value: any)` → Find matching

### Phase 2: Implement Skills as Deterministic Functions

Each skill should be a well-tested Python function or TypeScript service:

```typescript
// packages/core/src/skills/element-schedule.skill.ts
export interface ElementScheduleInput {
  modelPath: string
  elementType: "IfcWall" | "IfcDoor" | "IfcWindow" | "IfcSlab" | "IfcBeam"
  properties?: string[]  // Optional: specific properties to include
}

export interface ElementScheduleOutput {
  elements: Array<{
    guid: string
    name: string
    type: string
    level: string
    properties: Record<string, unknown>
  }>
  summary: {
    totalCount: number
    byLevel: Record<string, number>
    byType: Record<string, number>
  }
}

export async function extractElementSchedule(
  ctx: Context,
  input: ElementScheduleInput
): Promise<ElementScheduleOutput> {
  // Deterministic, tested implementation
  // NOT "ask the AI to write Python code"
}
```

### Phase 3: Register Skills as AI Tools

```typescript
// packages/infrastructure/src/ai/tools/bim-skills.ts
export function createBIMSkills(options: BIMSkillsOptions) {
  return {
    extractElementSchedule: tool({
      description: `Extract a schedule of building elements from an IFC model.
Use this to get door schedules, wall schedules, window schedules, etc.
Returns structured data with element properties and a summary.`,
      inputSchema: ElementScheduleInputSchema,
      execute: async (input) => {
        return await extractElementSchedule(ctx, input)
      }
    }),
    
    calculateAreas: tool({
      description: `Calculate area measurements from an IFC model.
Can calculate gross floor area, net floor area, or area by space/room.`,
      inputSchema: CalculateAreasInputSchema,
      execute: async (input) => {
        return await calculateAreas(ctx, input)
      }
    }),
    
    // ... more domain-specific skills
  }
}
```

### Phase 4: Keep Generic Tools for Edge Cases

Don't remove `executePython` entirely - keep it for:
- Edge cases the skills don't cover
- User requests that need custom code
- Exploratory analysis

But make it clear in the system prompt:
```
## Tools

### Domain Skills (Preferred)
Use these for common BIM tasks - they're fast, reliable, and well-tested:
- extractElementSchedule: Get door/wall/window schedules
- calculateAreas: Calculate floor areas
- validateModel: Check for common IFC issues
- exportReport: Generate PDF/Excel reports

### General Tools (Fallback)
For tasks not covered by domain skills:
- executePython: Write custom Python (has ifcopenshell)
- executeCommand: Run shell commands
- readFile/writeFile: File operations
```

### Phase 5: Build Skill Discovery

Help the AI know which skills to use:

```typescript
// System prompt addition
const SKILL_REGISTRY = `
Available BIM Skills:

| Task | Skill | Example Input |
|------|-------|---------------|
| Get all doors | extractElementSchedule | {type: "IfcDoor"} |
| Get floor areas | calculateAreas | {scope: "building"} |
| Export to Excel | exportSchedule | {type: "IfcWall", format: "xlsx"} |
| Find elements | searchElements | {query: "exterior walls"} |
| Validate model | validateModel | {checks: ["geometry", "properties"]} |
`
```

---

## Value Proposition

### Before (Agent-First)

```
User: "Give me a door schedule"
Agent: Let me write Python code to:
  1. Open the IFC file
  2. Get all IfcDoor elements  
  3. Extract properties...
  [writes 30 lines of Python]
  [runs Python]
  [formats output]
Result: Works ~80% of the time, takes 15-30 seconds
```

### After (Skills-First)

```
User: "Give me a door schedule"
Agent: I'll use extractElementSchedule for this.
  [calls extractElementSchedule({type: "IfcDoor"})]
Result: Works ~99% of the time, takes 2-3 seconds
```

### Business Impact

1. **Reliability**: Skills are tested, agents aren't
2. **Speed**: No code generation/execution overhead
3. **Cost**: Fewer tokens (no writing code, just parameters)
4. **UX**: Predictable, consistent behavior
5. **Debugging**: When skills fail, you can fix them once
6. **Expertise Capture**: Domain knowledge lives in skills, not prompts

---

## Recommended Priorities

### Immediate (High Impact, Low Effort)

1. Create `extractElementSchedule` skill - most common BIM task
2. Create `calculateAreas` skill - second most common
3. Create `exportToExcel` skill - users always want spreadsheets

### Short Term

4. Add `validateModel` for IFC quality checks
5. Add `searchElements` for natural language queries
6. Add `getSpatialHierarchy` for building structure

### Medium Term

7. Build a "skill builder" that can generate new skills from examples
8. Add multi-model skills (compare, merge, federate)
9. Add visualization skills (generate diagrams, highlight elements)

---

## Summary

**Your codebase has excellent infrastructure** - clean architecture, compute sandboxing, streaming events. The missing piece is **domain-specific skills**.

The path to maximum value:

1. **Don't build a smarter agent** - build better skills
2. **Encode BIM expertise into skills** - once, tested, reliable
3. **Let the AI orchestrate** - picking skills and filling parameters
4. **Keep generic tools as fallback** - for edge cases

This is the "Skills vs Agents" philosophy: your competitive advantage isn't having Claude - everyone has Claude. Your advantage is having **BIM skills that work reliably every time**.
