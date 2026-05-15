# List View Feature

## Overview

The List View is a new view mode in the Irons in Fire application that displays organizational nodes in an editable tree structure. It provides a Windows Explorer-like interface for quickly populating and managing the organizational hierarchy without the complexity of the visual org chart.

## Features

### Navigation
- Accessible via the "List View" tab in the main navigation
- Sits alongside "Org Chart" and "Dashboard" tabs
- Independent toolbar with context-specific actions

### Tree Structure
- **Hierarchical Display**: Nodes are shown with indentation based on their level in the hierarchy
- **Expand/Collapse**: Click the arrow button (▶/▼) next to parent nodes to show/hide children
- **Alphabetical Sorting**: Children are automatically sorted by owner name
- **Visual Hierarchy**: Indentation increases by 32px per level

### Inline Editing
- **Quick Edit**: Click "Edit" button on any node to edit in place
- **Editable Fields**:
  - Name (ownerName)
  - Title
  - Role Level (dropdown with predefined options)
  - Custom Role Label (when Role Level is "Custom")
- **Keyboard Shortcuts**:
  - Enter: Save changes
  - Escape: Cancel editing

### Node Creation
- **Root Nodes**: Click "+ Add Node" in toolbar or the button in empty state
- **Child Nodes**: Click "+ Child" button on any parent node
- **Inline Creation**: New child nodes appear inline below their parent with proper indentation
- **Form Fields**: Name, Title, and Role Level required
- **Keyboard Shortcuts**: Enter to create, Escape to cancel

### Drag and Drop
- **Reparenting**: Drag any node row and drop it on a new parent
- **Visual Feedback**:
  - Dragging node becomes semi-transparent
  - Valid drop targets highlight in blue
  - Invalid targets (descendants, current parent) don't highlight
- **Automatic Indentation**: Indentation updates automatically after reparenting
- **Cycle Prevention**: Cannot drop a node on its own descendants

### Delete Operations
- **Confirmation Dialog**: Warns about deleting node and all descendants
- **Cascade Delete**: Automatically removes all child nodes and associated goals
- **Undo Support**: Can undo deletions using Ctrl+Z or toolbar button

### Toolbar Actions

#### Available Actions:
1. **+ Add Node**: Create a new root-level node
2. **↩ Undo**: Undo the last destructive operation (only shows if undo available)
3. **Expand All**: Expand all nodes in the tree
4. **Collapse All**: Collapse all nodes in the tree
5. **↓ Export**: Export all data (nodes and goals) to JSON file
6. **↑ Import**: Import data from JSON file

## User Experience

### Efficient Data Entry
- Focus on rapid organizational chart population
- No goal data required (goals managed in Org Chart and Dashboard views)
- Minimal clicks to create hierarchy
- Keyboard-friendly with Enter/Escape shortcuts

### Clear Visual Hierarchy
- Indentation clearly shows reporting relationships
- Expand/collapse provides overview at any level
- Sorted children make finding nodes easy

### Flexible Editing
- Edit any field inline without modal dialogs
- Quick reparenting via drag and drop
- Safe deletion with confirmation

## Technical Implementation

### Components
- **ListView.vue**: Main component managing the list view interface
- **useListView.ts**: Composable managing tree state and operations

### Key Technologies
- **Vue 3 Composition API**: Reactive state management
- **Pinia**: Store integration for nodes and goals
- **HTML5 Drag and Drop**: Native drag and drop API
- **TypeScript**: Full type safety

### State Management
- **Expanded State**: Set of node IDs currently expanded
- **Edit State**: Currently editing node ID (only one at a time)
- **Drag State**: Tracks dragging node and original parent for undo
- **Form State**: Temporary state for create/edit operations

### Tree Building Algorithm
```typescript
// Recursive tree building with level tracking
buildTree(nodes, parentId, level) -> TreeNode[]
  - Filter nodes by parentId
  - Sort alphabetically
  - Check expansion state
  - Recurse for children if expanded
  - Return flat list with level information
```

### Drag and Drop Flow
1. **DragStart**: Capture dragging node and original parent
2. **DragOver**: Check if drop target is valid (prevent cycles)
3. **Drop**: Call nodeStore.reparentNode() with new parent
4. **DragEnd**: Clear drag state

## Testing

### Unit Tests (useListView.test.ts)
- ✅ Tree building from flat nodes
- ✅ Expand/collapse functionality
- ✅ Alphabetical sorting
- ✅ Deep hierarchy support
- ✅ Multiple root nodes
- ✅ Editing state management
- ✅ Edge cases (empty, reparenting)

**Test Coverage**: 13 tests, all passing

### Integration Tests
- Integrated with existing nodeStore tests
- Import/Export validation
- Drag and drop validation (through nodeStore)

## Performance Considerations

### Efficient Rendering
- Only visible nodes are rendered (collapsed children not in DOM)
- Minimal re-renders using Vue's reactivity
- Efficient tree flattening algorithm (O(n) where n = visible nodes)

### Scalability
- Handles hundreds of nodes efficiently
- Lazy loading children via expand/collapse
- No virtual scrolling needed (unlike Dashboard) due to collapse feature

## Usage Examples

### Creating a Simple Hierarchy
1. Click "List View" tab
2. Click "+ Add Node" to create CEO
3. Click "+ Child" on CEO row to add VP
4. Click "+ Child" on VP row to add Manager
5. Fill in Name, Title, Role Level for each
6. Press Enter or click "Add" to confirm

### Reorganizing Structure
1. Expand nodes to see current structure
2. Drag a Manager row
3. Drop on a different VP to reparent
4. Indentation updates automatically

### Bulk Editing
1. Click "Edit" on a node
2. Update Name/Title/Role
3. Press Enter to save
4. Repeat for next node

## Future Enhancements

### Potential Improvements
- [ ] Multi-select for bulk operations
- [ ] Keyboard navigation (arrow keys to move between rows)
- [ ] Search/Filter functionality
- [ ] Copy/Paste nodes
- [ ] Bulk import from CSV
- [ ] Column resizing
- [ ] Custom column visibility

### Known Limitations
- Cannot edit goals in this view (by design)
- No visual representation of goal status/progress
- No spatial arrangement options (unlike Org Chart)
- Single-level undo (no redo in current implementation)

## Accessibility

### Keyboard Support
- Tab/Shift+Tab: Navigate between interactive elements
- Enter: Confirm edit/create
- Escape: Cancel edit/create
- Click: Expand/collapse, edit, delete

### Screen Reader Support
- Semantic HTML structure
- ARIA labels on buttons
- Role attributes on sections
- Live region for notifications

### Visual Design
- Clear focus indicators
- High contrast borders
- Color-coded actions (danger = red, primary = blue)
- Hover states for all interactive elements

## Conclusion

The List View provides a streamlined, efficient interface for managing organizational hierarchies. It complements the visual Org Chart view by offering quick data entry and editing capabilities, while the Dashboard view provides goal-focused analytics. Together, these three views provide a comprehensive toolset for MBO management.
