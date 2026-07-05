# CONTACTS PAGE OVERHAUL — IMPLEMENTATION PLAN

## Architecture Decision (Critical for 1.25M Records)

**Server-Side Everything.** No client-side filtering/sorting. The tRPC API receives filter/sort params and returns paginated results from TiDB.

```
User types search → Debounce 200ms → tRPC contact.list({ filters, sort, pagination })
→ TiDB indexed query → Return 100 records + totalCount
→ TanStack Virtual renders only visible rows (~15 at a time)
→ Scroll down → Fetch next page (infinite scroll)
```

## Component Breakdown

### 1. contacts.list API (Updated)
- Input: `{ search?, type?, division?, state?, district?, status?, qualityMin?, qualityMax?, sortBy?, sortOrder?, limit?, offset?, division }`
- Output: `{ items: Contact[], total: number }`
- Uses TiDB indexed columns (idx_contacts_phone, idx_contacts_division, idx_contacts_district)

### 2. ContactsTable (Main Component)
- **CSS Grid** layout (not native `<table>`) for TanStack Virtual compatibility
- **Virtual rows**: Only ~15 visible rows rendered at any time
- **Column headers**: Sortable (click to sort, shift+click multi-sort)
- **Selection**: Checkbox per row + select-all checkbox
- **Columns**: Name | Phone | Specialty | Hospital | District | State | Division | Quality | Status | Actions

### 3. FilterPanel (Collapsible Right Sidebar)
- **Search bar**: Name, phone, hospital fuzzy search
- **Division filter**: Checkboxes with counts (Gynecology, Trauma, etc.)
- **State filter**: Checkboxes with counts (Telangana, AP, etc.)
- **District filter**: Searchable dropdown
- **Quality score**: Dual-handle range slider (0-100)
- **Status**: Active/Inactive/Prospect/Blacklisted
- **Quick filters**: My Division, High Quality, Missing Phone, etc.
- **Instant apply**: 300ms debounce on changes
- **Saved views**: Save current filter combo with name

### 4. ContactDetailDrawer (Right Slide-Out)
- **Opens on row click** — no page navigation
- **Contact avatar** with division color ring
- **Quick actions**: Call, WhatsApp, Map, Email buttons
- **Info grid**: All contact fields displayed
- **Quality score meter** with breakdown
- **Activity timeline**: Recent interactions
- **Edit mode**: Inline editing of key fields
- **Close**: Slide back, return to table position

### 5. BulkActionsBar (Floating Toolbar)
- **Appears when 1+ rows selected**
- Actions: Export CSV, Change Division, Send WhatsApp, Delete
- Shows "X selected" count
- Dismissible

### 6. ViewToggle (Table vs Card)
- **Table view**: Desktop default — full columns
- **Card view**: Mobile default + optional desktop — contact cards

## Technical Stack
- **@tanstack/react-table**: Table logic (sorting, selection, columns)
- **@tanstack/react-virtual**: Row virtualization (only render visible)
- **lucide-react**: All icons
- **shadcn/ui components**: Table, Button, Badge, Input, Select, Slider, Sheet, Checkbox
- **tRPC**: Server-side queries with caching

## Data Flow
```
ContactsPage.tsx
├── State: filters, sorting, selectedRows, viewMode, detailDrawerId
│
├── FilterPanel (left sidebar)
│   └── onFilterChange → update filters state → refetch
│
├── ContactsTable (main area)
│   ├── Header: ViewToggle, Search, ActiveFilters, Export
│   ├── TanStack Table (virtualized)
│   │   ├── Column headers (sortable)
│   │   └── Virtual rows (selection + click)
│   └── Pagination / Load More
│
├── BulkActionsBar (floating, conditional)
│   └── Actions on selected rows
│
└── ContactDetailDrawer (right, conditional)
    └── Detail view of clicked contact
```

## Performance Budget
- **Initial load**: <300ms for first 100 rows
- **Scroll**: 60fps, no white gaps
- **Filter change**: <200ms debounce + <500ms API response
- **Sort change**: <500ms API response
- **Memory**: <50MB for 100K+ row virtual table

## Implementation Order
1. Update contact.list API with full filter/sort support
2. Build ContactsTable with TanStack Table + Virtual
3. Build FilterPanel component
4. Build ContactDetailDrawer component
5. Build BulkActionsBar component
6. Assemble ContactsPage with all pieces
7. Add saved views feature
