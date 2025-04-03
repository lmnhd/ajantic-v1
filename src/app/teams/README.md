# Teams Module

This directory contains the Teams page components for the Ajantic application.

## Directory Structure

The Teams module has been reorganized to follow Next.js best practices:

- **Page Components**:
  - `page.tsx` - The main Teams page component
  - `layout.tsx` - The layout for the Teams section

## Related Components and Code

Other Teams-related code has been moved to more appropriate locations:

1. **UI Components** are now in `/components/teams/`:
   - `TeamConfig.tsx` - Team configuration component
   - `AgentCard.tsx` - Component for displaying agent information
   - `AddAgentForm.tsx` - Form for adding new agents

2. **Utilities and Libraries** are now in `/lib/teams/`:
   - `/lib/teams/lib/` - Core utility functions (formerly in `teams-lib`)
   - `/lib/teams/prompts/` - Team-related prompts (formerly in `prompts`)

3. **State Management** is handled in `/lib/state/team-store.ts`

## Cleanup Notes

This reorganization was done to:
1. Reduce nesting and improve code organization
2. Follow Next.js conventions for app directory structure
3. Centralize related functionality
4. Eliminate circular dependencies
5. Make the codebase more maintainable 