export interface ToolRegistryEntry {
    id: string;
    name: string;
    description: string;
    parameters: string; // JSON string of parameter definitions
    implementation: string; // Code or endpoint
    implementationType: string; // "function", "api", "dynamic-script"
    metadata: string; // JSON of metadata including agentId and userId
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }