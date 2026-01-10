import { Button } from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { Box, ChevronDown, ChevronRight, Info, Layers, X } from "lucide-react"
import { useMemo, useState } from "react"

// ============================================================================
// Types
// ============================================================================

interface ElementPropertiesPanelProps {
  element: Record<string, unknown> | null
  onClose: () => void
}

interface PropertySectionProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

interface PropertyRowProps {
  label: string
  value: unknown
  indent?: number
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") {
    // Format numbers nicely
    if (Number.isInteger(value)) return value.toString()
    return value.toFixed(4).replace(/\.?0+$/, "")
  }
  if (typeof value === "string") return value || "—"
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    // For coordinate arrays like RefLatitude
    if (value.every((v) => typeof v === "number")) {
      return value.join(", ")
    }
  }
  return JSON.stringify(value)
}

function extractMaterials(hasAssociations: unknown[]): { name: string; thickness?: number }[] {
  const materials: { name: string; thickness?: number }[] = []

  for (const assoc of hasAssociations) {
    if (typeof assoc !== "object" || assoc === null) continue
    const a = assoc as Record<string, unknown>

    // Direct materials list
    if (Array.isArray(a.Materials)) {
      for (const mat of a.Materials) {
        if (typeof mat === "object" && mat !== null && "Name" in mat) {
          materials.push({ name: (mat as { Name: string }).Name })
        }
      }
    }

    // Material layers (for walls, slabs, etc.)
    if (Array.isArray(a.ForLayerSet)) {
      for (const layerSet of a.ForLayerSet) {
        if (
          typeof layerSet === "object" &&
          layerSet !== null &&
          Array.isArray((layerSet as Record<string, unknown>).MaterialLayers)
        ) {
          const layers = (layerSet as Record<string, unknown>).MaterialLayers as unknown[]
          for (const layer of layers) {
            if (typeof layer === "object" && layer !== null) {
              const l = layer as Record<string, unknown>
              const thickness = l.LayerThickness as number | undefined
              if (Array.isArray(l.Material) && l.Material.length > 0) {
                const mat = l.Material[0] as Record<string, unknown>
                if (mat.Name) {
                  materials.push({
                    name: mat.Name as string,
                    thickness: thickness ? thickness * 100 : undefined, // Convert to cm
                  })
                }
              }
            }
          }
        }
      }
    }
  }

  return materials
}

function extractPropertySets(
  isDefinedBy: unknown[]
): { name: string; properties: { name: string; value: unknown }[] }[] {
  const psets: {
    name: string
    properties: { name: string; value: unknown }[]
  }[] = []

  for (const def of isDefinedBy) {
    if (typeof def !== "object" || def === null) continue
    const d = def as Record<string, unknown>

    if (d.Name && Array.isArray(d.HasProperties)) {
      const props: { name: string; value: unknown }[] = []
      for (const prop of d.HasProperties) {
        if (typeof prop === "object" && prop !== null) {
          const p = prop as Record<string, unknown>
          if (p.Name && p.NominalValue !== undefined) {
            props.push({
              name: p.Name as string,
              value: p.NominalValue,
            })
          }
        }
      }
      if (props.length > 0) {
        psets.push({
          name: d.Name as string,
          properties: props,
        })
      }
    }
  }

  return psets
}

function extractLocation(
  containedInStructure: unknown[]
): { level: string; building: string } | null {
  if (!Array.isArray(containedInStructure) || containedInStructure.length === 0) return null

  const structure = containedInStructure[0] as Record<string, unknown>
  if (!structure) return null

  const level = (structure.Name as string) || (structure.LongName as string)
  let building = ""

  // Try to get building info from Decomposes hierarchy
  const decomposes = structure.Decomposes
  if (Array.isArray(decomposes) && decomposes.length > 0) {
    const parent = decomposes[0] as Record<string, unknown> | undefined
    if (parent?.Name) {
      building = parent.Name as string
    }
  }

  return { level: level || "Unknown", building }
}

// ============================================================================
// Components
// ============================================================================

function PropertySection({ title, icon, children, defaultOpen = true }: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[#3c3c3c] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#2a2d2e] transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="size-4 text-[#858585]" />
        ) : (
          <ChevronRight className="size-4 text-[#858585]" />
        )}
        {icon}
        <span className="text-xs font-medium text-[#cccccc]">{title}</span>
      </button>
      {isOpen && <div className="px-3 pb-2">{children}</div>}
    </div>
  )
}

