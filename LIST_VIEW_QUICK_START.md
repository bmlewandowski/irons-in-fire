# List View - Quick Start Guide

## Getting Started

### Accessing List View
1. Click the **"List View"** tab in the main navigation (next to "Org Chart" and "Dashboard")
2. The view will show either:
   - Empty state with "Add Root Node" button (if no nodes exist)
   - Tree view with your organizational hierarchy

## Basic Operations

### Creating Your First Node
1. Click **"+ Add Node"** button in the toolbar
2. Fill in the form:
   - **Name**: Employee name (required)
   - **Title**: Job title (required)
   - **Role Level**: Select from dropdown (required)
   - **Custom Role**: Only shown if Role Level = "Custom"
3. Click **"Create"** or press **Enter**
4. Node appears in the tree view

### Adding Child Nodes
1. Find the parent node in the tree
2. Click **"+ Child"** button on that row
3. An inline form appears below the parent (indented)
4. Fill in Name, Title, and Role Level
5. Click **"Add"** or press **Enter**
6. New node appears with proper indentation

### Editing Nodes
1. Click **"Edit"** button on any node row
2. Fields become editable inline
3. Modify Name, Title, or Role Level as needed
4. Click **"Save"** or press **Enter** to confirm
5. Click **"Cancel"** or press **Escape** to discard changes

### Deleting Nodes
1. Click **"Delete"** button on any node row
2. Confirmation dialog appears
3. Review the warning (all descendants will be deleted)
4. Click **"Delete"** to confirm or **"Cancel"** to abort
5. Use **"↩ Undo"** toolbar button if you need to restore

## Navigation

### Expanding/Collapsing
- **▶ (right arrow)**: Node is collapsed - click to expand and show children
- **▼ (down arrow)**: Node is expanded - click to collapse and hide children
- **Expand All**: Toolbar button to expand all nodes at once
- **Collapse All**: Toolbar button to collapse all nodes at once

### Visual Hierarchy
- Root nodes: No indentation
- Level 1 children: 32px indentation
- Level 2 children: 64px indentation
- Each level adds 32px of indentation
- Children are sorted alphabetically by name

## Drag and Drop

### Reparenting Nodes
1. **Click and hold** on any node row (not on buttons)
2. Row becomes semi-transparent while dragging
3. **Drag** to a new parent node
4. Valid drop targets highlight in **blue**
5. Invalid targets (descendants, current parent) don't highlight
6. **Release** to complete the reparent
7. Indentation updates automatically
8. Use **"↩ Undo"** if needed

### Drag Rules
- ❌ Can't drop on self
- ❌ Can't drop on own descendants (prevents cycles)
- ❌ Can't drop on current parent (no change)
- ✅ Can drop on any other node

## Import/Export

### Exporting Data
1. Click **"↓ Export"** button in toolbar
2. JSON file downloads automatically
3. Filename: `irons-in-fire-YYYY-MM-DD.json`
4. Contains all nodes (goals not included in List View)

### Importing Data
1. Click **"↑ Import"** button in toolbar
2. Select JSON file from your computer
3. Data validation occurs automatically
4. Invalid files show error notification
5. Use **"↩ Undo"** if import wasn't what you expected

## Keyboard Shortcuts

### While Editing
- **Enter**: Save changes
- **Escape**: Cancel editing

### While Creating
- **Enter**: Add new node
- **Escape**: Cancel creation

### General
- **Tab**: Move between fields
- **Shift+Tab**: Move backwards between fields

## Tips & Tricks

### Efficient Data Entry
1. Start with root nodes (executives)
2. Use **"+ Child"** for rapid hierarchy building
3. Press **Enter** after filling each form
4. Use **Expand All** to see full structure
5. Use **Collapse All** to get overview

### Safe Experimentation
- Every destructive action supports **Undo**
- Delete confirmation prevents accidents
- Invalid imports are rejected
- Export before major changes

### Finding Nodes
- Use **Collapse All** then expand relevant branches
- Children are alphabetically sorted
- Indentation shows relationships clearly
- Scroll through tree body

## Common Workflows

### Building New Organization
```
1. Add Node (CEO)
2. Click + Child on CEO
3. Add VPs (repeat for each)
4. Click + Child on VP
5. Add Directors (repeat for each)
6. Continue down hierarchy
7. Use Expand/Collapse to navigate
```

### Reorganizing Structure
```
1. Expand relevant nodes
2. Drag employee to new manager
3. Drop when blue highlight appears
4. Verify new indentation
5. Undo if needed
```

### Bulk Editing
```
1. Click Edit on first node
2. Modify fields
3. Press Enter
4. Click Edit on next node
5. Repeat...
```

## Troubleshooting

### "Can't drop here" (no blue highlight)
- Trying to drop on self
- Trying to drop on descendant (would create cycle)
- Trying to drop on current parent (already there)
- **Solution**: Choose a different drop target

### Import fails with error
- Invalid JSON format
- Missing required fields (nodes array)
- **Solution**: Check JSON structure or export fresh template

### Changes not saving
- Name or Title field is empty
- **Solution**: Fill in all required fields

### Can't delete node
- Node has dependencies (checked by service layer)
- **Solution**: Check error notification for details

## Next Steps

- **Org Chart View**: Switch to visual SVG layout
- **Dashboard View**: View goals and progress
- **Export**: Backup your data regularly
- **Documentation**: See LIST_VIEW_DOCUMENTATION.md for details

## Support

For detailed technical documentation, see:
- `LIST_VIEW_DOCUMENTATION.md` - Complete feature guide
- `LIST_VIEW_IMPLEMENTATION_SUMMARY.md` - Technical details
- `src/composables/useListView.test.ts` - Usage examples
