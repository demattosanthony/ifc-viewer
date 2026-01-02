import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  Trash2,
} from "lucide-react";
import type { ListFilesResponse } from "@ifc-viewer/sdk";
import { FileIcon } from "../utils/file-icons";

type FileEntry = ListFilesResponse["files"][number];

interface FileTreeItemProps {
  file: FileEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onClick: () => void;
  onNewFile: (path: string) => void;
  onNewFolder: (path: string) => void;
  onDelete: (path: string, isDirectory: boolean) => void;
  children?: React.ReactNode;
}

export function FileTreeItem({
  file,
  depth,
  isExpanded,
  isLoading,
  onToggle,
  onClick,
  onNewFile,
  onNewFolder,
  onDelete,
  children,
}: FileTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isDir = file.type === "directory";
  const indent = depth * 12;

  const handleClick = () => {
    if (isDir) {
      onToggle();
    } else {
      onClick();
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center h-[22px] hover:bg-accent/50 text-foreground cursor-pointer group"
        style={{ paddingLeft: indent + 4 }}
      >
        {isDir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0 ml-0.5" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0 ml-0.5" />
            )}
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            <span className="ml-0.5">
              <FileIcon filename={file.name} className="w-4 h-4" />
            </span>
          </>
        )}
        <span className="truncate select-none ml-1.5 text-[13px] flex-1">
          {file.name}
        </span>

        {/* Hover actions */}
        {isHovered && (
          <div className="flex items-center gap-0.5 pr-1">
            {isDir && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewFile(file.path);
                  }}
                  className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                  title="New File"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewFolder(file.path);
                  }}
                  className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                  title="New Folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.path, isDir);
              }}
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Children (expanded directory contents) */}
      {isDir &&
        isExpanded &&
        (isLoading ? (
          <div
            className="h-[22px] flex items-center text-muted-foreground text-[13px]"
            style={{ paddingLeft: indent + 32 }}
          >
            loading...
          </div>
        ) : (
          children
        ))}
    </div>
  );
}
