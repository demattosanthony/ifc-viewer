import type { SVGProps } from "react"
import { useMemo } from "react"
import sprite from "./sprite.svg"
import type { IconName } from "./types"

export interface FileIconProps extends SVGProps<SVGSVGElement> {
  node: { path: string; type: "file" | "directory" }
  expanded?: boolean
}

export function FileIcon({ node, expanded = false, className, ...rest }: FileIconProps) {
  const name = useMemo(
    () => chooseIconName(node.path, node.type, expanded),
    [node.path, node.type, expanded]
  )

  return (
    <svg data-component="file-icon" className={className} {...rest}>
      <use href={`${sprite}#${name}`} />
    </svg>
  )
}

type IconMaps = {
  fileNames: Record<string, IconName>
  fileExtensions: Record<string, IconName>
  folderNames: Record<string, IconName>
  defaults: {
    file: IconName
    folder: IconName
    folderOpen: IconName
  }
}

const ICON_MAPS: IconMaps = {
  fileNames: {
    // Documentation files
    "readme.md": "Readme",
    "changelog.md": "Changelog",
    "contributing.md": "Contributing",
    license: "Certificate",

    // Node.js files
    "package.json": "Nodejs",
    "package-lock.json": "Nodejs",
    "yarn.lock": "Yarn",
    "pnpm-lock.yaml": "Pnpm",
    "bun.lock": "Bun",
    "bun.lockb": "Bun",
    "bunfig.toml": "Bun",

    // Docker files
    dockerfile: "Docker",
    "docker-compose.yml": "Docker",
    "docker-compose.yaml": "Docker",
    ".dockerignore": "Docker",

    // Config files
    "jest.config.js": "Jest",
    "jest.config.ts": "Jest",
    "vitest.config.js": "Vitest",
    "vitest.config.ts": "Vitest",
    "tailwind.config.js": "Tailwindcss",
    "tailwind.config.ts": "Tailwindcss",
    "turbo.json": "Turborepo",
    "tsconfig.json": "Tsconfig",
    "jsconfig.json": "Jsconfig",
    ".eslintrc": "Eslint",
    ".eslintrc.js": "Eslint",
    ".eslintrc.json": "Eslint",
    ".prettierrc": "Prettier",
    "vite.config.js": "Vite",
    "vite.config.ts": "Vite",
    ".gitignore": "Git",
    ".gitattributes": "Git",
    makefile: "Makefile",
    "cargo.toml": "Rust",
    "go.mod": "GoMod",
    "requirements.txt": "Python",
    "pyproject.toml": "Python",
    ".env": "Tune",
    ".env.local": "Tune",
    ".env.example": "Tune",
    ".editorconfig": "Editorconfig",
    "biome.json": "Biome",
  },
  fileExtensions: {
    // Test files
    "spec.ts": "TestTs",
    "test.ts": "TestTs",
    "spec.tsx": "TestJsx",
    "test.tsx": "TestJsx",
    "spec.js": "TestJs",
    "test.js": "TestJs",

    // JavaScript/TypeScript
    "d.ts": "TypescriptDef",
    ts: "Typescript",
    tsx: "React_ts",
    js: "Javascript",
    jsx: "React",
    mjs: "Javascript",
    cjs: "Javascript",

    // Web languages
    html: "Html",
    htm: "Html",
    css: "Css",
    scss: "Sass",
    sass: "Sass",

    // Data formats
    json: "Json",
    xml: "Xml",
    yml: "Yaml",
    yaml: "Yaml",
    toml: "Toml",

    // Documentation
    md: "Markdown",
    mdx: "Mdx",

    // Programming languages
    py: "Python",
    rs: "Rust",
    go: "Go",
    java: "Java",
    rb: "Ruby",
    php: "Php",
    c: "C",
    cpp: "Cpp",
    h: "H",
    hpp: "Hpp",
    swift: "Swift",

    // Shell scripts
    sh: "Console",
    bash: "Console",
    zsh: "Console",

    // Media files
    svg: "Svg",
    png: "Image",
    jpg: "Image",
    jpeg: "Image",
    gif: "Image",
    webp: "Image",
    pdf: "Pdf",

    // IFC files (custom for this project)
    ifc: "3d",

    // Other
    sql: "Database",
    log: "Log",
    lock: "Lock",
    graphql: "Graphql",
    dockerfile: "Docker",
  },
  folderNames: {
    src: "FolderSrc",
    source: "FolderSrc",
    lib: "FolderLib",
    libs: "FolderLib",
    test: "FolderTest",
    tests: "FolderTest",
    __tests__: "FolderTest",
    node_modules: "FolderNode",
    vendor: "FolderPackages",
    packages: "FolderPackages",
    build: "FolderBuildkite",
    dist: "FolderDist",
    out: "FolderDist",
    config: "FolderConfig",
    configs: "FolderConfig",
    docker: "FolderDocker",
    docs: "FolderDocs",
    public: "FolderPublic",
    static: "FolderPublic",
    assets: "FolderImages",
    images: "FolderImages",
    icons: "FolderImages",
    fonts: "FolderFont",
    styles: "FolderCss",
    css: "FolderCss",
    scripts: "FolderScripts",
    utils: "FolderUtils",
    helpers: "FolderHelper",
    components: "FolderComponents",
    views: "FolderViews",
    layouts: "FolderLayout",
    hooks: "FolderHook",
    store: "FolderStore",
    services: "FolderApi",
    api: "FolderApi",
    routes: "FolderRoutes",
    middleware: "FolderMiddleware",
    controllers: "FolderController",
    models: "FolderDatabase",
    schemas: "FolderDatabase",
    migrations: "FolderDatabase",
    types: "FolderTypescript",
    interfaces: "FolderInterface",
    ".github": "FolderGithub",
    ".vscode": "FolderVscode",
    ".cursor": "FolderCursor",
    i18n: "FolderI18n",
    locales: "FolderI18n",
    features: "FolderComponents",
    containers: "FolderDocker",
    tooling: "FolderTools",
    apps: "FolderApp",
    server: "FolderServer",
    web: "FolderPublic",
    core: "FolderCore",
    infrastructure: "FolderDatabase",
    interface: "FolderInterface",
  },
  defaults: {
    file: "Document",
    folder: "Folder",
    folderOpen: "FolderOpen",
  },
}

