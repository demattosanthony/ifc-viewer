import { Progress, toast } from "@ifc-viewer/ui/components"
import { useEffect, useRef } from "react"

interface UploadProgress {
  current: number
  total: number
}

interface UploadResult {
  success: number
  failed: number
}

/**
 * Hook to display toast notifications for file upload progress.
 * Shows a loading toast with progress bar during upload,
 * then success/error/warning toast on completion.
 */
export function useUploadToast(
  isUploading: boolean,
  progress: UploadProgress | null,
  result: UploadResult | null,
  onResultShown: () => void
) {
  const toastId = useRef<string | number | null>(null)

  // Handle upload progress
  useEffect(() => {
    if (isUploading && progress) {
      const percent = Math.round((progress.current / progress.total) * 100)
      const message =
        progress.total === 1
          ? "Uploading file..."
          : `Uploading ${progress.current} of ${progress.total} files...`

      if (toastId.current === null) {
        // Show new toast with progress
        toastId.current = toast.loading(message, {
          description: <Progress value={percent} className="h-1.5 mt-2" />,
        })
      } else {
        // Update existing toast
        toast.loading(message, {
          id: toastId.current,
          description: <Progress value={percent} className="h-1.5 mt-2" />,
        })
      }
    }
  }, [isUploading, progress])

  // Handle completion
  useEffect(() => {
    if (!isUploading && result && toastId.current !== null) {
      const pluralize = (count: number) => (count === 1 ? "file" : "files")

      if (result.failed === 0) {
        // All succeeded
        toast.success(`Uploaded ${result.success} ${pluralize(result.success)}`, {
          id: toastId.current,
        })
      } else if (result.success === 0) {
        // All failed
        toast.error(`Failed to upload ${result.failed} ${pluralize(result.failed)}`, {
          id: toastId.current,
        })
      } else {
        // Mixed results
        toast.warning(`Uploaded ${result.success}, failed ${result.failed}`, {
          id: toastId.current,
        })
      }

      toastId.current = null
      onResultShown()
    }
  }, [isUploading, result, onResultShown])
}
