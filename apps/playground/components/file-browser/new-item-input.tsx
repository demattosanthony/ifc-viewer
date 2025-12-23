import { Folder, File } from "lucide-react";

interface NewItemInputProps {
  type: "file" | "folder";
  depth: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function NewItemInput({
  type,
  depth,
  value,
  onChange,
  onSubmit,
  onCancel,
}: NewItemInputProps) {
  const indent = depth * 12;

  return (
    <div
      className="flex items-center h-[22px] bg-[#2a2d2e]"
      style={{ paddingLeft: indent + 4 }}
    >
      <span className="w-4 shrink-0" />
      {type === "folder" ? (
        <Folder className="w-4 h-4 text-[#dcb67a] shrink-0 ml-0.5" />
      ) : (
        <File className="w-4 h-4 text-[#858585] shrink-0 ml-0.5" />
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (value.trim()) {
            onSubmit();
          } else {
            onCancel();
          }
        }}
        autoFocus
        className="flex-1 ml-1.5 text-[13px] bg-[#3c3c3c] border border-[#007acc] outline-none px-1 text-[#cccccc] min-w-0"
        placeholder={type === "folder" ? "folder name" : "file name"}
      />
    </div>
  );
}
