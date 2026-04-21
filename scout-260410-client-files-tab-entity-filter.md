# Scout Report: Client Detail Files Tab & Entity Filter

**Date**: 2026-04-10  
**Task**: Locate files related to client detail page Files tab with entity filter

## Summary

Found all core components for the Files tab with unified entity filtering. Parent-child component architecture with entity-aware filtering, badges, and reassignment.

## Core Files Located

### 1. Files Tab Main Component
**Path**: `apps/workspace/src/components/files/files-tab.tsx`

- Main container for document file explorer
- Manages unified mode via `clientGroupId` prop
- Fetches group images with entity metadata
- State: `selectedEntityId` for filtering
- Renders entity filter bar (2+ entities only)
- Groups documents by categories (IDENTITY, INCOME, TAX_RETURNS, EXPENSE, ASSET, EDUCATION, HEALTHCARE, OTHER)
- Passes `entityMap` and `entities` to child sections

**Key Props**:
- `caseId`: Single-entity mode
- `clientGroupId`: Activates unified mode
- `taxYear`: For group images query
- `images`, `docs`, `isLoading`: Optional parent data

**State**:
- `selectedEntityId`: null = "All", or specific client ID
- Fetches via: `api.clientGroups.getGroupImages(clientGroupId, taxYear)`

### 2. Entity Filter Bar Component
**Path**: `apps/workspace/src/components/files/entity-filter-bar.tsx`

- Toggle button bar: "All" + one per entity
- Shows doc count per entity
- Color-coded buttons (ENTITY_COLORS rotation)
- Accessible: role="tab", aria-selected
- Renders only 2+ entities

**Props**:
- `entities`: EntityInfo[] (name, type, imageCount)
- `selectedEntityId`: Current filter (null = All)
- `onSelect`: Update parent filter
- `totalCount`: Total docs

**Colors**: Blue, Emerald, Orange, Purple, Pink (cycles)

### 3. File Category Section
**Path**: `apps/workspace/src/components/files/file-category-section.tsx`

- Collapsible folder per category
- Groups multi-page documents
- Drag-drop support
- Lazy-loads rows via IntersectionObserver
- Shows verified count: (verified/total)

**Props with Entity Data**:
- `entityMap`: Map<imageId → {entityClientId, entityName, entityIndex}>
- `entities`: EntityInfo[] for reassignment menu

### 4. File Item Row & Sub-Components
**Path**: `apps/workspace/src/components/files/file-category-section.tsx`

Contains:
- **FileItemRow**: Single file display with entity badge, move menu, rename, status
- **EntityBadge**: Colored pill showing entity name
- **MoveToEntityMenu**: Dropdown to reassign file to different entity

**Entity Features**:
- EntityBadge uses color from index via getEntityColor()
- MoveToEntityMenu calls: `api.images.reassignEntity(imageId, targetClientId)`
- Invalidates: `group-images` and `images` cache on reassignment

### 5. Component Exports
**Path**: `apps/workspace/src/components/files/index.ts`

Exports:
- FilesTab, FileCategorySection, UnclassifiedSection
- ImageThumbnail, FileActionDropdown
- EntityFilterBar + ENTITY_COLORS, getEntityColor()
- EmptyCategoryDropZone

## API Integration Points

### Group Images
**Endpoint**: `api.clientGroups.getGroupImages(clientGroupId, taxYear)`

**Response**:
```
{
  images: RawImage[] with { entityClientId, entityName, entityType }
  entities: EntityInfo[]
}
```

### Entity Reassignment
**Endpoint**: `api.images.reassignEntity(imageId, targetClientId)`

**Called From**: FileItemRow "Move to..." menu

## Data Flow

### Single-Entity Mode
```
FilesTab (caseId)
  -> Fetches: api.cases.getImages(caseId)
  -> FileCategorySection (no entityMap/entities)
  -> Files: Normal view (no badges, no move menu)
```

### Unified Mode
```
FilesTab (clientGroupId + taxYear)
  -> Fetches: api.clientGroups.getGroupImages()
  -> EntityFilterBar (All + entity buttons)
  -> selectedEntityId filters allImages
  -> FileCategorySection with entityMap + entities
     -> FileItemRow renders:
        - EntityBadge (colored pill)
        - Move button + MoveToEntityMenu
```

## Supporting Files

- `file-category-section.tsx`: Row rendering with entity context
- `grouped-file-row.tsx`: Multi-page document UI
- `image-thumbnail.tsx`: Thumbnail preview
- `file-action-dropdown.tsx`: File actions
- `unclassified-section.tsx`: Processing files
- `empty-category-drop-zone.tsx`: Drag-drop zones
- `simple-image-viewer-modal.tsx`: File viewer

## Client Detail Integration

**Path**: `apps/workspace/src/routes/clients/$clientId.tsx`

```typescript
import { FilesTab } from '../../components/files'

<FilesTab 
  caseId={caseId}
  images={parentImages}
  docs={parentDocs}
  isLoading={parentLoading}
  clientGroupId={selectedGroupId}   // Unified mode
  taxYear={selectedYear}
/>
```

## Type Definitions

```typescript
export interface EntityInfo {
  clientId: string
  name: string
  type: ClientType
  imageCount: number
}

export interface GroupImagesResponse {
  images: (RawImage & { entityClientId, entityName, entityType })[]
  entities: EntityInfo[]
}
```

## Architecture

```
FilesTab
├── EntityFilterBar (unified mode)
│   └── Filter buttons
├── UnclassifiedSection
│   └── Processing files
└── FileCategorySection (per category)
    └── FileItemRow (per file)
        ├── EntityBadge (unified)
        ├── Move menu (unified)
        └── FileActionDropdown
```

## Key Features

1. Entity filtering by business
2. Color-coded entity badges
3. Entity reassignment via dropdown
4. Backward compatible (single-entity mode)
5. Performance: Lazy-loading, memoization, O(1) lookups

## Translation Keys

- `filesTab.entityFilter`: Filter label
- `common.all`: "All" button
- `files.new`: "NEW" badge
- `filesTab.noFiles`: Empty state
- `filesTab.moveToCategory`: Success toast

**Unresolved Questions**: None.
