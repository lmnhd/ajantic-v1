# Auto-Generated Tools for AI Agents

This module provides functionality to create custom tools for AI agents.

## Loading Predefined Tools During Agent Initialization

The simplest way to add custom tools is to use the predefined tool loader, which lets you define tools with custom JavaScript code that will be available to agents from startup.

### Basic Usage Example

```typescript
import { AGENT_TOOLS_customToolWrapper } from "@/app/(main)/research/analysis/lib/agent-tools/auto-gen-tool/load-predefined-tool";

// In your agent loading code:
const loadedTools = {
  ...standardTools,
  ...AGENT_TOOLS_customToolWrapper({
    name: "formatPhoneNumber",
    description: "Formats a phone number to a standardized format",
    parameters: [
      {
        name: "phoneNumber",
        type: "string",
        description: "The phone number to format",
        required: true
      },
      {
        name: "format",
        type: "string",
        description: "The format to use (e.g., 'US', 'International')",
        default: "US",
        required: false
      }
    ],
    functionBody: `
      // Remove non-numeric characters
      const digitsOnly = phoneNumber.replace(/\\D/g, '');
      
      // Format based on the requested format
      if (format === 'International') {
        if (digitsOnly.length === 10) {
          return '+1 ' + digitsOnly.replace(/^(\\d{3})(\\d{3})(\\d{4})$/, '($1) $2-$3');
        } else {
          return '+' + digitsOnly.replace(/^(\\d+)(\\d{3})(\\d{3})(\\d{4})$/, '$1 ($2) $3-$4');
        }
      } else {
        // Default US format
        return digitsOnly.replace(/^(\\d{3})(\\d{3})(\\d{4})$/, '($1) $2-$3');
      }
    `
  }, agentName, userId)
};
```

### Loading Multiple Tools at Once

You can also load multiple tools at once:

```typescript
import { AGENT_TOOLS_loadCustomTools } from "@/app/(main)/research/analysis/lib/agent-tools/auto-gen-tool/load-predefined-tool";

const customTools = [
  {
    name: "formatDateTime",
    description: "Formats a date/time string into a readable format",
    parameters: [
      {
        name: "dateTimeString",
        type: "string",
        description: "The date/time string to format",
        required: true
      },
      {
        name: "format",
        type: "string",
        description: "The format to use (e.g., 'short', 'long', 'relative')",
        default: "short",
        required: false
      }
    ],
    functionBody: `
      const date = new Date(dateTimeString);
      
      if (isNaN(date.getTime())) {
        return { error: true, message: "Invalid date format" };
      }
      
      switch (format) {
        case 'long':
          return date.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        case 'relative':
          const now = new Date();
          const diffMs = now - date;
          const diffSec = Math.round(diffMs / 1000);
          const diffMin = Math.round(diffSec / 60);
          const diffHr = Math.round(diffMin / 60);
          const diffDay = Math.round(diffHr / 24);
          
          if (diffSec < 60) return \`\${diffSec} seconds ago\`;
          if (diffMin < 60) return \`\${diffMin} minutes ago\`;
          if (diffHr < 24) return \`\${diffHr} hours ago\`;
          return \`\${diffDay} days ago\`;
        default: // short
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }
    `
  },
  {
    name: "calculateTip",
    description: "Calculates recommended tip amounts for a bill",
    parameters: [
      {
        name: "billAmount",
        type: "number",
        description: "The total bill amount",
        required: true
      },
      {
        name: "serviceQuality",
        type: "string", 
        description: "Quality of service ('poor', 'adequate', 'good', 'excellent')",
        default: "good",
        required: false
      }
    ],
    functionBody: `
      // Set tip percentage based on service quality
      let tipPercentage = 0.15; // default
      
      switch (serviceQuality.toLowerCase()) {
        case 'poor':
          tipPercentage = 0.10;
          break;
        case 'adequate':
          tipPercentage = 0.15;
          break;
        case 'good':
          tipPercentage = 0.18;
          break;
        case 'excellent':
          tipPercentage = 0.20;
          break;
      }
      
      const tipAmount = billAmount * tipPercentage;
      const totalAmount = billAmount + tipAmount;
      
      return {
        billAmount: billAmount.toFixed(2),
        tipPercentage: (tipPercentage * 100).toFixed(0) + '%',
        tipAmount: tipAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2)
      };
    `
  }
];

