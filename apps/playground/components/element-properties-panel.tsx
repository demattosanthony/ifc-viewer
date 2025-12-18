"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronRight, ChevronDown, Layers, Box, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface MousePosition {
  clientX: number;
  clientY: number;
}

interface ElementPropertiesPanelProps {
  element: Record<string, unknown> | null;
  position?: MousePosition;
  onClose: () => void;
}

interface PropertySectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

interface PropertyRowProps {
  label: string;
  value: unknown;
  indent?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Format numbers nicely
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(4).replace(/\.?0+$/, "");
  }
  if (typeof value === "string") return value || "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    // For coordinate arrays like RefLatitude
    if (value.every((v) => typeof v === "number")) {
      return value.join(", ");
    }
  }
  return JSON.stringify(value);
}

function extractMaterials(
  hasAssociations: unknown[]
): { name: string; thickness?: number }[] {
  const materials: { name: string; thickness?: number }[] = [];

  for (const assoc of hasAssociations) {
    if (typeof assoc !== "object" || assoc === null) continue;
    const a = assoc as Record<string, unknown>;

    // Direct materials list
    if (Array.isArray(a.Materials)) {
      for (const mat of a.Materials) {
        if (typeof mat === "object" && mat !== null && "Name" in mat) {
          materials.push({ name: (mat as { Name: string }).Name });
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
          const layers = (layerSet as Record<string, unknown>)
            .MaterialLayers as unknown[];
          for (const layer of layers) {
            if (typeof layer === "object" && layer !== null) {
              const l = layer as Record<string, unknown>;
              const thickness = l.LayerThickness as number | undefined;
              if (Array.isArray(l.Material) && l.Material.length > 0) {
                const mat = l.Material[0] as Record<string, unknown>;
                if (mat.Name) {
                  materials.push({
                    name: mat.Name as string,
                    thickness: thickness ? thickness * 100 : undefined, // Convert to cm
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return materials;
}

function extractPropertySets(
  isDefinedBy: unknown[]
): { name: string; properties: { name: string; value: unknown }[] }[] {
  const psets: {
    name: string;
    properties: { name: string; value: unknown }[];
  }[] = [];

  for (const def of isDefinedBy) {
    if (typeof def !== "object" || def === null) continue;
    const d = def as Record<string, unknown>;

    if (d.Name && Array.isArray(d.HasProperties)) {
      const props: { name: string; value: unknown }[] = [];
      for (const prop of d.HasProperties) {
        if (typeof prop === "object" && prop !== null) {
          const p = prop as Record<string, unknown>;
          if (p.Name && p.NominalValue !== undefined) {
            props.push({
              name: p.Name as string,
              value: p.NominalValue,
            });
          }
        }
      }
      if (props.length > 0) {
        psets.push({
          name: d.Name as string,
          properties: props,
        });
      }
    }
  }

  return psets;
}

function extractLocation(
  containedInStructure: unknown[]
): { level: string; building: string } | null {
  if (!Array.isArray(containedInStructure) || containedInStructure.length === 0)
    return null;

  const structure = containedInStructure[0] as Record<string, unknown>;
  if (!structure) return null;

  const level = (structure.Name as string) || (structure.LongName as string);
  let building = "";

  // Try to get building info from Decomposes hierarchy
  const decomposes = structure.Decomposes;
  if (Array.isArray(decomposes) && decomposes.length > 0) {
    const parent = decomposes[0] as Record<string, unknown> | undefined;
    if (parent?.Name) {
      building = parent.Name as string;
    }
  }

  return { level: level || "Unknown", building };
}

// ============================================================================
// Components
// ============================================================================

function PropertySection({
  title,
  icon,
  children,
  defaultOpen = true,
}: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </button>
      {isOpen && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function PropertyRow({ label, value, indent = 0 }: PropertyRowProps) {
  const formattedValue = formatValue(value);
  if (formattedValue === "—") return null;

  return (
    <div
      className={cn(
        "flex justify-between items-start gap-4 py-1.5 text-sm",
        indent > 0 && "ml-4"
      )}
    >
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-mono text-xs break-all">
        {formattedValue}
      </span>
    </div>
  );
}

function MaterialsList({
  materials,
}: {
  materials: { name: string; thickness?: number }[];
}) {
  if (materials.length === 0) return null;

  return (
    <div className="space-y-1">
      {materials.map((mat, i) => (
        <div
          key={i}
          className="flex justify-between items-center py-1.5 text-sm"
        >
          <span className="text-muted-foreground">{mat.name}</span>
          {mat.thickness && (
            <span className="font-mono text-xs">
              {mat.thickness.toFixed(1)} cm
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function PropertySetsList({
  psets,
}: {
  psets: { name: string; properties: { name: string; value: unknown }[] }[];
}) {
  if (psets.length === 0) return null;

  return (
    <div className="space-y-3">
      {psets.map((pset, i) => (
        <div key={i}>
          <div className="text-xs font-medium text-muted-foreground mb-1">
            {pset.name.replace("Pset_", "")}
          </div>
          <div className="space-y-0.5">
            {pset.properties.map((prop, j) => (
              <PropertyRow key={j} label={prop.name} value={prop.value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ElementPropertiesPanel({
  element,
  onClose,
}: ElementPropertiesPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate in when element changes
  useEffect(() => {
    if (element) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [element]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Extract data from element
  const { materials, propertySets, location, basicInfo } = useMemo(() => {
    if (!element) {
      return {
        materials: [],
        propertySets: [],
        location: null,
        basicInfo: null,
      };
    }

    const hasAssociations = element.HasAssociations as unknown[] | undefined;
    const isDefinedBy = element.IsDefinedBy as unknown[] | undefined;
    const containedInStructure = element.ContainedInStructure as
      | unknown[]
      | undefined;

    return {
      materials: hasAssociations ? extractMaterials(hasAssociations) : [],
      propertySets: isDefinedBy ? extractPropertySets(isDefinedBy) : [],
      location: containedInStructure
        ? extractLocation(containedInStructure)
        : null,
      basicInfo: {
        name: element.Name as string,
        type: element.ObjectType as string,
        tag: element.Tag as string,
        predefinedType: element.PredefinedType as string | undefined,
      },
    };
  }, [element]);

  if (!element) return null;

  return (
    <div
      className={cn(
        "fixed top-4 right-4 bottom-4 w-80 z-50",
        "bg-background/95 backdrop-blur-xl",
        "border border-border/50 rounded-xl shadow-2xl",
        "flex flex-col overflow-hidden",
        "transition-all duration-200 ease-out",
        isVisible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-4 pointer-events-none"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 border-b border-border/50">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm truncate">
            {basicInfo?.name?.split(":")[0] || "Element"}
          </h2>
          {basicInfo?.type && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {basicInfo.type.split(":")[0]}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={handleClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Basic Info */}
        <PropertySection
          title="Information"
          icon={<Info className="size-4 text-muted-foreground" />}
        >
          <div className="space-y-0.5">
            {basicInfo?.tag && <PropertyRow label="ID" value={basicInfo.tag} />}
            {basicInfo?.predefinedType && (
              <PropertyRow label="Type" value={basicInfo.predefinedType} />
            )}
            {location?.level && (
              <PropertyRow label="Level" value={location.level} />
            )}
          </div>
        </PropertySection>

        {/* Materials */}
        {materials.length > 0 && (
          <PropertySection
            title="Materials"
            icon={<Layers className="size-4 text-muted-foreground" />}
          >
            <MaterialsList materials={materials} />
          </PropertySection>
        )}

        {/* Property Sets */}
        {propertySets.length > 0 && (
          <PropertySection
            title="Properties"
            icon={<Box className="size-4 text-muted-foreground" />}
            defaultOpen={true}
          >
            <PropertySetsList psets={propertySets} />
          </PropertySection>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
        <p className="text-[10px] text-muted-foreground text-center">
          Click elsewhere to deselect
        </p>
      </div>
    </div>
  );
}
