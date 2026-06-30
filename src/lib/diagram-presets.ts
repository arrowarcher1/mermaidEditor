export type DiagramPreset = {
  id: string
  title: string
  type: string
  description: string
  code: string
}

export const diagramPresets: DiagramPreset[] = [
  {
    id: "release-flow",
    title: "Release flow",
    type: "Flowchart",
    description: "A product release path with review and rollback branches.",
    code: `flowchart TD
  A[Draft feature brief] --> B{Design approved?}
  B -- No --> C[Revise scope]
  C --> A
  B -- Yes --> D[Build feature]
  D --> E[Run test suite]
  E --> F{Quality gate}
  F -- Pass --> G[Ship to staging]
  G --> H[Production release]
  F -- Fail --> I[Fix defects]
  I --> E
  H --> J[Monitor metrics]
  J --> K{Incident?}
  K -- Yes --> L[Rollback]
  K -- No --> M[Close release]`,
  },
  {
    id: "checkout-sequence",
    title: "Checkout sequence",
    type: "Sequence",
    description: "Request flow between a customer, app, API, and payment service.",
    code: `sequenceDiagram
  autonumber
  participant Customer
  participant Web as Web app
  participant API
  participant Pay as Payment service

  Customer->>Web: Submit order
  Web->>API: POST /checkout
  API->>Pay: Create payment intent
  Pay-->>API: Client secret
  API-->>Web: Checkout session
  Web->>Pay: Confirm payment
  Pay-->>Web: Payment succeeded
  Web-->>Customer: Show receipt`,
  },
  {
    id: "class-model",
    title: "Class model",
    type: "Class",
    description: "A simple editor domain model with documents and exports.",
    code: `classDiagram
  class DiagramDocument {
    +string id
    +string title
    +string source
    +render()
    +validate()
  }
  class ExportJob {
    +string format
    +Date createdAt
    +download()
  }
  class ThemeProfile {
    +string name
    +string mermaidTheme
  }
  DiagramDocument "1" --> "*" ExportJob
  DiagramDocument --> ThemeProfile`,
  },
  {
    id: "state-machine",
    title: "State machine",
    type: "State",
    description: "A lightweight diagram rendering lifecycle.",
    code: `stateDiagram-v2
  [*] --> Idle
  Idle --> Editing: user types
  Editing --> Debouncing: pause
  Debouncing --> Rendering: auto render
  Rendering --> Valid: success
  Rendering --> Invalid: parse error
  Invalid --> Editing: fix source
  Valid --> Exporting: export
  Exporting --> Valid: complete`,
  },
  {
    id: "erd-orders",
    title: "Orders ERD",
    type: "ERD",
    description: "A compact relational model for commerce documentation.",
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : appears_in
  ORDER {
    string id
    date placed_at
    string status
  }
  CUSTOMER {
    string id
    string email
  }
  PRODUCT {
    string sku
    string name
    decimal price
  }`,
  },
  {
    id: "project-gantt",
    title: "Project timeline",
    type: "Gantt",
    description: "A planning timeline for design, implementation, and launch.",
    code: `gantt
  title Mermaid editor launch
  dateFormat  YYYY-MM-DD
  section Foundations
  App shell           :done,    a1, 2026-06-01, 3d
  Renderer pipeline   :active,  a2, after a1, 5d
  section Product
  Template library    :         b1, after a2, 3d
  Export workflow     :         b2, after b1, 4d
  section Release
  QA pass             :         c1, after b2, 2d
  Launch              :milestone, c2, after c1, 1d`,
  },
  {
    id: "user-journey",
    title: "User journey",
    type: "Journey",
    description: "How a technical writer moves from draft to export.",
    code: `journey
  title Diagram authoring
  section Draft
    Choose template: 5: Writer
    Edit source: 4: Writer
  section Review
    Inspect preview: 5: Writer, Reviewer
    Fix validation issue: 3: Writer
  section Publish
    Export SVG: 5: Writer
    Add to docs: 5: Writer`,
  },
  {
    id: "git-release",
    title: "Git release",
    type: "Git graph",
    description: "Branching model for feature work and release tagging.",
    code: `gitGraph
  commit id: "init"
  branch feature/editor
  checkout feature/editor
  commit id: "code editor"
  commit id: "live preview"
  checkout main
  merge feature/editor
  branch release/1.0
  checkout release/1.0
  commit id: "qa fixes"
  checkout main
  merge release/1.0 tag: "v1.0.0"`,
  },
]

export const diagramTypes = Array.from(
  new Set(diagramPresets.map((preset) => preset.type))
)
