# Teams Module

This directory contains the Teams module that was refactored and reorganized from the original `app/teams` directory.

## Directory Structure

- `lib/` - Core utility functions and helpers for teams
- `prompts/` - Team-related prompts for AI interactions

## Related Components

The UI components for teams have been moved to:

```
/components/teams/
```

This contains:
- `TeamConfig.tsx` - Team configuration component
- `AgentCard.tsx` - Card component for displaying agent information
- `AddAgentForm.tsx` - Form for adding new agents to a team

## State Management

Team state is managed through the team store located at:

```
/lib/state/team-store.ts
```

## Usage

The teams functionality can be accessed through the `/teams` route, which uses the reorganized components and state management.

### Creating a Team

Teams can be created from templates or as empty teams using the `generateTemplateTeam` function in `lib/teams/lib/team-utils.ts`.

### Managing Agents

Agents can be added, updated, and removed from teams using the appropriate functions in the team store.

## Dependencies

The teams module depends on the following:

- Zustand for state management
- React Hook Form for forms
- shadcn/ui for UI components
- UUID for generating unique IDs

## Migration Notes

This module was reorganized from the original `app/teams` directory to better follow Next.js best practices:

1. UI components have been moved to `/components/teams/`
2. Core functionality has been moved to `/lib/teams/`
3. State management has been centralized in `/lib/state/`
4. Page components remain in `/app/teams/`

This separation improves code organization, reduces circular dependencies, and makes the codebase more maintainable. 