function PropertyRow({ label, value, indent = 0 }: PropertyRowProps) {
  const formattedValue = formatValue(value)
  if (formattedValue === "—") return null

  return (
    <div
      className={cn("flex justify-between items-start gap-3 py-1 text-xs", indent > 0 && "ml-3")}
    >
      <span className="text-[#858585] shrink-0">{label}</span>
      <span className="text-right font-mono text-[#9cdcfe] break-all">{formattedValue}</span>
    </div>
  )
}

function MaterialsList({ materials }: { materials: { name: string; thickness?: number }[] }) {
  if (materials.length === 0) return null

  return (
    <div className="space-y-0.5">
      {materials.map((mat) => (
        <div key={mat.name} className="flex justify-between items-center py-1 text-xs">
          <span className="text-[#858585]">{mat.name}</span>
          {mat.thickness && (
            <span className="font-mono text-[#9cdcfe]">{mat.thickness.toFixed(1)} cm</span>
          )}
        </div>
      ))}
    </div>
  )
}

function PropertySetsList({
  psets,
}: {
  psets: { name: string; properties: { name: string; value: unknown }[] }[]
}) {
  if (psets.length === 0) return null

  return (
    <div className="space-y-2">
      {psets.map((pset) => (
        <div key={pset.name}>
          <div className="text-[10px] font-medium text-[#4ec9b0] mb-1">
            {pset.name.replace("Pset_", "")}
          </div>
          <div className="space-y-0">
            {pset.properties.map((prop) => (
              <PropertyRow key={prop.name} label={prop.name} value={prop.value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ElementPropertiesPanel({ element, onClose }: ElementPropertiesPanelProps) {
  // Extract data from element
  const { materials, propertySets, location, basicInfo } = useMemo(() => {
    if (!element) {
      return {
        materials: [],
        propertySets: [],
        location: null,
        basicInfo: null,
      }
    }

    const hasAssociations = element.HasAssociations as unknown[] | undefined
    const isDefinedBy = element.IsDefinedBy as unknown[] | undefined
    const containedInStructure = element.ContainedInStructure as unknown[] | undefined

    return {
      materials: hasAssociations ? extractMaterials(hasAssociations) : [],
      propertySets: isDefinedBy ? extractPropertySets(isDefinedBy) : [],
      location: containedInStructure ? extractLocation(containedInStructure) : null,
      basicInfo: {
        name: element.Name as string,
        type: element.ObjectType as string,
        tag: element.Tag as string,
        predefinedType: element.PredefinedType as string | undefined,
      },
    }
  }, [element])

  if (!element) return null

  return (
    <div
      className={cn(
        "w-72 shrink-0",
        "bg-background border-l border-border",
        "flex flex-col overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 border-b border-border">
        <div className="min-w-0">
          <h2 className="font-medium text-sm text-[#cccccc] truncate">
            {basicInfo?.name?.split(":")[0] || "Element"}
          </h2>
          {basicInfo?.type && (
            <p className="text-xs text-[#858585] truncate mt-0.5">{basicInfo.type.split(":")[0]}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-[#858585] hover:text-[#cccccc] hover:bg-[#3c3c3c]"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Basic Info */}
        <PropertySection title="Information" icon={<Info className="size-4 text-[#858585]" />}>
          <div className="space-y-0.5">
            {basicInfo?.tag && <PropertyRow label="ID" value={basicInfo.tag} />}
            {basicInfo?.predefinedType && (
              <PropertyRow label="Type" value={basicInfo.predefinedType} />
            )}
            {location?.level && <PropertyRow label="Level" value={location.level} />}
          </div>
        </PropertySection>

        {/* Materials */}
        {materials.length > 0 && (
          <PropertySection title="Materials" icon={<Layers className="size-4 text-[#858585]" />}>
            <MaterialsList materials={materials} />
          </PropertySection>
        )}

        {/* Property Sets */}
        {propertySets.length > 0 && (
          <PropertySection
            title="Properties"
            icon={<Box className="size-4 text-[#858585]" />}
            defaultOpen={true}
          >
            <PropertySetsList psets={propertySets} />
          </PropertySection>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[10px] text-[#858585] text-center">Click elsewhere to deselect</p>
      </div>
    </div>
  )
}
