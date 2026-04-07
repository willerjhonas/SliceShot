import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

type State = 'idle' | 'running' | 'done' | 'error'

interface ProgressData {
    status: string
    current?: number
    total?: number
    fileName?: string
    message?: string
    outputDir?: string
}

// Barra de título customizada (sem frame nativo)
function TitleBar() {
    return (
        <div
            className="flex h-9 items-center justify-between bg-background/80 px-4 select-none border-b"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-medium text-muted-foreground">SliceShot</span>
            </div>
            {isElectron && (
                <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <ThemeToggle />
                    <button
                        onClick={() => window.electronAPI.minimize()}
                        className="flex size-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Minimizar"
                    >
                        <svg width="10" height="1" viewBox="0 0 10 1"><path d="M0 0.5H10" stroke="currentColor" strokeWidth="1.5" /></svg>
                    </button>
                    <button
                        onClick={() => window.electronAPI.close()}
                        className="flex size-6 items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Fechar"
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </button>
                </div>
            )}
            {!isElectron && (
                <div className="flex items-center gap-1">
                    <ThemeToggle />
                </div>
            )}
        </div>
    )
}

export default function App() {
    const [inputFiles, setInputFiles] = useState<string[]>([])
    const [outputDir, setOutputDir] = useState<string>('')
    const [maxHeight, setMaxHeight] = useState<number>(4000)
    const [state, setState] = useState<State>('idle')
    const [progress, setProgress] = useState<ProgressData | null>(null)

    // Progresso do lote
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

    const [errorMsg, setErrorMsg] = useState<string>('')
    const [finalOutput, setFinalOutput] = useState<string>('')
    const dropRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Garante que o evento de progresso é registrado apenas uma vez
    useEffect(() => {
        if (!isElectron) return
        window.electronAPI.onProgress((data) => {
            setProgress(data)
            if (data.status === 'done' && data.outputDir) setFinalOutput(data.outputDir)
        })
        return () => window.electronAPI.removeProgressListeners()
    }, [])

    const handleBrowseFile = async () => {
        if (isElectron) {
            const files = await window.electronAPI.openFile()
            if (files && files.length > 0) {
                setInputFiles(prev => Array.from(new Set([...prev, ...files])))
            }
        } else {
            fileInputRef.current?.click()
        }
    }

    const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const newPaths = Array.from(files).map(f => (f as any).path ?? f.name)
        setInputFiles(prev => Array.from(new Set([...prev, ...newPaths])))
        e.target.value = ''
    }

    const removeFile = (pathToRemove: string) => {
        setInputFiles(prev => prev.filter(p => p !== pathToRemove))
    }

    const clearFiles = () => setInputFiles([])

    const handleBrowseOutput = async () => {
        if (isElectron) {
            const folder = await window.electronAPI.openFolder()
            if (folder) setOutputDir(folder)
        } else {
            // No browser: permite digitar manualmente o caminho
            const folder = prompt('Digite o caminho da pasta de saída (opcional):')
            if (folder) setOutputDir(folder)
        }
    }

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            const newPaths = Array.from(files).map(f => (f as any).path ?? f.name)
            setInputFiles(prev => Array.from(new Set([...prev, ...newPaths])))
        }
        dropRef.current?.classList.remove('ring-2', 'ring-primary')
    }, [])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        dropRef.current?.classList.add('ring-2', 'ring-primary')
    }

    const handleDragLeave = () => {
        dropRef.current?.classList.remove('ring-2', 'ring-primary')
    }

    const handleRun = async () => {
        if (inputFiles.length === 0) return

        if (!isElectron) {
            setState('error')
            setErrorMsg('O fatiamento real só funciona dentro do aplicativo nativo (Electron). No navegador, você pode apenas visualizar a interface.')
            return
        }

        setState('running')
        setBatchProgress({ current: 0, total: inputFiles.length })
        setProgress(null)
        setErrorMsg('')
        setFinalOutput('')

        let hasError = false

        for (let i = 0; i < inputFiles.length; i++) {
            const currentPath = inputFiles[i]
            const currentFileName = currentPath.split(/[\\/]/).pop() ?? currentPath
            const nameWithoutExt = currentFileName.replace(/\.[^.]+$/, '')

            setBatchProgress({ current: i + 1, total: inputFiles.length })
            setProgress({ status: 'start', message: `Iniciando ${currentFileName}...` })

            // Define pasta de saída: se o usuário escolheu uma, usa ela + subpasta. Caso contrário, pasta do arquivo + subpasta.
            const baseDir = outputDir || currentPath.replace(/[\\/][^\\/]+$/, '')
            const resolvedOutput = `${baseDir}\\${nameWithoutExt}`

            const result = await window.electronAPI.runSlicer({
                inputPath: currentPath,
                outputDir: resolvedOutput,
                maxHeight,
            })

            if (!result.success) {
                hasError = true
                setErrorMsg(`Erro em ${currentFileName}: ${result.error}`)
                break
            }

            if (i === 0) setFinalOutput(baseDir)
        }

        if (!hasError) setState('done')
        else setState('error')
    }

    const handleReset = () => {
        setState('idle')
        setProgress(null)
        setErrorMsg('')
    }

    const progressPercent =
        progress?.total && progress?.current
            ? Math.round((progress.current / progress.total) * 100)
            : 0

    return (
        <div className="flex h-screen flex-col bg-background text-foreground font-sans">
            <TitleBar />
            {/* Input nativo oculto para fallback no browser */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                className="hidden"
                onChange={handleNativeFileChange}
            />

            <main className="flex flex-1 items-center justify-center p-6 overflow-auto">
                <div className="w-full max-w-lg space-y-4">

                    {/* Header */}
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold tracking-tight">SliceShot</h1>
                        <p className="text-sm text-muted-foreground">
                            Corte screenshots longos em fatias otimizadas para o Figma
                        </p>
                    </div>

                    <Separator />

                    {!isElectron && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex gap-2 items-start">
                            <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-amber-500">Modo de Visualização</p>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Este aplicativo deve ser aberto via <code className="bg-muted px-1 rounded text-primary">npm run dev</code> para funcionar. No navegador, o fatiamento não está disponível por questões de segurança.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Drop zone / arquivos */}
                    <Card>
                        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                            <div className="space-y-1">
                                <CardTitle className="text-sm font-medium">Arquivos de entrada</CardTitle>
                                <CardDescription className="text-xs">Solte múltiplas imagens ou PDFs</CardDescription>
                            </div>
                            {inputFiles.length > 0 && state === 'idle' && (
                                <Button variant="ghost" size="sm" onClick={clearFiles} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-muted-foreground hover:text-destructive">✕</span>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div
                                ref={dropRef}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className="relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 transition-all cursor-pointer hover:bg-muted/50"
                                onClick={handleBrowseFile}
                                role="button"
                            >
                                <div className="flex flex-col items-center gap-1 text-muted-foreground p-4">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-px">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="text-xs">Arraste ou clique para adicionar arquivos</span>
                                </div>
                            </div>

                            {inputFiles.length > 0 && (
                                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {inputFiles.map((path) => {
                                        const name = path.split(/[\\/]/).pop() ?? path
                                        const ext = name.split('.').pop()?.toLowerCase()
                                        return (
                                            <div key={path} className="flex items-center justify-between gap-3 bg-muted/40 p-2 rounded-md border group">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase">{ext}</Badge>
                                                    <span className="text-xs font-medium truncate">{name}</span>
                                                </div>
                                                {state === 'idle' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeFile(path); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Configurações */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Configurações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="output-dir" className="text-xs text-muted-foreground">Pasta de saída</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="output-dir"
                                        placeholder="Mesma pasta do arquivo (padrão)"
                                        value={outputDir}
                                        readOnly
                                        className="text-xs h-8"
                                    />
                                    <Button variant="outline" size="sm" onClick={handleBrowseOutput} className="shrink-0 h-8">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Altura máxima por fatia</Label>
                                    <Badge variant="outline" className="font-mono text-xs">{maxHeight.toLocaleString('pt-BR')} px</Badge>
                                </div>
                                <Slider
                                    min={1000}
                                    max={10000}
                                    step={500}
                                    value={[maxHeight]}
                                    onValueChange={([v]) => setMaxHeight(v)}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>1.000 px</span>
                                    <span>10.000 px</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Progresso */}
                    {state === 'running' && (
                        <Card className="border-primary/20 bg-primary/5">
                            <CardContent className="pt-4 pb-4 space-y-4">
                                {/* Progresso Geral */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-primary/70">
                                        <span>Progresso Geral</span>
                                        <span>{batchProgress.current} / {batchProgress.total} arquivos</span>
                                    </div>
                                    <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1 bg-primary/10" />
                                </div>

                                <Separator className="opacity-50" />

                                {/* Progresso do Arquivo Atual */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground truncate max-w-[70%] font-medium">
                                            {progress?.message ?? 'Processando...'}
                                        </span>
                                        {progress?.total && progress?.current && (
                                            <Badge variant="secondary" className="font-mono text-[10px] h-5">
                                                Fatia {progress.current} de {progress.total}
                                            </Badge>
                                        )}
                                    </div>
                                    <Progress value={progressPercent} className="h-1.5" />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Resultado */}
                    {state === 'done' && (
                        <Card className="border-green-500/30 bg-green-500/5">
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-green-500 text-base">✓</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">Concluído!</p>
                                            <p className="text-xs text-muted-foreground truncate">{finalOutput || outputDir}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {finalOutput && (
                                            <Button variant="outline" size="sm" onClick={() => window.electronAPI.openInExplorer(finalOutput)}>
                                                Abrir pasta
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={handleReset}>Novo</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Erro */}
                    {state === 'error' && (
                        <Card className="border-destructive/30 bg-destructive/5">
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <span className="text-destructive text-base mt-0.5">⚠</span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-destructive">Erro ao processar</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={handleReset} className="shrink-0">Tentar novamente</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Botão principal */}
                    {state === 'idle' && (
                        <Button
                            className="w-full"
                            disabled={inputFiles.length === 0}
                            onClick={handleRun}
                        >
                            Fatiar em Lote ({inputFiles.length})
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-1"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </Button>
                    )}

                    {state === 'running' && (
                        <Button className="w-full" disabled>
                            <svg className="animate-spin mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                            Processando...
                        </Button>
                    )}
                </div>
            </main>
        </div>
    )
}