// In your agent loading code:
const loadedTools = {
  ...standardTools,
  ...AGENT_TOOLS_loadCustomTools(customTools, agentName, userId)
};
```

## AI-Powered Tool Generation

For more advanced scenarios, you can use the tool generator service to automatically create tools from high-level descriptions. This is particularly useful in team auto-generation processes where agents need custom tools based on their role.

### Using the Tool Generator Service

```typescript
import { createToolFromRequest } from "@/app/(main)/research/analysis/lib/agent-tools/auto-gen-tool/tool-generator-service";
import { ToolRequest } from "@/lib/types";

// Define your tool request
const toolRequest: ToolRequest = {
  name: "extractEntities",
  description: "Extracts named entities from text",
  purpose: "Identify and categorize entities like persons, organizations, and locations in text content",
  inputs: [
    {
      name: "text",
      type: "string",
      description: "The text to analyze",
      required: true
    },
    {
      name: "entityTypes",
      type: "array",
      description: "Types of entities to extract (e.g., ['person', 'organization', 'location'])",
      required: false,
      default: ["person", "organization", "location"]
    }
  ],
  expectedOutput: "An array of extracted entities with their types",
  examples: [
    {
      input: {
        text: "Microsoft CEO Satya Nadella announced new AI features at their Seattle headquarters."
      },
      output: [
        { entity: "Microsoft", type: "organization" },
        { entity: "Satya Nadella", type: "person" },
        { entity: "Seattle", type: "location" }
      ]
    }
  ]
};

// Generate and load the tool
const generatedTool = await createToolFromRequest(toolRequest, agentName, userId);

// Add it to your agent's tools
const agentTools = {
  ...standardTools,
  ...generatedTool
};
```

### Support for Legacy Tool Requests

The system supports backward compatibility with the legacy tool request format:

```typescript
// Legacy format still works
const legacyToolRequest = {
  toolName: "summarizeText",
  toolDescription: "Summarizes a text into a shorter version",
  suggestedInputs: ["text", "maxLength"],
  suggestedOutputs: ["summary"]
};

// Will be automatically converted to the new format
const generatedTool = await createToolFromRequest(legacyToolRequest, agentName, userId);
```

### Creating Multiple Tools in Team Auto-Generation

You can use this service to quickly create custom tools during team auto-generation:

```typescript
import { createToolsFromRequests } from "@/app/(main)/research/analysis/lib/agent-tools/auto-gen-tool/tool-generator-service";

// During team auto-generation, extract tool requests
function setupTeamAgent(agentConfig, userId) {
  // Extract tool requests from agent config
  const toolRequests = agentConfig.toolRequests || [];
  
  // Generate all requested tools
  const customTools = await createToolsFromRequests(toolRequests, agentConfig.name, userId);
  
  // Combine with standard tools
  const allTools = {
    ...standardTools,
    ...customTools
  };
  
  // Create the agent with the tools
  return createAgent({
    ...agentConfig,
    tools: allTools
  });
}
```

## Integration with LOAD_AGENT_TOOLS

You can use these custom tools with the standard agent tool loading system:

```typescript
import { LOAD_AGENT_TOOLS } from "@/app/(main)/research/analysis/lib/agent-tools/load-agent-tools";
import { AGENT_TOOLS_loadCustomTools } from "@/app/(main)/research/analysis/lib/agent-tools/auto-gen-tool/load-predefined-tool";

// Define your custom tools
const customTools = [
  // Tool definitions as shown above
];

// Load standard tools
let loadedTools = LOAD_AGENT_TOOLS(
  toolNames,
  {},
  sets,
  vc,
  textChatLogs,
  state,
  agentName,
  userID,
  query
);

// Add custom tools
loadedTools = {
  ...loadedTools,
  ...AGENT_TOOLS_loadCustomTools(customTools, agentName, userID)
};
``` 