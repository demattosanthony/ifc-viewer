import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ifc-viewer/ui/components"
import { cn } from "@ifc-viewer/ui/lib"
import { Box, ChevronDown, ChevronRight, GripHorizontal, Info, Layers, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useDraggable } from "../hooks/use-draggable"
import type { SelectedElement } from "../hooks/use-element-selection"
import {
  extractElementData,
  formatValue,
  type Material,
  type PropertySet,
} from "../utils/ifc-element"

interface ElementPropertiesPanelProps {
  elements: SelectedElement[]
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
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        {icon}
        <span className="text-[11px] font-medium text-foreground">{title}</span>
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

/** Single element's properties content */
function ElementProperties({ element }: { element: Record<string, unknown> }) {
  const { materials, propertySets, location, basicInfo } = useMemo(
    () => extractElementData(element),
    [element]
  )

  return (
    <div className="divide-y divide-border/30">
      <PropertySection
        title="Information"
        icon={<Info className="size-3.5 text-muted-foreground" />}
      >
        <div className="space-y-0.5">
          {basicInfo?.ifcType && <PropertyRow label="IFC Type" value={basicInfo.ifcType} />}
          {basicInfo?.tag && <PropertyRow label="ID" value={basicInfo.tag} />}
          {basicInfo?.predefinedType && (
            <PropertyRow label="Predefined Type" value={basicInfo.predefinedType} />
          )}
          {location?.level && <PropertyRow label="Level" value={location.level} />}
        </div>
      </PropertySection>

      {materials.length > 0 && (
        <PropertySection
          title="Materials"
          icon={<Layers className="size-3.5 text-muted-foreground" />}
        >
          <MaterialsList materials={materials} />
        </PropertySection>
      )}

      {propertySets.length > 0 && (
        <PropertySection
          title="Properties"
          icon={<Box className="size-3.5 text-muted-foreground" />}
          defaultOpen={false}
        >
          <PropertySetsList psets={propertySets} />
        </PropertySection>
      )}
    </div>
  )
}

/** Collapsible element accordion item */
function ElementAccordionItem({
  element,
  index,
  defaultOpen,
}: {
  element: SelectedElement
  index: number
  defaultOpen: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const { basicInfo } = useMemo(() => extractElementData(element.data), [element.data])
  const displayName = basicInfo?.name?.split(":")[0] || `Element ${index + 1}`
  const displayType = basicInfo?.ifcType || basicInfo?.type?.split(":")[0]

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors border-b border-border">
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-foreground truncate block">{displayName}</span>
          {displayType && (
            <span className="text-[10px] text-muted-foreground truncate block">{displayType}</span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/20">
          <ElementProperties element={element.data} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ElementPropertiesPanel({ elements, onClose }: ElementPropertiesPanelProps) {
  const { position, isDragging, handleMouseDown, setPosition } = useDraggable({ x: 16, y: 16 })

  useEffect(() => {
    if (elements.length > 0) {
      setPosition({ x: 16, y: 16 })
    }
  }, [elements.length, setPosition])

  // For single element, extract info for the header
  const singleElementInfo = useMemo(() => {
    if (elements.length !== 1) return null
    const first = elements[0]
    if (!first) return null
    return extractElementData(first.data)
  }, [elements])

  if (elements.length === 0) return null

  const isSingleElement = elements.length === 1
  const firstElement = elements[0]

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
          {isSingleElement ? (
            <>
              <h2 className="font-medium text-sm text-foreground truncate">
                {singleElementInfo?.basicInfo?.name?.split(":")[0] || "Element"}
              </h2>
              {singleElementInfo?.basicInfo?.type && (
                <p className="text-xs text-muted-foreground truncate">
                  {singleElementInfo.basicInfo.type.split(":")[0]}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="font-medium text-sm text-foreground">
                {elements.length} Elements Selected
              </h2>
              <p className="text-xs text-muted-foreground">Click to expand properties</p>
            </>
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
        {isSingleElement && firstElement ? (
          <ElementProperties element={firstElement.data} />
        ) : (
          <div className="divide-y divide-border">
            {elements.map((element, index) => (
              <ElementAccordionItem
                key={`${element.modelId}-${element.localId}`}
                element={element}
                index={index}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
