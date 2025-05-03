export interface ToolRegistryEntry {
    id: string;
    userId: string;
    name: string;
    description: string;
    parameters: string; // JSON string of parameter definitions
    implementation: string; // Code or endpoint
    implementationType: string; // "function", "api", "dynamic-script"
    metadata: string; // JSON string (can still contain original userId for compatibility/logging if desired)
    version: number;
    createdAt: Date;
    updatedAt: Date;
    reference?: string;
  }