# Teams Components

This directory contains UI components related to team management and configuration that were refactored from the original `app/teams/components` directory.

## Components

### TeamConfig.tsx

Team configuration component that allows users to view and edit team details:
- Team name
- Team objective
- Basic team settings

### AgentCard.tsx

Card component for displaying and editing individual agent information:
- Agent name and title
- Role description
- Model configuration
- Tools assigned to the agent
- Actions for editing, removing, and running agents

### AddAgentForm.tsx

Form component for adding new agents to a team:
- Name and title fields
- Role description
- Model selection
- Temperature configuration

## Usage

These components are used in the `/teams` route to provide a user interface for team management.

```jsx
import { TeamConfig } from "@/components/teams/TeamConfig";
import { AgentCard } from "@/components/teams/AgentCard";
import { AddAgentForm } from "@/components/teams/AddAgentForm";

// Example usage
<TeamConfig />
<AgentCard agent={myAgent} />
<AddAgentForm />
```

## State Management

These components interact with the team store (`useTeamStore`) to read and update team state.

## Styling

All components use the shadcn/ui component library and follow the project's design system.

## Migration Notes

These components were moved from their original location in `app/teams/components` to improve organization and follow Next.js best practices for component structure. 