const toOpenVariant = (icon: IconName): IconName => {
  if (!icon.startsWith("Folder")) return icon
  if (icon.endsWith("_light")) return icon.replace("_light", "Open_light") as IconName
  if (!icon.endsWith("Open")) return `${icon}Open` as IconName
  return icon
}

const basenameOf = (p: string) =>
  p
    .replace(/[/\\]+$/, "")
    .split(/[\\/]/)
    .pop() ?? ""

const folderNameVariants = (name: string) => {
  const n = name.toLowerCase()
  return [n, `.${n}`, `_${n}`, `__${n}__`]
}

const dottedSuffixesDesc = (name: string) => {
  const n = name.toLowerCase()
  const idxs: number[] = []
  for (let i = 0; i < n.length; i++) if (n[i] === ".") idxs.push(i)
  const out = new Set<string>()
  out.add(n)
  for (const i of idxs) if (i + 1 < n.length) out.add(n.slice(i + 1))
  return Array.from(out).sort((a, b) => b.length - a.length)
}

export function chooseIconName(
  path: string,
  type: "directory" | "file",
  expanded: boolean
): IconName {
  const base = basenameOf(path)
  const baseLower = base.toLowerCase()

  if (type === "directory") {
    for (const cand of folderNameVariants(baseLower)) {
      const icon = ICON_MAPS.folderNames[cand]
      if (icon) return expanded ? toOpenVariant(icon) : icon
    }
    return expanded ? ICON_MAPS.defaults.folderOpen : ICON_MAPS.defaults.folder
  }

  const byName = ICON_MAPS.fileNames[baseLower]
  if (byName) return byName

  for (const ext of dottedSuffixesDesc(baseLower)) {
    const icon = ICON_MAPS.fileExtensions[ext]
    if (icon) return icon
  }

  return ICON_MAPS.defaults.file
}
