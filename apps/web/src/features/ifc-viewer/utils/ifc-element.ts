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

interface IfcAttribute<T> {
  value: T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function unwrapIfcValue(value: unknown): unknown {
  if (isRecord(value) && "value" in value) {
    return unwrapIfcValue((value as IfcAttribute<unknown>).value)
  }
  return value
}

function getIfcString(value: unknown): string | undefined {
  const resolvedValue = unwrapIfcValue(value)
  return typeof resolvedValue === "string" && resolvedValue.length > 0 ? resolvedValue : undefined
}

function getIfcNumber(value: unknown): number | undefined {
  const resolvedValue = unwrapIfcValue(value)
  return typeof resolvedValue === "number" ? resolvedValue : undefined
}

export function formatValue(value: unknown): string {
  const resolvedValue = unwrapIfcValue(value)
  if (resolvedValue === null || resolvedValue === undefined) return "—"
  if (typeof resolvedValue === "boolean") return resolvedValue ? "Yes" : "No"
  if (typeof resolvedValue === "number") {
    if (Number.isInteger(resolvedValue)) return resolvedValue.toString()
    return resolvedValue.toFixed(4).replace(/\.?0+$/, "")
  }
  if (typeof resolvedValue === "string") return resolvedValue || "—"
  if (Array.isArray(resolvedValue)) {
    if (resolvedValue.length === 0) return "—"
    const normalizedValues = resolvedValue.map(unwrapIfcValue)
    if (normalizedValues.every((v) => typeof v === "number")) {
      return normalizedValues.join(", ")
    }
    if (normalizedValues.every((v) => typeof v === "string")) {
      return normalizedValues.filter((v) => v.length > 0).join(", ") || "—"
    }
    return JSON.stringify(normalizedValues)
  }
  return JSON.stringify(resolvedValue)
}

export function extractMaterials(hasAssociations: unknown[]): Material[] {
  const materials: Material[] = []

  for (const assoc of hasAssociations) {
    if (!isRecord(assoc)) continue

    const associationMaterials = assoc.Materials
    if (Array.isArray(associationMaterials)) {
      for (const mat of associationMaterials) {
        if (!isRecord(mat)) continue
        const name = getIfcString(mat.Name)
        if (name) {
          materials.push({ name })
        }
      }
    }

    const layerSets = assoc.ForLayerSet
    if (Array.isArray(layerSets)) {
      for (const layerSet of layerSets) {
        if (!isRecord(layerSet)) continue
        const layers = layerSet.MaterialLayers
        if (!Array.isArray(layers)) continue

        for (const layer of layers) {
          if (!isRecord(layer)) continue
          const thickness = getIfcNumber(layer.LayerThickness)
          const layerMaterials = layer.Material
          if (!Array.isArray(layerMaterials) || layerMaterials.length === 0) continue
          const mat = layerMaterials[0]
          if (!isRecord(mat)) continue
          const name = getIfcString(mat.Name)
          if (name) {
            materials.push({
              name,
              thickness: thickness !== undefined ? thickness * 100 : undefined,
            })
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
    if (!isRecord(def)) continue
    const name = getIfcString(def.Name)
    const properties = def.HasProperties
    if (!name || !Array.isArray(properties)) continue

    const props: { name: string; value: unknown }[] = []
    for (const prop of properties) {
      if (!isRecord(prop)) continue
      const propName = getIfcString(prop.Name)
      if (!propName) continue
      const value = unwrapIfcValue(prop.NominalValue)
      if (value === undefined) continue
      props.push({ name: propName, value })
    }

    if (props.length > 0) {
      psets.push({ name, properties: props })
    }
  }

  return psets
}

export function extractLocation(containedInStructure: unknown[]): ElementLocation | null {
  if (!Array.isArray(containedInStructure) || containedInStructure.length === 0) return null

  const structure = containedInStructure[0]
  if (!isRecord(structure)) return null

  const level = getIfcString(structure.Name) ?? getIfcString(structure.LongName)
  let building = ""

  const decomposes = structure.Decomposes
  if (Array.isArray(decomposes) && decomposes.length > 0) {
    const parent = decomposes[0]
    if (isRecord(parent)) {
      const parentName = getIfcString(parent.Name)
      if (parentName) {
        building = parentName
      }
    }
  }

  return { level: level || "Unknown", building }
}

export function extractElementData(element: Record<string, unknown>) {
  const hasAssociations = element.HasAssociations as unknown[] | undefined
  const isDefinedBy = element.IsDefinedBy as unknown[] | undefined
  const containedInStructure = element.ContainedInStructure as unknown[] | undefined

  const name = getIfcString(element.Name) ?? ""
  const type = getIfcString(element.ObjectType) ?? ""
  const tag = getIfcString(element.Tag) ?? ""
  const predefinedType = getIfcString(element.PredefinedType)

  return {
    materials: hasAssociations ? extractMaterials(hasAssociations) : [],
    propertySets: isDefinedBy ? extractPropertySets(isDefinedBy) : [],
    location: containedInStructure ? extractLocation(containedInStructure) : null,
    basicInfo: {
      name,
      type,
      tag,
      predefinedType,
    } as BasicInfo,
  }
}
