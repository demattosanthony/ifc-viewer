import { Button } from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { Box, ChevronDown, ChevronRight, GripHorizontal, Info, Layers, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useDraggable } from "../hooks/use-draggable"
import {
  extractElementData,
  formatValue,
  type Material,
  type PropertySet,
} from "../utils/ifc-element"

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

function PropertySection({ title, icon, children, defaultOpen = true }: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        {icon}
        <span className="text-xs font-medium text-foreground">{title}</span>
      </button>
      {isOpen && <div className="px-3 pb-2">{children}</div>}
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: unknown }) {
  const formattedValue = formatValue(value)
  if (formattedValue === "—") return null

  return (
    <div className="flex justify-between items-start gap-3 py-1 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-mono text-foreground break-all">{formattedValue}</span>
    </div>
  )
}

function MaterialsList({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return null

  return (
    <div className="space-y-0.5">
      {materials.map((mat) => (
        <div key={mat.name} className="flex justify-between items-center py-1 text-xs">
          <span className="text-muted-foreground">{mat.name}</span>
          {mat.thickness && (
            <span className="font-mono text-foreground">{mat.thickness.toFixed(1)} cm</span>
          )}
        </div>
      ))}
    </div>
  )
}

function PropertySetsList({ psets }: { psets: PropertySet[] }) {
  if (psets.length === 0) return null

  return (
    <div className="space-y-2">
      {psets.map((pset) => (
        <div key={pset.name}>
          <div className="text-[10px] font-medium text-muted-foreground mb-1">
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

export function ElementPropertiesPanel({ element, onClose }: ElementPropertiesPanelProps) {
  const { position, isDragging, handleMouseDown, setPosition } = useDraggable({ x: 16, y: 16 })

  useEffect(() => {
    if (element) {
      setPosition({ x: 16, y: 16 })
    }
  }, [element, setPosition])

  const { materials, propertySets, location, basicInfo } = useMemo(
    () =>
      element
        ? extractElementData(element)
        : { materials: [], propertySets: [], location: null, basicInfo: null },
    [element]
  )

  if (!element) return null

  return (
    <div
      className={cn(
        "absolute z-50 w-72",
        "bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl",
        "flex flex-col overflow-hidden",
        isDragging && "cursor-grabbing select-none"
      )}
      style={{ left: position.x, top: position.y, maxHeight: "calc(100% - 32px)" }}
    >
      {/* Drag Handle Header */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b border-border",
          "cursor-grab active:cursor-grabbing bg-muted/50"
        )}
      >
        <GripHorizontal className="size-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-sm text-foreground truncate">
            {basicInfo?.name?.split(":")[0] || "Element"}
          </h2>
          {basicInfo?.type && (
            <p className="text-xs text-muted-foreground truncate">{basicInfo.type.split(":")[0]}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-h-[420px]">
        <PropertySection
          title="Information"
          icon={<Info className="size-4 text-muted-foreground" />}
        >
          <div className="space-y-0.5">
            {basicInfo?.tag && <PropertyRow label="ID" value={basicInfo.tag} />}
            {basicInfo?.predefinedType && (
              <PropertyRow label="Type" value={basicInfo.predefinedType} />
            )}
            {location?.level && <PropertyRow label="Level" value={location.level} />}
          </div>
        </PropertySection>

        {materials.length > 0 && (
          <PropertySection
            title="Materials"
            icon={<Layers className="size-4 text-muted-foreground" />}
          >
            <MaterialsList materials={materials} />
          </PropertySection>
        )}

        {propertySets.length > 0 && (
          <PropertySection
            title="Properties"
            icon={<Box className="size-4 text-muted-foreground" />}
          >
            <PropertySetsList psets={propertySets} />
          </PropertySection>
        )}
      </div>
    </div>
  )
}
