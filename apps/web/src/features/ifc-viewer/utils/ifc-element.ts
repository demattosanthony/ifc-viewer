/**
 * Utilities for extracting and formatting IFC element data
 */

export interface Material {
  name: string
  thickness?: number
}

export interface PropertySet {
  name: string
  properties: { name: string; value: unknown }[]
}

export interface ElementLocation {
  level: string
  building: string
}

export interface BasicInfo {
  name: string
  type: string
  tag: string
  predefinedType?: string
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toString()
    return value.toFixed(4).replace(/\.?0+$/, "")
  }
  if (typeof value === "string") return value || "—"
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    if (value.every((v) => typeof v === "number")) {
      return value.join(", ")
    }
  }
  return JSON.stringify(value)
}

export function extractMaterials(hasAssociations: unknown[]): Material[] {
  const materials: Material[] = []

  for (const assoc of hasAssociations) {
    if (typeof assoc !== "object" || assoc === null) continue
    const a = assoc as Record<string, unknown>

    if (Array.isArray(a.Materials)) {
      for (const mat of a.Materials) {
        if (typeof mat === "object" && mat !== null && "Name" in mat) {
          materials.push({ name: (mat as { Name: string }).Name })
        }
      }
    }

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
                    thickness: thickness ? thickness * 100 : undefined,
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

export function extractPropertySets(isDefinedBy: unknown[]): PropertySet[] {
  const psets: PropertySet[] = []

  for (const def of isDefinedBy) {
    if (typeof def !== "object" || def === null) continue
    const d = def as Record<string, unknown>

    if (d.Name && Array.isArray(d.HasProperties)) {
      const props: { name: string; value: unknown }[] = []
      for (const prop of d.HasProperties) {
        if (typeof prop === "object" && prop !== null) {
          const p = prop as Record<string, unknown>
          if (p.Name && p.NominalValue !== undefined) {
            props.push({ name: p.Name as string, value: p.NominalValue })
          }
        }
      }
      if (props.length > 0) {
        psets.push({ name: d.Name as string, properties: props })
      }
    }
  }

  return psets
}

export function extractLocation(containedInStructure: unknown[]): ElementLocation | null {
  if (!Array.isArray(containedInStructure) || containedInStructure.length === 0) return null

  const structure = containedInStructure[0] as Record<string, unknown>
  if (!structure) return null

  const level = (structure.Name as string) || (structure.LongName as string)
  let building = ""

  const decomposes = structure.Decomposes
  if (Array.isArray(decomposes) && decomposes.length > 0) {
    const parent = decomposes[0] as Record<string, unknown> | undefined
    if (parent?.Name) {
      building = parent.Name as string
    }
  }

  return { level: level || "Unknown", building }
}

export function extractElementData(element: Record<string, unknown>) {
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
    } as BasicInfo,
  }
}
