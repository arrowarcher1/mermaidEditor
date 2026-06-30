import {
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import CodeMirror from "@uiw/react-codemirror"
import { oneDark } from "@codemirror/theme-one-dark"
import {
  BadgeCheck,
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  FileCode2,
  FileDown,
  FileText,
  Files,
  Focus,
  Frame,
  Maximize2,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast, Toaster } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { diagramPresets, diagramTypes } from "@/lib/diagram-presets"
import {
  type PreviewTheme,
  defaultDarkTheme,
  defaultLightTheme,
  getPreviewTheme,
  isPreviewTheme,
  previewThemes,
} from "@/lib/preview-themes"
import "./App.css"

const STORAGE_KEY = "mermaid-studio:v1"
const SHARE_PARAM = "diagram"
const PREVIEW_PARAM = "preview"
const SHARE_PAYLOAD_VERSION = 1
const SAVE_DELAY_MS = 250
const RENDER_DELAY_MS = 260
const MIN_ZOOM = 40
const MAX_ZOOM = 500
const editorExtensions: never[] = []
let mermaidLoader: Promise<typeof import("mermaid")["default"]> | null = null

type RenderStatus = "rendering" | "valid" | "error"
type InterfaceTheme = "light" | "dark"

type LocalDiagram = {
  id: string
  title: string
  source: string
  presetId: string
  updatedAt: number
}

type PersistedState = {
  documents: LocalDiagram[]
  activeDocumentId: string
  interfaceTheme: InterfaceTheme
  diagramTheme: string
  autoRender: boolean
}

type SharePayload = {
  v: typeof SHARE_PAYLOAD_VERSION
  title: string
  source: string
  diagramTheme: string
}

type SharedDiagram = {
  title: string
  source: string
  diagramTheme: string
  previewOnly: boolean
}

type InitialAppState = PersistedState & {
  previewOnly: boolean
}

const lightThemes = previewThemes.filter((theme) => !theme.dark)
const darkThemes = previewThemes.filter((theme) => theme.dark)
const themeItems = previewThemes.map((theme) => ({
  label: theme.label,
  value: theme.value,
}))

const initialPreset = diagramPresets[0]

function createDiagramDocument(
  title: string,
  source: string,
  presetId = "custom"
): LocalDiagram {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `diagram-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    source,
    presetId,
    updatedAt: Date.now(),
  }
}

function createInitialDocument() {
  return createDiagramDocument(
    initialPreset.title,
    initialPreset.code,
    initialPreset.id
  )
}

function normalizeDocumentTitle(value: string) {
  const trimmed = value.trim()
  return trimmed || "Untitled diagram"
}

function isLocalDiagram(value: unknown): value is LocalDiagram {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<LocalDiagram>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.source === "string"
  )
}

function loadPersistedState(): PersistedState {
  const fallbackDocument = createInitialDocument()
  const fallback = {
    documents: [fallbackDocument],
    activeDocumentId: fallbackDocument.id,
    interfaceTheme: "light" as InterfaceTheme,
    diagramTheme: defaultLightTheme,
    autoRender: true,
  }

  if (typeof window === "undefined") {
    return fallback
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return fallback
    }

    const parsed = JSON.parse(stored) as Partial<PersistedState> & {
      source?: string
    }
    const parsedDocuments = Array.isArray(parsed.documents)
      ? parsed.documents.filter(isLocalDiagram).map((document) => ({
          ...document,
          presetId:
            typeof document.presetId === "string"
              ? document.presetId
              : "custom",
          updatedAt:
            typeof document.updatedAt === "number"
              ? document.updatedAt
              : Date.now(),
        }))
      : []

    const legacyDocument =
      parsedDocuments.length === 0 && typeof parsed.source === "string"
        ? [
            createDiagramDocument(
              initialPreset.title,
              parsed.source || initialPreset.code,
              parsed.source === initialPreset.code ? initialPreset.id : "custom"
            ),
          ]
        : []
    const documents =
      parsedDocuments.length > 0 ? parsedDocuments : legacyDocument
    const activeDocumentId = documents.some(
      (document) => document.id === parsed.activeDocumentId
    )
      ? parsed.activeDocumentId
      : documents[0]?.id

    return {
      documents: documents.length > 0 ? documents : fallback.documents,
      activeDocumentId: activeDocumentId || fallback.activeDocumentId,
      interfaceTheme: parsed.interfaceTheme === "dark" ? "dark" : "light",
      diagramTheme: isPreviewTheme(parsed.diagramTheme)
        ? parsed.diagramTheme
        : defaultLightTheme,
      autoRender: parsed.autoRender ?? true,
    }
  } catch {
    return fallback
  }
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  )
  return new TextDecoder().decode(bytes)
}

function getLocationShareParams() {
  if (typeof window === "undefined") {
    return null
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const searchParams = new URLSearchParams(window.location.search)
  const encoded = hashParams.get(SHARE_PARAM) ?? searchParams.get(SHARE_PARAM)

  if (!encoded) {
    return null
  }

  return {
    encoded,
    previewOnly:
      hashParams.get(PREVIEW_PARAM) === "1" ||
      searchParams.get(PREVIEW_PARAM) === "1",
  }
}

function loadSharedDiagram(): SharedDiagram | null {
  const params = getLocationShareParams()

  if (!params) {
    return null
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(params.encoded)) as Partial<
      SharePayload
    >

    if (
      parsed.v !== SHARE_PAYLOAD_VERSION ||
      typeof parsed.source !== "string"
    ) {
      return null
    }

    return {
      title: normalizeDocumentTitle(
        typeof parsed.title === "string" ? parsed.title : "Shared diagram"
      ),
      source: parsed.source,
      diagramTheme: isPreviewTheme(parsed.diagramTheme)
        ? parsed.diagramTheme
        : defaultLightTheme,
      previewOnly: params.previewOnly,
    }
  } catch {
    return null
  }
}

function createSharePayload(
  title: string,
  source: string,
  diagramTheme: string
): SharePayload {
  return {
    v: SHARE_PAYLOAD_VERSION,
    title: normalizeDocumentTitle(title),
    source,
    diagramTheme: isPreviewTheme(diagramTheme) ? diagramTheme : defaultLightTheme,
  }
}

function createShareUrl(payload: SharePayload, previewOnly: boolean) {
  const url = new URL(window.location.href)
  const params = new URLSearchParams()

  if (previewOnly) {
    params.set(PREVIEW_PARAM, "1")
  }

  params.set(SHARE_PARAM, encodeBase64Url(JSON.stringify(payload)))
  url.search = ""
  url.hash = params.toString()
  return url.toString()
}

function loadInitialAppState(): InitialAppState {
  const sharedDiagram = loadSharedDiagram()

  if (sharedDiagram) {
    const document = createDiagramDocument(
      sharedDiagram.title,
      sharedDiagram.source
    )
    const previewTheme = getPreviewTheme(sharedDiagram.diagramTheme)

    return {
      documents: [document],
      activeDocumentId: document.id,
      interfaceTheme: previewTheme.dark ? "dark" : "light",
      diagramTheme: sharedDiagram.diagramTheme,
      autoRender: true,
      previewOnly: sharedDiagram.previewOnly,
    }
  }

  return {
    ...loadPersistedState(),
    previewOnly: false,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function loadMermaid() {
  mermaidLoader ??= import("mermaid").then((module) => module.default)
  return mermaidLoader
}

function extractSvgDimensions(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
  const svgNode = doc.querySelector("svg")
  const viewBox = svgNode?.getAttribute("viewBox")

  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { width: Math.max(parts[2], 1), height: Math.max(parts[3], 1) }
    }
  }

  const width = Number.parseFloat(svgNode?.getAttribute("width") || "1200")
  const height = Number.parseFloat(svgNode?.getAttribute("height") || "800")
  return {
    width: Number.isFinite(width) ? width : 1200,
    height: Number.isFinite(height) ? height : 800,
  }
}

function App() {
  const initialState = useMemo(loadInitialAppState, [])
  const [documents, setDocuments] = useState(initialState.documents)
  const [activeDocumentId, setActiveDocumentId] = useState(
    initialState.activeDocumentId
  )
  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ??
    documents[0]
  const source = activeDocument?.source ?? ""
  const [renderSource, setRenderSource] = useState(source)
  const [interfaceTheme, setInterfaceTheme] = useState<InterfaceTheme>(
    initialState.interfaceTheme
  )
  const [diagramTheme, setDiagramTheme] = useState<string>(
    initialState.diagramTheme
  )
  const [autoRender, setAutoRender] = useState(initialState.autoRender)
  const [isPreviewOnly, setIsPreviewOnly] = useState(initialState.previewOnly)
  const [shareFallback, setShareFallback] = useState<{
    title: string
    url: string
  } | null>(null)
  const [query, setQuery] = useState("")
  const [selectedType, setSelectedType] = useState("All")
  const [activeTab, setActiveTab] = useState("files")
  const [zoom, setZoom] = useState([100])
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [examplesCollapsed, setExamplesCollapsed] = useState(false)
  const [sourceCollapsed, setSourceCollapsed] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [svg, setSvg] = useState("")
  const [status, setStatus] = useState<{
    state: RenderStatus
    message: string
    renderedAt?: Date
  }>({ state: "rendering", message: "Preparing preview" })
  const renderJobRef = useRef(0)
  const deferredRenderSource = useDeferredValue(renderSource)
  const isDarkInterface = interfaceTheme === "dark"
  const previewTheme = getPreviewTheme(diagramTheme)
  const selectedPreset = diagramPresets.find(
    (preset) => preset.id === activeDocument?.presetId
  )

  const filteredPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return diagramPresets.filter((preset) => {
      const matchesType = selectedType === "All" || preset.type === selectedType
      const haystack = `${preset.title} ${preset.type} ${preset.description}`
        .toLowerCase()
        .trim()
      return matchesType && haystack.includes(normalizedQuery)
    })
  }, [query, selectedType])

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return documents
    }

    return documents.filter((document) => {
      const type =
        diagramPresets.find((preset) => preset.id === document.presetId)
          ?.type || "Custom"
      return `${document.title} ${type} ${document.source}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [documents, query])

  const stats = useMemo(() => {
    const lines = source.length === 0 ? 0 : source.split(/\r\n|\r|\n/).length
    return {
      lines,
      characters: source.length,
      words: source.trim() ? source.trim().split(/\s+/).length : 0,
    }
  }, [source])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkInterface)
  }, [isDarkInterface])

  useEffect(() => {
    function loadSharedHash() {
      const sharedDiagram = loadSharedDiagram()

      if (!sharedDiagram) {
        return
      }

      const document = createDiagramDocument(
        sharedDiagram.title,
        sharedDiagram.source
      )
      const sharedTheme = getPreviewTheme(sharedDiagram.diagramTheme)

      setDocuments([document])
      setActiveDocumentId(document.id)
      setRenderSource(document.source)
      setInterfaceTheme(sharedTheme.dark ? "dark" : "light")
      setDiagramTheme(sharedDiagram.diagramTheme)
      setAutoRender(true)
      setIsPreviewOnly(sharedDiagram.previewOnly)
      setZoom([100])
      setPan({ x: 0, y: 0 })
    }

    window.addEventListener("hashchange", loadSharedHash)
    window.addEventListener("popstate", loadSharedHash)

    return () => {
      window.removeEventListener("hashchange", loadSharedHash)
      window.removeEventListener("popstate", loadSharedHash)
    }
  }, [])

  useEffect(() => {
    if (isPreviewOnly) {
      return
    }

    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          documents,
          activeDocumentId,
          interfaceTheme,
          diagramTheme,
          autoRender,
        })
      )
    }, SAVE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [
    activeDocumentId,
    autoRender,
    diagramTheme,
    documents,
    interfaceTheme,
    isPreviewOnly,
  ])

  useEffect(() => {
    if (!autoRender) {
      return
    }

    const timeout = window.setTimeout(() => {
      setRenderSource(source)
    }, RENDER_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [autoRender, source])

  useEffect(() => {
    const jobId = renderJobRef.current + 1
    renderJobRef.current = jobId

    async function renderDiagram() {
      if (!deferredRenderSource.trim()) {
        setSvg("")
        setStatus({ state: "error", message: "Diagram source is empty" })
        return
      }

      setStatus({ state: "rendering", message: "Rendering diagram" })

      try {
        const mermaid = await loadMermaid()
        const renderId = `mermaid-preview-${jobId}`

        if (renderJobRef.current !== jobId) {
          return
        }

        await mermaid.parse(deferredRenderSource)

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          fontFamily: "Geist Variable, Inter, ui-sans-serif, system-ui",
          flowchart: { curve: "basis", htmlLabels: true },
          sequence: { useMaxWidth: true },
          ...getPreviewTheme(diagramTheme).config,
        })

        const result = await mermaid.render(renderId, deferredRenderSource)

        if (renderJobRef.current !== jobId) {
          return
        }

        setSvg(result.svg)
        setStatus({
          state: "valid",
          message: "Valid Mermaid diagram",
          renderedAt: new Date(),
        })
      } catch (error) {
        document.getElementById(`mermaid-preview-${jobId}`)?.remove()

        if (renderJobRef.current !== jobId) {
          return
        }

        setSvg("")
        setStatus({
          state: "error",
          message:
            error instanceof Error
              ? error.message.replace(/\s+/g, " ").slice(0, 220)
              : "Mermaid could not parse this diagram",
        })
      }
    }

    void renderDiagram()
  }, [deferredRenderSource, diagramTheme])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault()
        setRenderSource(source)
        toast.message("Preview refreshed")
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [source])

  function applyPreset(id: string) {
    const preset = diagramPresets.find((item) => item.id === id)
    if (!preset) {
      return
    }

    updateActiveDocument({
      source: preset.code,
      title: preset.title,
      presetId: preset.id,
    })
    setRenderSource(preset.code)
    toast.success(`Loaded ${preset.title}`)
  }

  function renderNow() {
    setRenderSource(source)
    toast.message("Preview refreshed")
  }

  function toggleInterfaceTheme() {
    const nextDark = !isDarkInterface
    setInterfaceTheme(nextDark ? "dark" : "light")
    // Keep the diagram legible against the new interface unless the user has
    // already chosen a theme that matches the target mode.
    setDiagramTheme((current) =>
      getPreviewTheme(current).dark === nextDark
        ? current
        : nextDark
          ? defaultDarkTheme
          : defaultLightTheme
    )
  }

  function resetView() {
    setZoom([100])
    setPan({ x: 0, y: 0 })
  }

  function focusPreview() {
    setExamplesCollapsed(true)
    setSourceCollapsed(true)
    resetView()
  }

  function updateActiveDocument(updates: Partial<Omit<LocalDiagram, "id">>) {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === activeDocumentId
          ? { ...document, ...updates, updatedAt: Date.now() }
          : document
      )
    )
  }

  function activateDocument(document: LocalDiagram) {
    setActiveDocumentId(document.id)
    setRenderSource(document.source)
    resetView()
  }

  function switchDocument(id: string) {
    const document = documents.find((item) => item.id === id)
    if (document) {
      activateDocument(document)
    }
  }

  function handleSourceChange(nextSource: string) {
    const nextPresetId =
      nextSource === selectedPreset?.code ? selectedPreset.id : "custom"
    updateActiveDocument({ source: nextSource, presetId: nextPresetId })
  }

  function handleTitleChange(title: string) {
    updateActiveDocument({ title })
  }

  function createNewDocument() {
    const document = createDiagramDocument(
      `Diagram ${documents.length + 1}`,
      initialPreset.code,
      initialPreset.id
    )
    setDocuments((currentDocuments) => [...currentDocuments, document])
    activateDocument(document)
    setExamplesCollapsed(false)
    toast.success("New diagram created")
  }

  function duplicateDocument(id: string) {
    const sourceDocument = documents.find((document) => document.id === id)
    if (!sourceDocument) {
      return
    }

    const document = createDiagramDocument(
      `${normalizeDocumentTitle(sourceDocument.title)} copy`,
      sourceDocument.source,
      sourceDocument.presetId
    )
    setDocuments((currentDocuments) => [...currentDocuments, document])
    activateDocument(document)
    toast.success("Diagram duplicated")
  }

  function deleteDocument(id: string) {
    if (documents.length === 1) {
      toast.error("Keep at least one diagram")
      return
    }

    const nextDocuments = documents.filter((document) => document.id !== id)
    setDocuments(nextDocuments)
    if (id === activeDocumentId) {
      activateDocument(nextDocuments[0])
    }
    toast.success("Diagram deleted")
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (files.length === 0) {
      return
    }

    try {
      const importedDocuments = await Promise.all(
        files.map(async (file) =>
          createDiagramDocument(
            file.name.replace(/\.[^.]+$/, "") || "Imported diagram",
            await file.text()
          )
        )
      )
      setDocuments((currentDocuments) => [
        ...currentDocuments,
        ...importedDocuments,
      ])
      activateDocument(importedDocuments[0])
      setExamplesCollapsed(false)
      toast.success(
        importedDocuments.length === 1
          ? "Diagram imported"
          : `${importedDocuments.length} diagrams imported`
      )
    } catch {
      toast.error("Could not import one or more files")
    }
  }

  async function copyText(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value)
    toast.success(successMessage)
  }

  function getCurrentSharePayload() {
    return createSharePayload(
      activeDocument?.title || "Untitled diagram",
      source,
      diagramTheme
    )
  }

  async function copyShareLink(previewOnly: boolean) {
    const url = createShareUrl(getCurrentSharePayload(), previewOnly)
    const title = previewOnly ? "Preview link" : "Editor link"

    try {
      await navigator.clipboard.writeText(url)
      toast.success(`${title} copied`)
    } catch {
      setShareFallback({ title, url })
      toast.message("Copy blocked by the browser")
    }
  }

  function openEditorFromPreview() {
    window.history.replaceState(
      null,
      "",
      createShareUrl(getCurrentSharePayload(), false)
    )
    setIsPreviewOnly(false)
    setExamplesCollapsed(true)
    setSourceCollapsed(false)
  }

  async function exportPng() {
    if (!svg) {
      toast.error("Render a valid diagram before exporting PNG")
      return
    }

    const { width, height } = extractSvgDimensions(svg)
    const scale = 2
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const context = canvas.getContext("2d")

    if (!context) {
      toast.error("Canvas export is not available in this browser")
      return
    }

    const image = new Image()
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    image.onload = () => {
      context.fillStyle = previewTheme.surface
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          toast.error("PNG export failed")
          return
        }
        downloadBlob(pngBlob, `${slugify(activeDocument?.title || "diagram")}.png`)
        toast.success("PNG downloaded")
      }, "image/png")
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error("PNG export failed")
    }

    image.src = url
  }

  function exportSvg() {
    if (!svg) {
      toast.error("Render a valid diagram before exporting SVG")
      return
    }
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${slugify(activeDocument?.title || "diagram")}.svg`
    )
    toast.success("SVG downloaded")
  }

  function exportSource() {
    downloadBlob(
      new Blob([source], { type: "text/plain;charset=utf-8" }),
      `${slugify(activeDocument?.title || "diagram")}.mmd`
    )
    toast.success("Mermaid source downloaded")
  }

  const statusBadge =
    status.state === "valid" ? (
      <Badge variant="secondary" className="status-badge valid">
        <CheckCircle2 data-icon="inline-start" />
        Valid
      </Badge>
    ) : status.state === "error" ? (
      <Badge variant="destructive">
        <CircleAlert data-icon="inline-start" />
        Error
      </Badge>
    ) : (
      <Badge variant="outline">
        <RefreshCw data-icon="inline-start" className="spin-icon" />
        Rendering
      </Badge>
    )

  const shareFallbackDialog = (
    <Dialog
      open={shareFallback !== null}
      onOpenChange={(open) => {
        if (!open) {
          setShareFallback(null)
        }
      }}
    >
      <DialogContent className="share-dialog">
        <DialogHeader>
          <DialogTitle>{shareFallback?.title || "Share link"}</DialogTitle>
          <DialogDescription>
            Copy this link manually if browser clipboard access is unavailable.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Share link"
          readOnly
          value={shareFallback?.url ?? ""}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
        />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )

  if (isPreviewOnly) {
    return (
      <TooltipProvider>
        <div className="shared-preview-shell">
          <header className="shared-preview-topbar">
            <div className="brand-block">
              <div className="brand-mark">
                <Workflow aria-hidden="true" />
              </div>
              <div>
                <h1>{normalizeDocumentTitle(activeDocument?.title || "")}</h1>
                <p>Mermaid Studio preview</p>
              </div>
            </div>

            <div className="shared-preview-actions">
              {statusBadge}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Zoom out"
                      onClick={() =>
                        setZoom(([value]) => [
                          Math.max(MIN_ZOOM, value - 15),
                        ])
                      }
                    />
                  }
                >
                  <ZoomOut />
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Reset view"
                      onClick={resetView}
                    />
                  }
                >
                  <Focus />
                </TooltipTrigger>
                <TooltipContent>Reset view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Zoom in"
                      onClick={() =>
                        setZoom(([value]) => [
                          Math.min(MAX_ZOOM, value + 15),
                        ])
                      }
                    />
                  }
                >
                  <ZoomIn />
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyShareLink(true)}
              >
                <Share2 data-icon="inline-start" />
                Share
              </Button>
              <Button size="sm" onClick={openEditorFromPreview}>
                <FileCode2 data-icon="inline-start" />
                Open editor
              </Button>
            </div>
          </header>

          <main className="shared-preview-main">
            <PreviewCanvas
              svg={svg}
              status={status.state}
              zoom={zoom[0]}
              pan={pan}
              setPan={setPan}
              setZoom={setZoom}
              message={status.message}
              theme={previewTheme}
            />
          </main>
        </div>
        {shareFallbackDialog}
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark">
              <Workflow aria-hidden="true" />
            </div>
            <div>
              <h1>Mermaid Studio</h1>
              <p>Draft, preview, validate, and export diagrams.</p>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="toggle-group" role="group" aria-label="Panels">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Toggle examples panel"
                      aria-pressed={!examplesCollapsed}
                      data-active={!examplesCollapsed}
                      onClick={() => setExamplesCollapsed((value) => !value)}
                    />
                  }
                >
                  <PanelLeft />
                </TooltipTrigger>
                <TooltipContent>
                  {examplesCollapsed ? "Show examples" : "Hide examples"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Toggle source panel"
                      aria-pressed={!sourceCollapsed}
                      data-active={!sourceCollapsed}
                      onClick={() => setSourceCollapsed((value) => !value)}
                    />
                  }
                >
                  <FileCode2 />
                </TooltipTrigger>
                <TooltipContent>
                  {sourceCollapsed ? "Show source" : "Hide source"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Focus the preview"
                      onClick={focusPreview}
                    />
                  }
                >
                  <Frame />
                </TooltipTrigger>
                <TooltipContent>Focus preview</TooltipContent>
              </Tooltip>
            </div>

            <span className="topbar-divider" aria-hidden="true" />

            <Select
              items={themeItems}
              value={diagramTheme}
              onValueChange={(value) => setDiagramTheme(value as string)}
            >
              <SelectTrigger className="theme-select" aria-label="Preview theme">
                <span
                  className="theme-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${previewTheme.swatch[0]} 0 50%, ${previewTheme.swatch[1]} 50% 100%)`,
                  }}
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="theme-menu">
                <SelectGroup>
                  <SelectLabel>Light</SelectLabel>
                  {lightThemes.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      <span
                        className="theme-swatch"
                        style={{
                          background: `linear-gradient(135deg, ${theme.swatch[0]} 0 50%, ${theme.swatch[1]} 50% 100%)`,
                        }}
                      />
                      <span className="theme-option-text">
                        <strong>{theme.label}</strong>
                        <small>{theme.hint}</small>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Dark</SelectLabel>
                  {darkThemes.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      <span
                        className="theme-swatch"
                        style={{
                          background: `linear-gradient(135deg, ${theme.swatch[0]} 0 50%, ${theme.swatch[1]} 50% 100%)`,
                        }}
                      />
                      <span className="theme-option-text">
                        <strong>{theme.label}</strong>
                        <small>{theme.hint}</small>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={
                      isDarkInterface
                        ? "Switch to light interface"
                        : "Switch to dark interface"
                    }
                    onClick={toggleInterfaceTheme}
                  />
                }
              >
                {isDarkInterface ? <Sun /> : <Moon />}
              </TooltipTrigger>
              <TooltipContent>
                {isDarkInterface ? "Light interface" : "Dark interface"}
              </TooltipContent>
            </Tooltip>

            <span className="topbar-divider" aria-hidden="true" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button size="sm" onClick={renderNow} />
                }
              >
                <Play data-icon="inline-start" />
                Render
              </TooltipTrigger>
              <TooltipContent>Render now · ⌘↵</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <Share2 data-icon="inline-start" />
                Share
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Links</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => void copyShareLink(true)}>
                    <Share2 />
                    Copy preview link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void copyShareLink(false)}>
                    <FileCode2 />
                    Copy editor link
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <Download data-icon="inline-start" />
                Export
                <ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Download</DropdownMenuLabel>
                  <DropdownMenuItem onClick={exportSvg}>
                    <FileCode2 />
                    Export SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPng}>
                    <FileDown />
                    Export PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportSource}>
                    <Braces />
                    Export .mmd
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => copyText(source, "Source copied")}
                >
                  <Copy />
                  Copy source
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => copyText(svg, "SVG copied")}
                  disabled={!svg}
                >
                  <Copy />
                  Copy SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="workspace" data-examples-collapsed={examplesCollapsed}>
          {!examplesCollapsed ? (
          <aside className="sidebar">
            <div className="sidebar-header">
              <div>
                <h2>Workspace</h2>
                <p>{documents.length} local diagram{documents.length === 1 ? "" : "s"}</p>
              </div>
              <div className="sidebar-actions">
                <input
                  ref={importInputRef}
                  className="sr-only"
                  type="file"
                  accept=".mmd,.mermaid,.txt,text/plain"
                  multiple
                  onChange={(event) => void importFiles(event)}
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Import source files"
                        onClick={() => importInputRef.current?.click()}
                      />
                    }
                  >
                    <Upload />
                  </TooltipTrigger>
                  <TooltipContent>Import files</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Create diagram"
                        onClick={createNewDocument}
                      />
                    }
                  >
                    <Plus />
                  </TooltipTrigger>
                  <TooltipContent>New diagram</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="search-box">
              <Search aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search diagrams"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <TabsContent value="files" className="files-tab">
                <ScrollArea className="file-list">
                  <div className="file-stack">
                    {filteredDocuments.map((document) => (
                      <div
                        key={document.id}
                        className="file-item"
                        data-active={document.id === activeDocumentId}
                      >
                        <button
                          type="button"
                          className="file-select"
                          onClick={() => switchDocument(document.id)}
                        >
                          <FileText aria-hidden="true" />
                          <span>
                            <strong>
                              {normalizeDocumentTitle(document.title)}
                            </strong>
                            <small>
                              {
                                (diagramPresets.find(
                                  (preset) => preset.id === document.presetId
                                )?.type || "Custom")
                              }{" "}
                              ·{" "}
                              {document.source.length === 0
                                ? 0
                                : document.source.split(/\r\n|\r|\n/).length}{" "}
                              lines
                            </small>
                          </span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Open actions for ${normalizeDocumentTitle(document.title)}`}
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => duplicateDocument(document.id)}
                              >
                                <Files />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={documents.length === 1}
                                onClick={() => deleteDocument(document.id)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {filteredDocuments.length === 0 ? (
                      <div className="file-empty">
                        <Files aria-hidden="true" />
                        <span>No local diagrams match this search.</span>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="templates" className="templates-tab">
                <Select
                  items={[{ label: "All", value: "All" }, ...diagramTypes.map((type) => ({ label: type, value: type }))]}
                  value={selectedType}
                  onValueChange={(value) => setSelectedType(value as string)}
                >
                  <SelectTrigger className="sidebar-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger>
                    <SelectGroup>
                      <SelectItem value="All">All</SelectItem>
                      {diagramTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <ScrollArea className="template-list">
                  <div className="template-stack">
                    {filteredPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="template-item"
                        data-active={preset.id === activeDocument?.presetId}
                        onClick={() => applyPreset(preset.id)}
                      >
                        <span className="template-type">{preset.type}</span>
                        <strong>{preset.title}</strong>
                        <span>{preset.description}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="details" className="details-tab">
                <div className="detail-row">
                  <span>Active file</span>
                  <strong>{normalizeDocumentTitle(activeDocument?.title || "")}</strong>
                </div>
                <div className="detail-row">
                  <span>Diagram type</span>
                  <strong>{selectedPreset?.type || "Custom"}</strong>
                </div>
                <div className="detail-row">
                  <span>Render mode</span>
                  <strong>{autoRender ? "Auto" : "Manual"}</strong>
                </div>
                <div className="tip-block">
                  <Sparkles aria-hidden="true" />
                  <p>
                    Files, source, and theme settings are saved in this browser.
                    Use import to bring in several local Mermaid sources at once.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </aside>
          ) : null}

          <section
            className="workbench"
            data-source-collapsed={sourceCollapsed}
            aria-label="Mermaid editor workspace"
          >
            <ResizablePanelGroup orientation="horizontal" className="pane-group">
              {!sourceCollapsed ? (
                <>
              <ResizablePanel defaultSize={45} minSize={28} className="pane">
                <section className="editor-panel">
                  <div className="panel-header">
                    <div className="source-title-block">
                      <label htmlFor="diagram-title">Source</label>
                      <Input
                        id="diagram-title"
                        className="source-title-input"
                        value={activeDocument?.title || ""}
                        onChange={(event) => handleTitleChange(event.target.value)}
                        onBlur={(event) =>
                          handleTitleChange(
                            normalizeDocumentTitle(event.target.value)
                          )
                        }
                        aria-label="Diagram title"
                      />
                      <p>{stats.lines} lines, {stats.characters} chars</p>
                    </div>
                    <div className="panel-actions">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Copy source"
                              onClick={() =>
                                void copyText(source, "Source copied")
                              }
                            />
                          }
                        >
                          <Copy />
                        </TooltipTrigger>
                        <TooltipContent>Copy source</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Minimize source"
                              onClick={() => setSourceCollapsed(true)}
                            />
                          }
                        >
                          <FileCode2 />
                        </TooltipTrigger>
                        <TooltipContent>Minimize source</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="editor-frame">
                    <CodeMirror
                      value={source}
                      height="100%"
                      extensions={editorExtensions}
                      theme={isDarkInterface ? oneDark : undefined}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        highlightActiveLine: true,
                        autocompletion: true,
                      }}
                      onChange={handleSourceChange}
                    />
                  </div>
                </section>
              </ResizablePanel>

              <ResizableHandle withHandle />
                </>
              ) : null}

              <ResizablePanel
                defaultSize={sourceCollapsed ? 100 : 55}
                minSize={sourceCollapsed ? 100 : 38}
                className="pane"
              >
                <section className="preview-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Preview</h2>
                      <p>{status.message}</p>
                    </div>
                    <div className="panel-actions">
                      {sourceCollapsed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSourceCollapsed(false)}
                        >
                          <FileCode2 data-icon="inline-start" />
                          Source
                        </Button>
                      ) : null}
                      {examplesCollapsed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExamplesCollapsed(false)}
                        >
                          <PanelLeft data-icon="inline-start" />
                          Examples
                        </Button>
                      ) : null}
                      {statusBadge}
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button
                              variant="outline"
                              size="icon-sm"
                              aria-label="Open presentation view"
                            />
                          }
                        >
                          <Maximize2 />
                        </DialogTrigger>
                        <DialogContent className="presentation-dialog">
                          <DialogHeader>
                            <DialogTitle>Presentation view</DialogTitle>
                            <DialogDescription>
                              A focused render of the current Mermaid diagram.
                            </DialogDescription>
                          </DialogHeader>
                          <PreviewCanvas
                            svg={svg}
                            status={status.state}
                            zoom={zoom[0]}
                            pan={pan}
                            setPan={setPan}
                            setZoom={setZoom}
                            message={status.message}
                            theme={previewTheme}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="preview-layout">
                    <PreviewCanvas
                      svg={svg}
                      status={status.state}
                      zoom={zoom[0]}
                      pan={pan}
                      setPan={setPan}
                      setZoom={setZoom}
                      message={status.message}
                      theme={previewTheme}
                    />

                    <aside className="inspector" aria-label="Preview controls">
                      <div className="inspector-section">
                        <div className="inspector-heading">
                          <Focus aria-hidden="true" />
                          View
                        </div>
                        <div className="slider-row">
                          <ZoomIn aria-hidden="true" />
                          <Slider
                            value={zoom}
                            onValueChange={(value) => setZoom(value as number[])}
                            min={MIN_ZOOM}
                            max={MAX_ZOOM}
                            step={5}
                          />
                          <span>{zoom[0]}%</span>
                        </div>
                        <div className="zoom-buttons">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setZoom(([value]) => [Math.max(MIN_ZOOM, value - 15)])
                            }
                          >
                            Zoom out
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setZoom(([value]) => [Math.min(MAX_ZOOM, value + 15)])
                            }
                          >
                            Zoom in
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetView}
                          className="w-full"
                        >
                          <Focus data-icon="inline-start" />
                          Reset view
                        </Button>
                      </div>

                      <Separator />

                      <div className="inspector-section">
                        <div className="switch-row">
                          <div>
                            <strong>Auto render</strong>
                            <span>Refresh after edits</span>
                          </div>
                          <Switch
                            checked={autoRender}
                            onCheckedChange={setAutoRender}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={renderNow}
                          className="w-full"
                        >
                          <RefreshCw data-icon="inline-start" />
                          Refresh preview
                        </Button>
                      </div>

                      <Separator />

                      <div className="inspector-section">
                        <div className="inspector-heading">
                          <BadgeCheck aria-hidden="true" />
                          Validation
                        </div>
                        <p className="validation-message">{status.message}</p>
                        {status.renderedAt ? (
                          <span className="muted-small">
                            Rendered {status.renderedAt.toLocaleTimeString()}
                          </span>
                        ) : null}
                      </div>
                    </aside>
                  </div>
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          </section>
        </main>

        <footer className="statusbar">
          <span>
            <PanelLeft aria-hidden="true" />
            {selectedPreset?.type || "Custom"}
          </span>
          <span>{stats.words} words</span>
          <span>{stats.lines} lines</span>
          <span>{zoom[0]}% zoom</span>
          <span>{previewTheme.label} theme</span>
          <span>{autoRender ? "Auto render on" : "Manual render"}</span>
          <span className="statusbar-state" data-state={status.state}>
            {status.state}
          </span>
        </footer>
      </div>
      {shareFallbackDialog}
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  )
}

function PreviewCanvas({
  svg,
  status,
  zoom,
  pan,
  setPan,
  setZoom,
  message,
  theme,
}: {
  svg: string
  status: RenderStatus
  zoom: number
  pan: { x: number; y: number }
  setPan: Dispatch<SetStateAction<{ x: number; y: number }>>
  setZoom: Dispatch<SetStateAction<number[]>>
  message: string
  theme: PreviewTheme
}) {
  const dragRef = useRef<{
    pointerId: number
    x: number
    y: number
  } | null>(null)

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!svg || status !== "valid") {
      return
    }

    event.preventDefault()
    const delta = event.deltaY > 0 ? -10 : 10
    setZoom(([value]) => [Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + delta))])
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!svg || status !== "valid") {
      return
    }

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic test events and a few browser edge cases can lack capture.
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const nextX = event.clientX
    const nextY = event.clientY
    setPan((current) => ({
      x: current.x + nextX - dragState.x,
      y: current.y + nextY - dragState.y,
    }))
    dragRef.current = { ...dragState, x: nextX, y: nextY }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  if (status === "error") {
    return (
      <div className="preview-canvas preview-empty" data-state="error">
        <CircleAlert aria-hidden="true" />
        <strong>Preview unavailable</strong>
        <p>{message}</p>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="preview-canvas preview-empty">
        <RefreshCw aria-hidden="true" className="spin-icon" />
        <strong>Rendering diagram</strong>
        <p>Mermaid Studio is preparing the preview.</p>
      </div>
    )
  }

  return (
    <div
      className="preview-canvas preview-interactive"
      data-theme-dark={theme.dark}
      style={{ "--surface": theme.surface } as CSSProperties}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="diagram-surface"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`,
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

export default App
