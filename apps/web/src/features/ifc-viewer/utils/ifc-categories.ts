// IFC category word list for parsing category names
const IFC_CATEGORY_WORDS = [
  "BUILDING",
  "STOREY",
  "WALL",
  "STANDARD",
  "CASE",
  "CURTAIN",
  "FURNISHING",
  "ELEMENT",
  "DISTRIBUTION",
  "FLOW",
  "SYSTEM",
  "EQUIPMENT",
  "TERMINAL",
  "DEVICE",
  "OPENING",
  "COVERING",
  "SHADING",
  "STRUCTURAL",
  "CONNECTION",
  "STAIR",
  "FLIGHT",
  "RAMP",
  "SLAB",
  "COLUMN",
  "BEAM",
  "ROOF",
  "PLATE",
  "MEMBER",
  "FOOTING",
  "PILE",
  "GRID",
  "AXIS",
  "ZONE",
  "GROUP",
  "PORT",
  "CONTROL",
]

const IFC_CATEGORY_WORDS_BY_LENGTH = [...IFC_CATEGORY_WORDS].sort((a, b) => b.length - a.length)

function toTitleCase(value: string): string {
  if (!value) return value
  if (/\d/.test(value)) return value
  if (value === value.toUpperCase()) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function splitAllCapsCategory(value: string): string[] {
  const words: string[] = []
  let remaining = value

  while (remaining.length > 0) {
    const match = IFC_CATEGORY_WORDS_BY_LENGTH.find((word) => remaining.startsWith(word))
    if (!match) {
      words.push(remaining)
      break
    }
    words.push(match)
    remaining = remaining.slice(match.length)
  }

  return words
}

/** Convert IFC category name to human-readable label */
export function getCategoryLabel(category: string | null): string {
  if (!category) return "Element"

  const cleaned = category.replace(/^IFC/i, "").replace(/[_-]+/g, " ").trim()
  if (!cleaned) return "Element"

  const words: string[] = []
  for (const part of cleaned.split(/\s+/)) {
    if (!part) continue
    if (/[a-z]/.test(part)) {
      words.push(...part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" "))
      continue
    }
    words.push(...splitAllCapsCategory(part))
  }

  return words.map(toTitleCase).join(" ")
}
