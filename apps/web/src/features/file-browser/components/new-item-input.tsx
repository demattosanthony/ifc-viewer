import { FileIcon } from "@/shared/components/file-icons/file-icon"

interface NewItemInputProps {
  type: "file" | "folder"
  depth: number
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function NewItemInput({
  type,
  depth,
  value,
  onChange,
  onSubmit,
  onCancel,
}: NewItemInputProps) {
  const indent = depth * 12

  return (
    <div className="flex items-center h-[22px] bg-accent/50" style={{ paddingLeft: indent + 4 }}>
      <span className="w-4 shrink-0" />
      <FileIcon
        node={{
          path: value || (type === "folder" ? "folder" : "file"),
          type: type === "folder" ? "directory" : "file",
        }}
        className="ml-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit()
          if (e.key === "Escape") onCancel()
        }}
        onBlur={() => {
          if (value.trim()) {
            onSubmit()
          } else {
            onCancel()
          }
        }}
        autoFocus
        className="flex-1 ml-1.5 text-[13px] bg-input border border-primary outline-none px-1 text-foreground min-w-0"
        placeholder={type === "folder" ? "folder name" : "file name"}
      />
    </div>
  )
}
