# Mermaid Studio

Mermaid Studio is a browser-based Mermaid diagram editor built with React,
TypeScript, and Vite. It gives you a focused workspace for drafting Mermaid
source, validating the diagram, previewing it with different visual themes, and
exporting the result for docs or presentations.

## What It Does

- Edit Mermaid source in a CodeMirror-powered editor.
- Preview diagrams with Mermaid's renderer and syntax validation.
- Start from built-in examples for flowcharts, sequence diagrams, class
  diagrams, state machines, ERDs, Gantt charts, user journeys, and Git graphs.
- Search and filter templates by diagram type.
- Switch between light and dark app interfaces.
- Apply light and dark preview themes independently of the app theme.
- Auto-render while editing, or render manually with the toolbar button or
  `Cmd+Enter` / `Ctrl+Enter`.
- Pan, zoom, reset, and focus the preview workspace.
- Copy Mermaid source or rendered SVG.
- Export diagrams as SVG, PNG, or `.mmd` source files.
- Save the current source, app theme, preview theme, and render mode locally
  between sessions using `localStorage`.

## Tech Stack

- React 19
- TypeScript
- Vite
- Mermaid
- CodeMirror
- Tailwind CSS
- shadcn-style UI primitives
- lucide-react icons

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run linting:

```bash
npm run lint
```

## Local Persistence

The app stores editor state in the browser under the `localStorage` key
`mermaid-studio:v1`. This keeps the current Mermaid source, interface theme,
diagram theme, and auto-render setting available after a refresh or browser
restart. No server-side storage is used.

## Project Structure

```text
src/
  App.tsx                  Main editor, preview, export, and persistence logic
  App.css                  App-specific layout and visual styles
  index.css                Global styles and Tailwind setup
  lib/
    diagram-presets.ts     Built-in Mermaid examples
    preview-themes.ts      Mermaid preview theme definitions
  components/ui/           Reusable UI primitives
public/
  favicon.svg
  icons.svg
```
