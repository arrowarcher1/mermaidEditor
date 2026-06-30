import type { MermaidConfig } from "mermaid"

const FONT = "Geist Variable, Inter, ui-sans-serif, system-ui"

type Palette = {
  dark: boolean
  bg: string // diagram surface / background
  bg2: string // clusters, sections, alternating bands
  node: string // primary node fill
  border: string // node border + key accent line
  line: string // edges / connectors
  text: string // primary text
  accent: string // notes, highlights, git lanes
}

export type PreviewTheme = {
  value: string
  label: string
  hint: string
  dark: boolean
  /** Background painted behind the diagram card + used as PNG export fill. */
  surface: string
  /** Two-color swatch shown in the picker. */
  swatch: [string, string]
  /** Partial config merged into mermaid.initialize. */
  config: Pick<MermaidConfig, "theme" | "themeVariables">
}

/** Expand a compact palette into the full set of mermaid theme variables. */
function buildConfig(p: Palette): PreviewTheme["config"] {
  return {
    theme: "base",
    themeVariables: {
      darkMode: p.dark,
      fontFamily: FONT,
      background: p.bg,
      mainBkg: p.node,
      primaryColor: p.node,
      primaryBorderColor: p.border,
      primaryTextColor: p.text,
      secondaryColor: p.bg2,
      secondaryBorderColor: p.border,
      secondaryTextColor: p.text,
      tertiaryColor: p.bg2,
      tertiaryBorderColor: p.border,
      tertiaryTextColor: p.text,
      nodeBorder: p.border,
      nodeTextColor: p.text,
      lineColor: p.line,
      textColor: p.text,
      titleColor: p.text,
      edgeLabelBackground: p.bg,
      clusterBkg: p.bg2,
      clusterBorder: p.border,
      // sequence diagrams
      actorBkg: p.node,
      actorBorder: p.border,
      actorTextColor: p.text,
      actorLineColor: p.line,
      signalColor: p.line,
      signalTextColor: p.text,
      labelBoxBkgColor: p.node,
      labelBoxBorderColor: p.border,
      labelTextColor: p.text,
      loopTextColor: p.text,
      activationBkgColor: p.bg2,
      activationBorderColor: p.border,
      noteBkgColor: p.bg2,
      noteTextColor: p.text,
      noteBorderColor: p.border,
      // state / class
      labelColor: p.text,
      // git
      git0: p.accent,
      git1: p.border,
      git2: p.line,
      git3: p.text,
      gitBranchLabel0: p.bg,
      gitInv0: p.bg,
      commitLabelColor: p.text,
      commitLabelBackground: p.bg2,
      tagLabelColor: p.text,
      tagLabelBackground: p.accent,
      tagLabelBorder: p.border,
    },
  }
}

export const previewThemes: PreviewTheme[] = [
  {
    value: "default",
    label: "Classic",
    hint: "The familiar Mermaid look",
    dark: false,
    surface: "#ffffff",
    swatch: ["#ECECFF", "#9370DB"],
    config: { theme: "default" },
  },
  {
    value: "mint",
    label: "Mint",
    hint: "Fresh aquatic teal",
    dark: false,
    surface: "#ffffff",
    swatch: ["#d7f5ec", "#0d9488"],
    config: buildConfig({
      dark: false,
      bg: "#ffffff",
      bg2: "#eafaf5",
      node: "#d7f5ec",
      border: "#0d9488",
      line: "#5ea99a",
      text: "#0f3d35",
      accent: "#14b8a6",
    }),
  },
  {
    value: "ink",
    label: "Ink",
    hint: "Monochrome on paper",
    dark: false,
    surface: "#fcfcfc",
    swatch: ["#f4f4f5", "#18181b"],
    config: buildConfig({
      dark: false,
      bg: "#fcfcfc",
      bg2: "#f1f1f2",
      node: "#f4f4f5",
      border: "#27272a",
      line: "#52525b",
      text: "#18181b",
      accent: "#3f3f46",
    }),
  },
  {
    value: "midnight",
    label: "Midnight",
    hint: "Deep navy, cool blues",
    dark: true,
    surface: "#0f1424",
    swatch: ["#1e2740", "#6c8cff"],
    config: buildConfig({
      dark: true,
      bg: "#0f1424",
      bg2: "#1a2238",
      node: "#1e2740",
      border: "#6c8cff",
      line: "#52639c",
      text: "#e6ecff",
      accent: "#6c8cff",
    }),
  },
  {
    value: "ocean",
    label: "Ocean",
    hint: "Teal on deep water",
    dark: true,
    surface: "#07191d",
    swatch: ["#0e3b40", "#2dd4bf"],
    config: buildConfig({
      dark: true,
      bg: "#07191d",
      bg2: "#0c2e33",
      node: "#0e3b40",
      border: "#2dd4bf",
      line: "#2f8a80",
      text: "#cdfbf2",
      accent: "#2dd4bf",
    }),
  },
  {
    value: "grape",
    label: "Grape",
    hint: "Dracula-inspired purples",
    dark: true,
    surface: "#282a36",
    swatch: ["#44475a", "#bd93f9"],
    config: buildConfig({
      dark: true,
      bg: "#282a36",
      bg2: "#343746",
      node: "#44475a",
      border: "#bd93f9",
      line: "#6272a4",
      text: "#f8f8f2",
      accent: "#ff79c6",
    }),
  },
  {
    value: "slate",
    label: "Slate",
    hint: "Neutral graphite dark",
    dark: true,
    surface: "#18181b",
    swatch: ["#27272a", "#a1a1aa"],
    config: buildConfig({
      dark: true,
      bg: "#18181b",
      bg2: "#27272a",
      node: "#2e2e33",
      border: "#a1a1aa",
      line: "#71717a",
      text: "#f4f4f5",
      accent: "#d4d4d8",
    }),
  },
]

export const defaultLightTheme = "default"
export const defaultDarkTheme = "midnight"

export function getPreviewTheme(value: string): PreviewTheme {
  return previewThemes.find((theme) => theme.value === value) ?? previewThemes[0]
}

export function isPreviewTheme(value: unknown): value is string {
  return previewThemes.some((theme) => theme.value === value)
}
