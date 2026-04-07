export interface SlicerProgress {
    status: string
    message: string
    current?: number
    total?: number
    fileName?: string
    outputDir?: string
}

export interface SlicerResult {
    success: boolean
    error?: string
}

export interface ElectronAPI {
    minimize: () => void
    close: () => void
    openFile: () => Promise<string[] | null>
    openFolder: () => Promise<string | null>
    runSlicer: (args: { inputPath: string; outputDir: string; maxHeight: number }) => Promise<SlicerResult>
    onProgress: (callback: (data: SlicerProgress) => void) => () => void
    removeProgressListeners: () => void
    openInExplorer: (path: string) => void
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
