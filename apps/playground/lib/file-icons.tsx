import { FileCode, FileJson, FileText, FileBox, File } from "lucide-react";

export const FILE_EXTENSION_COLORS: Record<string, string> = {
  py: "#3572A5",
  js: "#f7df1e",
  jsx: "#f7df1e",
  ts: "#3178c6",
  tsx: "#3178c6",
  json: "#cbcb41",
  md: "#519aba",
  ifc: "#6b9f78",
  html: "#e34c26",
  htm: "#e34c26",
  css: "#563d7c",
  scss: "#563d7c",
};

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function getFileColor(filename: string): string {
  const ext = getFileExtension(filename);
  return FILE_EXTENSION_COLORS[ext] || "#858585";
}

interface FileIconProps {
  filename: string;
  className?: string;
}

export function FileIcon({ filename, className = "w-4 h-4" }: FileIconProps) {
  const ext = getFileExtension(filename);
  const color = FILE_EXTENSION_COLORS[ext] || "#858585";

  switch (ext) {
    case "py":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "html":
    case "htm":
    case "css":
    case "scss":
      return <FileCode className={className} style={{ color }} />;
    case "json":
      return <FileJson className={className} style={{ color }} />;
    case "md":
      return <FileText className={className} style={{ color }} />;
    case "ifc":
      return <FileBox className={className} style={{ color }} />;
    default:
      return <File className={className} style={{ color }} />;
  }
}
