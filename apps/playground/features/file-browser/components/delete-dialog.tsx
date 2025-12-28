import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

interface DeleteTarget {
  path: string;
  isDirectory: boolean;
}

interface DeleteDialogProps {
  target: DeleteTarget | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({ target, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="bg-[#252526] border-[#3c3c3c]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#cccccc]">
            Delete {target?.isDirectory ? "folder" : "file"}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#858585]">
            Are you sure you want to delete{" "}
            <span className="font-mono text-[#9cdcfe]">{target?.path}</span>?{" "}
            {target?.isDirectory && "This will delete all contents inside."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-[#3c3c3c] text-[#cccccc] border-[#3c3c3c] hover:bg-[#4c4c4c] hover:text-[#ffffff]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[#f14c4c] text-white hover:bg-[#d93d3d]"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
