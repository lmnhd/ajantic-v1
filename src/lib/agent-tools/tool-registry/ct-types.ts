export interface ToolRegistryEntry {
    id: string;
    userId: string;
    name: string;
    description: string;
    parameters: string; // JSON string of parameter definitions
    implementation: string; // Code or endpoint
    implementationType: string; // "function", "api", "dynamic-script"
    metadata?: string | null; // Changed to optional/nullable based on prisma schema potential
    version?: number | null; // Changed to optional/nullable based on prisma schema potential
    createdAt: Date;
    updatedAt: Date;
    reference?: string;
    requiredCredentialNames?: string[] | null;
  }