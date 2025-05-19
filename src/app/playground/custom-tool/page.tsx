"use client"; // This needs to be a client component

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Keep for maybe showing raw JSON if needed
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Use Card for layout
import {
  ToolRequest,
  ToolInputParameter,
  ModelArgs,
  ModelProviderEnum,
  ModelNames,
  StrategyAnalysis,
} from "@/src/lib/types"; // Import ToolRequest type and ModelArgs
import { ModelProviderSelect } from "@/components/global/model-provider-select"; // Import the component
import { AISessionState } from "@/src/lib/types";
import { UTILS_updateModelNameAfterProviderChange } from "@/src/lib/utils";

import {
  ToolListItem,
  ToolDefinitionResponse,
  ToolExecutionResponse,
  ToolCreationResponse,
  ToolDetails,
  GeneratedToolDefinition,
} from "@/src/app/api/playground/custom-tool/types"; // Assuming types are defined here or imported
import { useAnalysisStore } from "@/src/lib/store/analysis-store";
import { MODEL_JSON, UTILS_getModelArgsByName } from "@/src/lib/utils";
import { z } from "zod"; // Import z for schema definition in helper

import { Separator } from "@/components/ui/separator"; // Import Separator for visual division
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea for results
import { v4 as uuidv4 } from "uuid"; // For unique IDs
import QuickStartCard from "@/components/custom-tools/QuickStartCard";
import ToolSelectionAndExecutionCard from "@/components/custom-tools/ToolSelectionAndExecutionCard";
import ToolDefinitionCard from "@/components/custom-tools/ToolDefinitionCard";
import RefineStructureCard from "@/components/custom-tools/RefineStructureCard";
import { HelpersCard } from "@/components/custom-tools/HelpersCard";
import ImplementationStrategyAnalysisCard from "@/components/custom-tools/ImplementationStrategyAnalysisCard";

// Import for Scraper Consultant
import { AnalysisResult as ScrapingAnalysisResult } from "../../api/playground/analyze-scraping/_types";

// Imports for Implementation Consultant and general strategy handling
import {
    ApiConsultationRequest,
    ApiConsultationResponse,
    ConsultationHistory,
    ConsultationRound,
    AnalysisResult as ImplementationStrategyAnalysisResult, // Correctly aliased for state
    RecommendedImplementationType,
  toolRequestZodSchema, // Available for validation
} from "@/src/app/api/playground/analyze-implementation-strategy/_types";
import { toast } from "@/components/ui/use-toast";
// ... other imports ...

// --- Adapter Functions ---
const adaptProviderToEnumCase = (provider: ModelProviderEnum): string => {
    return String(provider).toUpperCase();
};
// --- End Adapter Functions ---

// Interface for a single credential requirement being defined in the UI
export interface CredentialRequirementInput {
  id: string; // A unique ID for list rendering (e.g., uuid)
  name: string; // e.g., "OPENAI_API_KEY" - must be unique within the tool
  label: string; // e.g., "OpenAI API Key"
  currentSecretValue: string; // For the input field, cleared after save
  isSecretSaved: boolean; // UI feedback: true if a value for this 'name' has been successfully saved via the API
}

// Add this component near the top of the file, after the imports

// Add this constant at the top of the file with other constants
const MODEL_CONFIG_STORAGE_KEY = "ajantic-custom-tool-model-config";

export default function CustomToolPage() {
  // --- Access Zustand State ---
  const { localState, setLocalState } = useAnalysisStore();
  const userId = localState.userId;
  // --- End Access Zustand State ---

  // --- State for Tool Execution Section ---
  const [toolRef, setToolRef] = useState<string>("");
  const [result, setResult] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [toolList, setToolList] = useState<ToolListItem[]>([]);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [selectedToolDetails, setSelectedToolDetails] =
    useState<ToolDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [toolListError, setToolListError] = useState<string | null>(null);
  const [canExecute, setCanExecute] = useState<boolean>(false);

  // --- State for Definition Generation Section ---
  const [genName, setGenName] = useState<string>("");
  const [genDescription, setGenDescription] = useState<string>("");
  const [genPurpose, setGenPurpose] = useState<string>("");
  const [genModifications, setGenModifications] = useState<string[]>([]);
  const [genInputs, setGenInputs] = useState<ToolInputParameter[]>([]);
  const [genExpectedOutput, setGenExpectedOutput] = useState<string>("");
  const [genCategory, setGenCategory] = useState<string>("");
  const [genAdditionalContext, setGenAdditionalContext] = useState<string>("");
  const [genExamplesJson, setGenExamplesJson] = useState<string>("[]");
  const [isGeneratingDef, setIsGeneratingDef] = useState<boolean>(false);
  const [genDefError, setGenDefError] = useState<string | null>(null);
  const [generatedDefinition, setGeneratedDefinition] =
    useState<GeneratedToolDefinition | null>(null);

   // --- State for Tool Creation Section ---
   const [isCreatingTool, setIsCreatingTool] = useState<boolean>(false);
   const [createToolError, setCreateToolError] = useState<string | null>(null);
  const [createToolSuccess, setCreateToolSuccess] = useState<string | null>(
    null
  );
   const [isUpdatingTool, setIsUpdatingTool] = useState<boolean>(false);
   const [updateToolError, setUpdateToolError] = useState<string | null>(null);
  const [updateToolSuccess, setUpdateToolSuccess] = useState<string | null>(
    null
  );

  // --- State for Quick Start Section ---
  const [quickStartName, setQuickStartName] = useState<string>("");
  const [quickStartDesc, setQuickStartDesc] = useState<string>("");
  const [quickStartInputs, setQuickStartInputs] = useState<string>("");
  const [quickStartOutputs, setQuickStartOutputs] = useState<string>("");
  const [isQuickStarting, setIsQuickStarting] = useState<boolean>(false);
  const [quickStartError, setQuickStartError] = useState<string | null>(null);

  // --- State for Structure Refinement ---
  const [proposedToolRequest, setProposedToolRequest] =
    useState<ToolRequest | null>(null);
  const [structureModifications, setStructureModifications] = useState<
    string[]
  >([]);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  // --- Restore ModelArgs STATE ---
  const [genModelArgs, setGenModelArgs] = useState<ModelArgs>(
    UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4.5-preview"].name)
  );

  // --- State for Scraper Consultant ---
  const [consultantUrl, setConsultantUrl] = useState<string>("");
  const [consultantDataDesc, setConsultantDataDesc] = useState<string>("");
  const [analysisResult, setAnalysisResult] =
    useState<ScrapingAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // --- NEW STATE for Implementation Consultant ---
  const [consultationHistory, setConsultationHistory] =
    useState<ConsultationHistory>([]);
  const [strategyModificationRequests, setStrategyModificationRequests] =
    useState<string[]>([]);
  const [isAnalyzingStrategy, setIsAnalyzingStrategy] =
    useState<boolean>(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [latestConsultationRound, setLatestConsultationRound] =
    useState<ConsultationRound | null>(null);
  const [acceptedStrategy, setAcceptedStrategy] =
    useState<ImplementationStrategyAnalysisResult | null>(null);
  const [exampleTargetPageUrl, setExampleTargetPageUrl] = useState<string>(""); // New state for the URL hint

  // In your component's state:
  const [credentialRequirements, setCredentialRequirements] = useState<
    CredentialRequirementInput[]
  >([]);
  const [
    showCredentialRequirementsSection,
    setShowCredentialRequirementsSection,
  ] = useState<boolean>(false); // New state

  // When loading an existing tool for editing, you would populate this state
  // based on toolDefinition.requiredCredentialNames and potentially by checking
  // if those credentials already exist for the user (to set isSecretSaved).

  // --- State for Collapsibility ---
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(true);
  const [isToolSelectionOpen, setIsToolSelectionOpen] = useState(true);
  const [isToolDefinitionOpen, setIsToolDefinitionOpen] = useState(true);
  const [isRefineStructureOpen, setIsRefineStructureOpen] = useState(true);
  const [isHelpersOpen, setIsHelpersOpen] = useState(true);
  const [isMobileHelpersOpen, setIsMobileHelpersOpen] = useState(false); // Mobile helpers can default to closed

  // Fetch the tool list on component mount
  useEffect(() => {
    // Clear previous list error when userId changes or component mounts
    setToolListError(null);

    if (!userId) {
      setIsListLoading(false);
      setToolList([]);
      console.log("User ID not available yet, skipping tool list fetch.");
      return;
    }

    const fetchTools = async () => {
      setIsListLoading(true);
      setToolListError(null);
      try {
        const response = await fetch(
          `/api/playground/list-custom-tools?userId=${encodeURIComponent(
            userId
          )}`
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `Failed to fetch tool list: ${response.statusText}`,
          }));
          throw new Error(
            errorData.error ||
              `Failed to fetch tool list: ${response.statusText}`
          );
        }
        const data = await response.json();
        if (!data.tools || !Array.isArray(data.tools))
          throw new Error("Invalid tool list format received from API.");
        setToolList(data.tools);
      } catch (err) {
        console.error("Error fetching tool list:", err);
        setToolListError(
          err instanceof Error ? err.message : "Failed to load tool list."
        );
        setToolList([]);
      } finally {
        setIsListLoading(false);
      }
    };
    fetchTools();
  }, [userId]);

  // Fetch tool details when toolRef changes AND update BOTH Execution & Definition forms
  useEffect(() => {
    const fetchToolDetailsAndCheckCredentials = async () => {
      // --- CLEAR ALL STATE if no toolRef ---
      if (!toolRef || toolRef === "placeholder" || toolRef === "no-tools") {
        setSelectedToolDetails(null);
        setFormValues({});
        setGenName("");
        setGenDescription("");
        setGenPurpose("");
        setGenInputs([]);
        setGenExpectedOutput("");
        setGenCategory("");
        setGenAdditionalContext("");
        setGenExamplesJson("[]");
        setGenModifications([]); // Keep modifications? Maybe clear them too.
        setGeneratedDefinition(null);
        setExecError(null); // Clear execution errors too
        setResult(null);
        // Do not clear proposedToolRequest here, handleClearTool does that
        setConsultationHistory([]); // Clear consultant state
        setStrategyModificationRequests([]);
        setLatestConsultationRound(null);
        setStrategyError(null);
        setAcceptedStrategy(null);
        setExampleTargetPageUrl(""); // Clear example URL
        setCredentialRequirements([]); // Clear credentials
        setShowCredentialRequirementsSection(false); // Hide when no tool loaded
        return;
      }

      // --- FETCH AND POPULATE if toolRef exists ---
      if (!userId) {
          setExecError("User ID not found. Cannot load tool details.");
          setIsDetailsLoading(false);
          setCredentialRequirements([]); 
          setShowCredentialRequirementsSection(false);
          // Clear fields if user ID disappears after selection? Maybe not needed.
          return;
      }

      let toolId: string = toolRef.includes(":")
        ? toolRef.split(":")[1]
        : toolRef;

      setIsDetailsLoading(true);
      setExecError(null);
      setResult(null);
      setFormValues({}); // Clear execution form values before loading
      setSelectedToolDetails(null); // Clear previous details
      setCredentialRequirements([]); // Clear old requirements before fetching new

      try {
        // --- 1. Fetch Tool Details (existing logic) ---
        const response = await fetch(
          `/api/playground/tool-details?id=${encodeURIComponent(
            toolId
          )}&userId=${encodeURIComponent(userId)}`
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `Failed to fetch details: ${response.statusText}`,
          }));
          throw new Error(
            errorData.error || `Failed to fetch details: ${response.statusText}`
          );
        }
        const data: ToolDetails = await response.json();

        // --- Process Parameters (used by both sections) ---
        let parsedParameters: ToolInputParameter[] = [];
         if (data.parameters) {
          if (typeof data.parameters === "string") {
                 try {
                     const parsed = JSON.parse(data.parameters);
                     if (Array.isArray(parsed)) {
                const validationResult = z
                  .array(
                    z.object({
                      name: z.string(),
                      type: z.enum([
                        "string",
                        "number",
                        "boolean",
                        "array",
                        "object",
                      ]),
                      description: z.string(),
                      required: z.boolean().optional(),
                      default: z.any().optional(),
                    })
                  )
                  .safeParse(parsed);
                if (validationResult.success)
                  parsedParameters = validationResult.data;
                else
                  console.warn(
                    "Parsed parameters string did not match schema.",
                    validationResult.error
                  );
              } else {
                console.warn("Parsed parameters string was not an array.");
              }
            } catch (e) {
              console.error("Failed to parse parameters JSON string:", e);
            }
             } else if (Array.isArray(data.parameters)) {
            const validationResult = z
              .array(
                z.object({
                  name: z.string(),
                  type: z.enum([
                    "string",
                    "number",
                    "boolean",
                    "array",
                    "object",
                  ]),
                  description: z.string(),
                  required: z.boolean().optional(),
                  default: z.any().optional(),
                })
              )
              .safeParse(data.parameters);
            if (validationResult.success)
              parsedParameters = validationResult.data;
            else
              console.warn(
                "Parameters array did not match schema.",
                validationResult.error
              );
          } else {
            console.warn("Parameters field is neither a string nor an array.");
          }
         }
        // --- End Parameter Processing ---

        // --- Set State for Execution Section (Section 1) ---
        setSelectedToolDetails({ ...data, parameters: parsedParameters }); // Store details
        const initialFormValues: Record<string, any> = {};
        parsedParameters.forEach((param) => {
          initialFormValues[param.name] =
            param.type === "boolean"
              ? param.default ?? false
              : param.default ?? "";
        });
        setFormValues(initialFormValues); // Set execution form values

        // --- Set State for Definition Section (Section 2) ---
        setGenName(data.name || "");
        setGenDescription(data.description || "");
        setGenPurpose(data.purpose || "");
        setGenExpectedOutput(data.expectedOutput || "");
        setGenInputs(parsedParameters); // Use the same parsed parameters
        setGenCategory(data.metadata?.category || "");
        setGenAdditionalContext(data.metadata?.additionalContext || "");
        setGenExamplesJson(
          JSON.stringify(data.metadata?.examples || [], null, 2)
        );
        setGenModifications([]); // Clear modifications when loading a new tool

        if (data.implementation) {
          setGeneratedDefinition({
            name: data.name || "",
            description: data.description || "",
            parameters: parsedParameters,
            expectedOutput: data.expectedOutput || "",
            implementation: data.implementation,
            // Add other fields if your GeneratedToolDefinition expects them and they are in 'data'
            requiredCredentialNames: data.requiredCredentialNames, // Pass this through
            implementationType: data.implementationType || 'function', // Pass this through
          });
        } else {
          setGeneratedDefinition(null);
        }
        // --- End Setting State for Section 2 ---

        // --- 2. Prepare Credential Requirements based on Tool Definition ---
        let initialCredentialInputs: CredentialRequirementInput[] = [];
        if (
          data.requiredCredentialNames &&
          Array.isArray(data.requiredCredentialNames)
        ) {
          initialCredentialInputs = data.requiredCredentialNames.map(
            (cred: { name: string; label: string }) => ({ 
            id: uuidv4(),
            name: cred.name,
            label: cred.label,
              currentSecretValue: "",
              isSecretSaved: false, // Default to false
            })
          );
        }
        setCredentialRequirements(initialCredentialInputs); 
        setShowCredentialRequirementsSection(initialCredentialInputs.length > 0);

        // --- 3. Check Existence of these Credentials (New Logic) ---
        if (initialCredentialInputs.length > 0 && userId) { 
          const namesToCheck = initialCredentialInputs.map(cred => cred.name);
          try {
            const checkResponse = await fetch('/api/user/credentials/check-existence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: userId, credentialNames: namesToCheck }),
            });

            if (checkResponse.ok) {
              const existenceData: Record<string, boolean> = await checkResponse.json();
              setCredentialRequirements(prevReqs => 
                prevReqs.map(req => ({
                  ...req,
                  isSecretSaved: existenceData[req.name] === true,
                }))
              );
        } else {
              console.warn("Failed to check credential existence:", await checkResponse.text());
              toast({ 
                title: "Credential Status",
                description: "Could not verify saved status for all credentials.",
                variant: "default",
                duration: 4000,
              });
            }
          } catch (credCheckError) {
            console.error("Error during credential existence check API call:", credCheckError);
            toast({
              title: "Credential Status Error",
              description: "An error occurred while checking saved status of credentials.",
              variant: "destructive",
              duration: 4000,
            });
          }
        }
        // --- End Credential Existence Check ---
      } catch (err) {
        console.error(
          `Error fetching details for tool ${toolId || toolRef}:`,
          err
        );
        setExecError(
          err instanceof Error
            ? err.message
            : `Failed to load details for ${toolRef}.`
        );
        // Clear all fields on error
        setSelectedToolDetails(null);
        setFormValues({});
        setGenName("");
        setGenDescription("");
        setGenPurpose("");
        setGenInputs([]);
        setGenExpectedOutput("");
        setGenCategory("");
        setGenAdditionalContext("");
        setGenExamplesJson("[]");
        setGenModifications([]);
        setGeneratedDefinition(null);
        setCredentialRequirements([]); // Clear on error too
        setShowCredentialRequirementsSection(false); // Hide on error
      } finally {
        setIsDetailsLoading(false);
      }
    };
    fetchToolDetailsAndCheckCredentials();
  // Add ALL gen* state variables that are set inside to the dependency array
  // Although technically they are only *set* here, adding them prevents potential
  // stale closure issues if this hook were more complex. React lint rules might require it.
  }, [
    userId,
    toolRef,
      // Add setters to dependencies is generally safe, but values aren't needed
      // If ESLint complains, add the setters: setGenName, setGenDescription, etc.
  ]);

  // Check if execution is possible based on required args
  useEffect(() => {
    if (
      !selectedToolDetails ||
      !selectedToolDetails.parameters ||
      selectedToolDetails.parameters.length === 0
    ) {
        setCanExecute(true);
        return;
    }
    const allRequiredFilled = selectedToolDetails.parameters.every((param) => {
        const isRequired = param.required !== false;
        if (!isRequired) return true;
        const value = formValues[param.name];
      if (value === null || value === undefined || value === "") return false;
        return true;
    });
    setCanExecute(allRequiredFilled);
  }, [formValues, selectedToolDetails]);

  // Generic handler for input changes in the dynamic form
  const handleFormChange = useCallback(
    (paramName: string, value: any, type: string) => {
      setFormValues((prev) => ({
      ...prev,
        [paramName]: type === "number" ? Number(value) || 0 : value,
    }));
    },
    []
  );

   // Handler for checkbox changes
  const handleCheckboxChange = useCallback(
    (paramName: string, checked: boolean | "indeterminate") => {
    // Ensure checked is a boolean
      const booleanChecked = typeof checked === "boolean" ? checked : false;
      setFormValues((prev) => ({
        ...prev,
        [paramName]: booleanChecked,
    }));
    },
    []
  );

   // --- ADD HANDLER FUNCTIONS FOR DYNAMIC INPUTS START ---
    const handleAddParameter = useCallback(() => {
    setGenInputs((prev) => [
      ...prev,
      { name: "", type: "string", description: "", required: true },
    ]);
    }, []);

    const handleRemoveParameter = useCallback((index: number) => {
    setGenInputs((prev) => prev.filter((_, i) => i !== index));
    }, []);

  const handleParameterChange = useCallback(
    (index: number, field: keyof ToolInputParameter, value: any) => {
      setGenInputs((prev) => {
            const newInputs = [...prev];
            const itemToUpdate = { ...newInputs[index] }; // Create a copy
            // Type assertion needed because field is keyof ToolInputParameter
            (itemToUpdate as any)[field] = value;
            newInputs[index] = itemToUpdate;
            return newInputs;
        });
    },
    []
  );
   // --- ADD HANDLER FUNCTIONS FOR DYNAMIC INPUTS END ---

   // --- ADD HANDLER FUNCTIONS FOR MODIFICATIONS START ---
   const handleAddModification = useCallback(() => {
    setGenModifications((prev) => [...prev, ""]);
   }, []);

   const handleRemoveModification = useCallback((index: number) => {
    setGenModifications((prev) => prev.filter((_, i) => i !== index));
   }, []);

  const handleModificationChange = useCallback(
    (index: number, value: string) => {
      setGenModifications((prev) => {
           const newMods = [...prev];
           newMods[index] = value;
           return newMods;
       });
    },
    []
  );
  // --- ADD HANDLER FUNCTIONS FOR MODIFICATIONS END ---

  // --- ADD HANDLER FUNCTIONS FOR STRUCTURE MODIFICATIONS START ---
  const handleAddStructureModification = useCallback(() => {
    setStructureModifications((prev) => [...prev, ""]);
  }, []);

  const handleRemoveStructureModification = useCallback((index: number) => {
    setStructureModifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStructureModificationChange = useCallback(
    (index: number, value: string) => {
      setStructureModifications((prev) => {
          const newMods = [...prev];
          newMods[index] = value;
          return newMods;
      });
    },
    []
  );
  // --- ADD HANDLER FUNCTIONS FOR STRUCTURE MODIFICATIONS END ---

  // --- NEW HANDLER FUNCTIONS FOR STRATEGY MODIFICATIONS START ---
  const handleAddStrategyModification = useCallback(() => {
    setStrategyModificationRequests((prev) => [...prev, ""]);
  }, []);

  const handleRemoveStrategyModification = useCallback((index: number) => {
    setStrategyModificationRequests((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }, []);

  const handleStrategyModificationChange = useCallback(
    (index: number, value: string) => {
      setStrategyModificationRequests((prev) => {
          const newMods = [...prev];
          newMods[index] = value;
          return newMods;
      });
    },
    []
  );
  // --- NEW HANDLER FUNCTIONS FOR STRATEGY MODIFICATIONS END ---

  const handleExecute = async () => {
    if (!userId || !canExecute || !selectedToolDetails) return;
    setIsExecuting(true);
    setExecError(null);
    setResult(null);
    try {
      const argsToSend = { ...formValues };
      selectedToolDetails.parameters.forEach((param) => {
        if (param.type === "number" && argsToSend[param.name] === "") {
               // Decide how to handle empty number fields: send 0, undefined, or keep as ''?
               // Let's send undefined if not required, otherwise it might fail validation later
          if (param.required !== true) {
                   delete argsToSend[param.name];
               } else {
                   // Or potentially set to 0, depends on tool logic
                   argsToSend[param.name] = 0;
               }
          }
      });
      const response = await fetch("/api/playground/custom-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, toolRef, toolArgs: argsToSend }),
      });
      const data = await response.json();
      if (!response.ok)
        setExecError(data.error || `Request failed: ${response.status}`);
      else setResult(JSON.stringify(data.result, null, 2));
    } catch (err) {
      setExecError(err instanceof Error ? err.message : "API error.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToolSelect = useCallback((value: string) => {
    if (value === "no-tools" || value === "placeholder") {
      setToolRef("");
      return;
    }
    setToolRef(value);
    setExecError(null);
    setResult(null);
  }, []);

  // --- Restore ModelProviderSelect Handlers ---
  const handleModelProviderChange = useCallback(
    (providerEnumFromComponent: string) => {
    const providerEnum = providerEnumFromComponent as ModelProviderEnum;
      const newModelName =
        UTILS_updateModelNameAfterProviderChange(providerEnum);
      const newModelArgs = {
        ...genModelArgs,
        provider: providerEnum,
        modelName: newModelName as ModelNames,
      };
      setGenModelArgs(newModelArgs);
      // Save to localStorage
      localStorage.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(newModelArgs));
    },
    [genModelArgs]
  );

  const handleModelNameChange = useCallback((modelName: string) => {
    const newModelArgs = {
      ...genModelArgs,
          modelName: modelName as ModelNames,
    };
    setGenModelArgs(newModelArgs);
    // Save to localStorage
    localStorage.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(newModelArgs));
  }, [genModelArgs]);

  const handleTemperatureChange = useCallback((temperature: number) => {
    const newModelArgs = {
      ...genModelArgs,
          temperature: temperature,
    };
    setGenModelArgs(newModelArgs);
    // Save to localStorage
    localStorage.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(newModelArgs));
  }, [genModelArgs]);

  // --- NEW HELPER: Build Payload for Save/Update ---
  const savePayloadSchema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
    inputs: z.array(
      z.object({
        name: z.string(),
        type: z.enum(["string", "number", "boolean", "array", "object"]),
        description: z.string(),
        required: z.boolean().optional(),
        default: z.any().optional(),
      })
    ),
      implementation: z.any(), // MODIFIED: Was z.string().min(1)
      implementationType: z.enum(["function", "api", "scraping"]), // <-- ADDED "scraping"
      purpose: z.string().optional(),
      expectedOutput: z.string().optional(),
      category: z.string().optional(),
      additionalContext: z.string().optional(),
    examples: z
      .array(z.object({ input: z.record(z.any()), output: z.any() }))
      .optional(),
    requiredCredentialNames: z
      .array(z.object({ name: z.string().min(1), label: z.string().min(1) }))
      .optional(), // <-- ADDED
  });
  type SavePayload = z.infer<typeof savePayloadSchema>;

  const buildSavePayload = useCallback((): SavePayload | null => {
      const currentImplementation = generatedDefinition?.implementation;
      if (!currentImplementation) {
      const errorMsg =
        "No implementation code generated or loaded. Please generate or load an implementation first.";
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          return null;
      }
    if (
      !genName ||
      !genDescription ||
      !genExpectedOutput ||
      genInputs.some((p) => !p.name || !p.type || !p.description)
    ) {
      const errorMsg =
        "Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required before saving.";
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          return null;
      }
    if (
      credentialRequirements.some(
        (req) =>
          (req.name && !req.label) ||
          (!req.name && req.label) ||
          (req.name && req.name.trim() === "") ||
          (req.label && req.label.trim() === "")
      )
    ) {
      const errorMsg =
        "All defined credential requirements must have both a unique 'Name (as ENV VAR)' and a 'User-Friendly Label'.";
        setCreateToolError(errorMsg);
        setUpdateToolError(errorMsg);
        return null;
      }
    const uniqueCredentialNames = new Set(
      credentialRequirements
        .filter((req) => req.name.trim())
        .map((req) => req.name.trim())
    );
    if (
      uniqueCredentialNames.size !==
      credentialRequirements.filter((req) => req.name.trim()).length
    ) {
      const errorMsg =
        "Credential 'Name (as ENV VAR)' must be unique for each requirement.";
        setCreateToolError(errorMsg);
        setUpdateToolError(errorMsg);
        return null;
      }

    let examplesData: any[] | undefined = undefined;
    try {
      const parsed = JSON.parse(genExamplesJson);
      if (Array.isArray(parsed)) examplesData = parsed;
    } catch {
      /* warn */
    }
      
      const activeCredentialRequirements = credentialRequirements
      .filter((req) => req.name.trim() !== "" && req.label.trim() !== "")
      .map((req) => ({ name: req.name.trim(), label: req.label.trim() }));

      // Construct the object to be validated first
      const payloadToValidate = {
          name: genName,
          description: genDescription,
          inputs: genInputs,
          implementation: currentImplementation,
          implementationType: (() => {
            if (acceptedStrategy && acceptedStrategy.recommendedType) {
              // Cast to string first to satisfy the switch, as TS might see a wider type from acceptedStrategy.recommendedType
              switch (String(acceptedStrategy.recommendedType)) {
                  case RecommendedImplementationType.API: // Compare with enum member
                      return "api";
                  case RecommendedImplementationType.FUNCTION:
                      return "function";
                  case RecommendedImplementationType.SCRAPING:
                      return "scraping";
                  default:
                      console.warn(`Unhandled recommendedType: ${acceptedStrategy.recommendedType}, defaulting to \'function\'.`);
                      return "function";
              }
            }
            return "function"; // Default if no acceptedStrategy
        })(),
          purpose: genPurpose || genDescription,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
          examples: examplesData,
          requiredCredentialNames:
        activeCredentialRequirements.length > 0
          ? activeCredentialRequirements
          : undefined,
      };

      // Validate against the schema that now includes "scraping"
      const validationResult = savePayloadSchema.safeParse(payloadToValidate);
      if (!validationResult.success) {
      const errorMsg = `Payload validation error: ${
        validationResult.error.flatten().fieldErrors
      }`;
           setCreateToolError(errorMsg);
           setUpdateToolError(errorMsg);
      console.error(
        "Save Payload Validation Error:",
        validationResult.error.flatten()
      );
           return null;
      }
      return validationResult.data; // This is now correctly typed as SavePayload
  }, [
    generatedDefinition,
    genName,
    genDescription,
    genExpectedOutput,
    genInputs,
    genExamplesJson,
    genPurpose,
    genCategory,
    genAdditionalContext,
    credentialRequirements, // New dependency
    acceptedStrategy, // <-- ADDED
    setCreateToolError,
    setUpdateToolError,
  ]);

  // --- REFACTORED: Save as New Tool ---
  const handleCreateTool = useCallback(async () => {
    if (!userId) {
      setCreateToolError("User ID not found.");
      return;
    }
    setIsCreatingTool(true);
    setCreateToolError(null);
    setCreateToolSuccess(null);
    setGenDefError(null);
    setUpdateToolError(null);
    setUpdateToolSuccess(null);
    const savePayload = buildSavePayload();
    if (!savePayload) {
      setIsCreatingTool(false);
      return;
    }
      const finalPayload = { ...savePayload, userId };
      try {
      const response = await fetch("/api/playground/create-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });
          const data = await response.json();
          if (!response.ok) {
              setCreateToolError(data.error || `Req failed: ${response.status}`);
          } else {
        setCreateToolSuccess(data.message || "Created!");
              setGeneratedDefinition(data.definition);
              setToolRef(data.toolRef);
          }
    } catch (err) {
      setCreateToolError(err instanceof Error ? err.message : "API error.");
    } finally {
      setIsCreatingTool(false);
    }
  }, [userId, buildSavePayload]);

  // --- REFACTORED: Save Updates to Selected Tool ---
  const handleUpdateTool = useCallback(async () => {
    if (!toolRef || toolRef === "placeholder" || toolRef === "no-tools") {
      setUpdateToolError("No tool selected.");
      return;
    }
    if (!userId) {
      setUpdateToolError("User ID not found.");
      return;
    }
    setIsUpdatingTool(true);
    setUpdateToolError(null);
    setUpdateToolSuccess(null);
    setGenDefError(null);
    setCreateToolError(null);
    setCreateToolSuccess(null);
    const savePayload = buildSavePayload();
    if (!savePayload) {
      setIsUpdatingTool(false);
      return;
    }
      const finalPayload = { ...savePayload, userId };
      try {
      const response = await fetch(
        `/api/playground/update-tool?ref=${encodeURIComponent(toolRef)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        }
      );
          const data = await response.json();
          if (!response.ok) {
              setUpdateToolError(data.error || `Req failed: ${response.status}`);
          } else {
        setUpdateToolSuccess(data.message || "Updated!");
              setGeneratedDefinition(data.definition);
          }
    } catch (err) {
      setUpdateToolError(err instanceof Error ? err.message : "API error.");
    } finally {
      setIsUpdatingTool(false);
    }
  }, [userId, toolRef, buildSavePayload]);

  // --- NEW HANDLER: Quick Start Tool --- 
  const handleQuickStart = useCallback(async () => {
    if (
      !userId ||
      !quickStartName ||
      !quickStartDesc ||
      !quickStartInputs ||
      !quickStartOutputs
    ) {
          setQuickStartError("Please fill in all Quick Start fields.");
          setIsQuickStarting(false);
          return;
      }
    setIsQuickStarting(true);
    setQuickStartError(null);
      setGeneratedDefinition(null);
    setGenDefError(null);
    setCreateToolError(null);
    setUpdateToolError(null);
    const quickRequestData = {
      userId,
      toolName: quickStartName,
      toolDescription: quickStartDesc,
      suggestedInputs: quickStartInputs
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      suggestedOutputs: quickStartOutputs
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const response = await fetch("/api/playground/quick-start-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickRequestData),
      });
          const data = await response.json();
          if (!response.ok) {
              setQuickStartError(data.error || `Req failed: ${response.status}`);
          } else if (data.toolRequest) {
              setProposedToolRequest(data.toolRequest as ToolRequest);
        setStructureModifications([]);
        setRefineError(null);
        setGenName("");
        setGenDescription("");
        setGenPurpose("");
        setGenInputs([]);
        setGenExpectedOutput("");
        setGenModifications([]);
        setGeneratedDefinition(null);
        setQuickStartName("");
        setQuickStartDesc("");
        setQuickStartInputs("");
        setQuickStartOutputs("");
          } else {
              setQuickStartError("Received unexpected response from server.");
          }
      } catch (err) {
          console.error("Quick Start API call failed:", err);
      setQuickStartError(
        err instanceof Error ? err.message : "Quick Start API error."
      );
      } finally {
          setIsQuickStarting(false);
      }
  }, [
    userId,
    quickStartName,
    quickStartDesc,
    quickStartInputs,
    quickStartOutputs,
  ]);

  // --- NEW HANDLER: Refine Structure ---
  const handleRefineStructure = useCallback(async () => {
      if (!proposedToolRequest || !userId) return;
    setIsRefining(true);
    setRefineError(null);
    const payload = {
      userId,
      currentStructure: proposedToolRequest,
      modifications: structureModifications,
    };
    try {
      const response = await fetch("/api/playground/refine-tool-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
          const data = await response.json();
          if (!response.ok) {
        setRefineError(
          data.error || `Refinement request failed: ${response.status}`
        );
          } else if (data.refinedToolRequest) {
              setProposedToolRequest(data.refinedToolRequest as ToolRequest);
              setStructureModifications([]);
          } else {
              setRefineError("Received unexpected response from refinement server.");
          }
      } catch (err) {
          console.error("Refine Structure API call failed:", err);
      setRefineError(
        err instanceof Error ? err.message : "Refinement API error."
      );
      } finally {
          setIsRefining(false);
      }
  }, [userId, proposedToolRequest, structureModifications]);

  // --- NEW HANDLER: Accept Structure ---
  const handleAcceptStructure = useCallback(() => {
      if (!proposedToolRequest) return;
      setGenName(proposedToolRequest.name);
      setGenDescription(proposedToolRequest.description);
    setGenPurpose(
      proposedToolRequest.purpose || proposedToolRequest.description
    );
    setGenInputs(
      Array.isArray(proposedToolRequest.inputs)
        ? proposedToolRequest.inputs
        : []
    );
      setGenExpectedOutput(proposedToolRequest.expectedOutput);
      setProposedToolRequest(null);
      setStructureModifications([]);
      setRefineError(null);
  }, [proposedToolRequest]);

  // --- NEW HANDLER: Clear Tool / Start Over ---
  const handleClearTool = useCallback(
    () => {
      setToolRef(""); // This will trigger the useEffect above to clear most state
      // Explicitly clear states not covered by the useEffect's clear path
      setProposedToolRequest(null);
      setStructureModifications([]);
      setQuickStartName("");
      setQuickStartDesc("");
      setQuickStartInputs("");
      setQuickStartOutputs("");
      setConsultantUrl("");
      setConsultantDataDesc("");
      setAnalysisResult(null);
      // Clear errors/success messages
      setExecError(null);
      setResult(null);
      setToolListError(null);
      setGenDefError(null);
      setCreateToolError(null);
      setUpdateToolError(null);
      setQuickStartError(null);
      setRefineError(null);
      setAnalysisError(null);
      setCreateToolSuccess(null);
      setUpdateToolSuccess(null);
      // Ensure all definition fields are cleared (useEffect might miss some edge cases)
      setGenName("");
      setGenDescription("");
      setGenPurpose("");
      setGenInputs([]);
      setGenExpectedOutput("");
      setGenCategory("");
      setGenAdditionalContext("");
      setGenExamplesJson("[]");
      setGenModifications([]);
      setGeneratedDefinition(null);
      setIsGeneratingDef(false);
      setIsCreatingTool(false);
      setIsUpdatingTool(false);
      setIsQuickStarting(false);
      setIsRefining(false);
      setIsAnalyzing(false);
      setIsListLoading(false);
      setIsDetailsLoading(false);
      setIsExecuting(false);
      console.log("Cleared tool state including consultant.");
      // Clear Consultant State
      setConsultationHistory([]);
      setStrategyModificationRequests([]);
      setLatestConsultationRound(null);
      setStrategyError(null);
      setAcceptedStrategy(null);
      setExampleTargetPageUrl(""); // Clear example URL
      setCredentialRequirements([]); // Clear credentials
      setShowCredentialRequirementsSection(false); // Hide on clear
    },
    [
      /* Add any setters if needed by ESLint */
    ]
  );

  // --- NEW: Handler to delete implementation ---
  const handleDeleteImplementation = useCallback(() => {
    setGeneratedDefinition((prev) => {
        if (!prev) return null;
      return { ...prev, implementation: "" };
    });
    // DO NOT set acceptedStrategy to null here if you want to reuse it.
    console.log(
      "Deleted generated implementation. Previously accepted strategy (if any) is retained."
    );

    toast({
      title: "Implementation deleted",
      description: "Previously accepted strategy (if any) is retained.",
    });
  }, [setGeneratedDefinition]); // Ensure setters used in useCallback are in its dependency array

  // --- NEW HANDLER: Analyze Implementation Strategy ---
  const handleAnalyzeStrategy = useCallback(
    async (isRefinement: boolean = false) => {
      if (!userId) {
          setStrategyError("User ID not found. Cannot analyze strategy.");
          return;
      }
      // Basic validation for core definition fields needed for analysis
      if (
        !genName ||
        !genDescription ||
        !genExpectedOutput ||
        genInputs.some((p) => !p.name || !p.type || !p.description)
      ) {
        setStrategyError(
          "Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required before analyzing strategy."
        );
           return;
      }

      setIsAnalyzingStrategy(true);
      setStrategyError(null);
      setAcceptedStrategy(null); // Clear previous acceptance
      setExampleTargetPageUrl(""); // Clear example URL on new analysis
      // Clear definition error from previous attempts
      setGenDefError(null);

      // Construct the current tool request object from the form state
      const currentToolRequestObject: ToolRequest = {
        // Use the base ToolRequest type here
          name: genName,
          description: genDescription,
          purpose: genPurpose || genDescription,
          inputs: genInputs,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
          implementation: generatedDefinition?.implementation,
          // Ensure optional fields are included if they exist in your base ToolRequest type
          modificationRequests: genModifications, // Assuming genModifications holds these
          // examples: parse from genExamplesJson if needed
      };

      // Validate the constructed object against the imported toolRequestZodSchema
      const validationResult = toolRequestZodSchema.safeParse(
        currentToolRequestObject
      );
      if (!validationResult.success) {
        setStrategyError(
          `Internal Error: Constructed tool request is invalid - ${
            validationResult.error.flatten().fieldErrors
          }`
        );
            setIsAnalyzingStrategy(false);
            return;
      }
      const validatedToolRequest = validationResult.data; // This is now correctly typed by Zod
      
      const payload: ApiConsultationRequest = {
          userId,
          currentToolRequest: validatedToolRequest, 
          consultationHistory: isRefinement ? consultationHistory : [],
          newStrategyModifications: strategyModificationRequests,
        modelArgs: genModelArgs
          ? {
              provider:
                genModelArgs.provider.toUpperCase() as ModelProviderEnum,
            modelName: genModelArgs.modelName,
            temperature: genModelArgs.temperature,
            // Spread optional properties only if they exist to avoid sending undefined keys
              ...(genModelArgs.topP !== undefined && {
                topP: genModelArgs.topP,
              }),
            // Assuming genModelArgs uses maxOutputTokens from ModelArgs type which should map to maxTokens in Zod
              ...(genModelArgs.maxOutputTokens !== undefined && {
                maxTokens: genModelArgs.maxOutputTokens,
              }),
            }
          : undefined,
          // researchDepth: researchDepthValue, // Add if researchDepth is part of ApiConsultationRequest from _types
      };

      try {
        const response = await fetch(
          "/api/playground/analyze-implementation-strategy",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

          const data = await response.json(); // Type can be ApiConsultationResponse or error object

          if (!response.ok) {
          const errorMsg =
            (data as { error: string }).error ||
            `Strategy analysis request failed: ${response.status}`;
              setStrategyError(errorMsg);
              setLatestConsultationRound(null); // Clear previous results on error
              // Optionally clear history if the request failed fundamentally?
              // setConsultationHistory([]);
          } else {
              const result = data as ApiConsultationResponse; // Cast to expected success response
              setLatestConsultationRound(result.latestRound);
              setConsultationHistory(result.updatedHistory);
              setStrategyModificationRequests([]); // Clear input mods after successful round
          }
      } catch (err) {
          console.error("Analyze Strategy API call failed:", err);
        setStrategyError(
          err instanceof Error ? err.message : "Strategy analysis API error."
        );
          setLatestConsultationRound(null);
      } finally {
          setIsAnalyzingStrategy(false);
      }
    },
    [
      userId,
      genName,
      genDescription,
      genPurpose,
      genInputs,
      genExpectedOutput,
      genCategory,
      genAdditionalContext,
      generatedDefinition, // Include potentially used state
      consultationHistory,
      strategyModificationRequests, // Include state read in the handler
      genModelArgs, // Include genModelArgs
    ]
  );
  // --- END NEW HANDLER ---



  // --- NEW: Function to handle the actual code generation part ---
  const proceedToCodeGeneration = useCallback(
    async (strategyForGeneration?: ImplementationStrategyAnalysisResult | null) => { // Added strategyForGeneration parameter
    // Basic validation (as before)
    if (
      !userId ||
      !genName ||
      !genDescription ||
      !genExpectedOutput ||
      genInputs.some((p) => !p.name || !p.type || !p.description)
    ) {
      setGenDefError(
        "Tool Name, Description, Expected Output, and all Parameter details are required."
      );
         setIsGeneratingDef(false); // Ensure loading is reset if it was set before validation
         return;
    }

    // --- Original Generation Logic ---
    setIsGeneratingDef(true);
    setGenDefError(null);
    // Clear implementation visually while generating
    setGeneratedDefinition((prev) => {
        // If there's no previous definition, create a new one with the placeholder
        if (!prev) {
            return {
                name: genName, // Use current form values as a base
                description: genDescription,
                parameters: genInputs,
                expectedOutput: genExpectedOutput,
          implementation: "// Generating...",
            };
        }
        // Otherwise, update the existing one
      return { ...prev, implementation: "// Generating..." }; // Show placeholder
    });

    setCreateToolError(null);
    setCreateToolSuccess(null);
    setUpdateToolError(null);
    setUpdateToolSuccess(null);
    setStrategyError(null); // Clear strategy error if we are now generating

    type GeneratePayload = {
        userId: string;
        name: string;
        description: string;
        purpose: string;
        inputs: ToolInputParameter[];
        expectedOutput: string;
        category: string;
        additionalContext: string;
        modificationRequests: string[];
        implementation?: string;
        modelArgs: ModelArgs; // Ensure ModelArgs is correctly typed
        examples?: any[];
        acceptedStrategy?: ImplementationStrategyAnalysisResult | null;
    };

    let examplesData: any[] | undefined = undefined;
    try {
      if (genExamplesJson && genExamplesJson.trim() !== "") {
            const parsed = JSON.parse(genExamplesJson);
            if (Array.isArray(parsed)) examplesData = parsed;
        }
    } catch (e) {
        console.warn("Failed to parse examples JSON:", e);
      setGenDefError(
        "Examples JSON is invalid. Please correct it or clear it."
      );
        setIsGeneratingDef(false);
        // Restore previous implementation if parsing examples failed
      setGeneratedDefinition((prev) => ({
        ...(prev ?? ({} as GeneratedToolDefinition)),
        implementation:
          (prev?.implementation === "// Generating..."
            ? ""
            : prev?.implementation) || "",
      }));
        return;
    }
    
    const currentImplementationForPayload =
      generatedDefinition?.implementation === "// Generating..."
        ? undefined // If it's the placeholder, send undefined (meaning generate new)
        : generatedDefinition?.implementation; // Otherwise send the existing implementation (or undefined if none)

    // Construct the toolRequest object
    // Ensure ToolRequest type is imported and available in this scope
    const toolRequestData: ToolRequest = {
          name: genName,
          description: genDescription,
          purpose: genPurpose || genDescription,
          inputs: genInputs,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
        modificationRequests: genModifications,
        implementation: currentImplementationForPayload,
        examples: examplesData,
        acceptedStrategy: strategyForGeneration
            ? {
                // Create the wrapper StrategyAnalysis object
                id: uuidv4(), // Generate a unique ID for this StrategyAnalysis instance
                timestamp: new Date(),
                request: { // Minimal request context, adjust if more is needed by backend
                    currentToolRequest: {
                        name: genName,
                        description: genDescription,
                        purpose: genPurpose || genDescription,
                        inputs: genInputs,
                        expectedOutput: genExpectedOutput,
                        category: genCategory,
                        additionalContext: genAdditionalContext,
                        modificationRequests: genModifications,
                        implementation: currentImplementationForPayload,
                        examples: examplesData,
                        // modelArgs: genModelArgs, // REMOVED - ToolRequest type doesn't have modelArgs here
                        // DO NOT put acceptedStrategy here to avoid circular reference in this context
                    } as ToolRequest, // Cast is okay here as we are fulfilling the ToolRequest structure for the nested part
                },
                analysis: strategyForGeneration, // HERE is where the actual AnalysisResult goes
                status: 'completed', // Assuming it's completed if we're generating
                version: '1.0', // Or some other version identifier
                // Populate redundant fields from the nested analysis object
                recommendedType: strategyForGeneration.recommendedType,
                strategyDetails: strategyForGeneration.strategyDetails,
                consultationId: strategyForGeneration.consultationId, // ADDED THIS LINE
                // Add other potentially redundant fields if StrategyAnalysis interface strictly requires them at top level
                // and they are not optional. For example, if `consultationId` was mandatory at top level:
                // consultationId: strategyForGeneration.consultationId,  <-- This was a comment, the line above is the actual addition
            } as StrategyAnalysis // Type assertion to satisfy ToolRequest
            : null,
    };

    // Ensure genModelArgs.provider is explicitly uppercase just before sending
    const finalGenModelArgs: ModelArgs = {
      ...genModelArgs,
      // Force toUpperCase; cast to ModelProviderEnum as Zod will validate the specific enum values
      provider: genModelArgs.provider.toUpperCase() as ModelProviderEnum,
    };

    // Construct the final payload for the API
    const finalPayloadForApi = {
      toolRequest: toolRequestData, // toolRequestData now includes modelArgs and acceptedStrategy
      modelArgs: finalGenModelArgs, // Use the explicitly uppercased version
      userId: userId,               // userId from component state
      // acceptedStrategy: strategyForGeneration, // No longer needed as separate top-level field if backend uses the one inside toolRequest
    };

     try {
      const response = await fetch("/api/playground/generate-tool-definition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayloadForApi), // Use the new structured payload
        });
        const data = await response.json(); // Assuming this is ToolDefinitionResponse or similar

        if (!response.ok) {
            setGenDefError(data.error || `Request failed: ${response.status}`);
            // Restore previous implementation if generation failed
        setGeneratedDefinition((prev) => ({
          ...(prev ?? ({} as GeneratedToolDefinition)),
          implementation: currentImplementationForPayload || "", // Restore with original or empty string
        }));
        } else {
            // The backend should now return the full, potentially refined definition
            setGeneratedDefinition(data.definition);
            if (data.definition) {
                setGenName(data.definition.name || genName);
                setGenDescription(data.definition.description || genDescription); // Added description update
                setGenPurpose(data.definition.purpose || genPurpose); // Added purpose update
                const params = data.definition.parameters || data.definition.inputs;
                setGenInputs(Array.isArray(params) ? params : genInputs);
          setGenExpectedOutput(
            data.definition.expectedOutput || genExpectedOutput
          );
                setGenCategory(data.definition.metadata?.category || genCategory); // Added category update
                // Additional context is trickier, might be additive or overwritten based on backend.
                // For now, let's assume it's not directly overwritten by this specific call unless explicitly handled.

                // Update credential requirements based on the response
          if (
            data.definition.requiredCredentialNames &&
            Array.isArray(data.definition.requiredCredentialNames)
          ) {
            const newCredentialInputs: CredentialRequirementInput[] =
              data.definition.requiredCredentialNames.map(
                (cred: { name: string; label: string }) => ({
                        id: uuidv4(),
                        name: cred.name,
                        label: cred.label,
                  currentSecretValue: "",
                  isSecretSaved: false, // This would need a check against existing saved credentials
                })
              );
                    setCredentialRequirements(newCredentialInputs);
            setShowCredentialRequirementsSection(
              newCredentialInputs.length > 0
            );
          } else if (!data.definition.requiredCredentialNames) {
            // Explicitly clear if not present in response
                    setCredentialRequirements([]);
                    setShowCredentialRequirementsSection(false);
                }
            }
            setGenModifications([]); // Clear modifications after successful application
        }
    } catch (err) {
      setGenDefError(err instanceof Error ? err.message : "API error.");
         // Restore previous implementation on catch
      setGeneratedDefinition((prev) => ({
        ...(prev ?? ({} as GeneratedToolDefinition)),
        implementation: currentImplementationForPayload || "", // Restore with original or empty string
      }));
    } finally {
        setIsGeneratingDef(false);
    }
  }, [
    userId,
    genName,
    genDescription,
    genPurpose,
    genInputs,
    genExpectedOutput,
    genCategory,
    genAdditionalContext,
    genModifications,
    generatedDefinition,
    genModelArgs,
    genExamplesJson,
    setGenDefError,
    setIsGeneratingDef,
    setGeneratedDefinition,
    setCreateToolError,
    setCreateToolSuccess,
    setUpdateToolError,
    setUpdateToolSuccess,
    setStrategyError,
    setGenName,
    setGenDescription,
    setGenPurpose,
    setGenInputs,
    setGenExpectedOutput,
    setGenCategory,
    setCredentialRequirements,
    setShowCredentialRequirementsSection,
    setGenModifications,
  ]);
  // --- END MODIFIED ---
    // --- NEW HANDLER: Accept Strategy & Enrich Context ---
    const handleAcceptStrategyAndEnrichContext = useCallback(async () => {
      if (latestConsultationRound?.analysis) {
        // analysis here is ImplementationStrategyAnalysisResult
        let strategyToAccept = { ...latestConsultationRound.analysis };
  
        if (
          strategyToAccept.recommendedType ===
            RecommendedImplementationType.SCRAPING &&
          exampleTargetPageUrl
        ) {
          strategyToAccept.exampleTargetPageUrl = exampleTargetPageUrl;
        }
  
        setAcceptedStrategy(strategyToAccept);
        const analysis = strategyToAccept; // Use the potentially modified strategy
        const contextSummary = `
  ## Implementation Strategy Analysis (Round ${latestConsultationRound.round})
  Recommended Type: ${analysis.recommendedType}
  Strategy Details: ${analysis.strategyDetails}
  ${
    analysis.requiredCredentialName
      ? `Required Credential: ${analysis.requiredCredentialName}`
      : ""
  }
  ${
    analysis.exampleTargetPageUrl
      ? `Example Target Page URL: ${analysis.exampleTargetPageUrl}`
      : ""
  } {/* Display it */}
  ${
    analysis.warnings && analysis.warnings.length > 0
      ? `Warnings: ${analysis.warnings.join("; ")}`
      : ""
  }
  Verification: ${latestConsultationRound.verification?.status || "N/A"} - ${
          latestConsultationRound.verification?.details || "N/A"
        }
        `.trim();
        setGenAdditionalContext((prev) =>
          prev ? `${prev}\n\n${contextSummary}` : contextSummary
        );
        
        // Check if we should actually regenerate the implementation
        const currentImplementation = generatedDefinition?.implementation;
        const seemsToHaveValidImplementation = currentImplementation && currentImplementation.trim() !== "" && currentImplementation !== "// Generating...";

        if (
            strategyToAccept.recommendedType === RecommendedImplementationType.SCRAPING &&
            seemsToHaveValidImplementation &&
            currentImplementation.trim().startsWith("{") // Basic check if it looks like JSON
        ) {
            console.log("Scraping strategy accepted. Implementation appears to be valid JSON. Skipping automatic regeneration.");
            setGeneratedDefinition(prev => ({
                ...(prev ?? { name: genName, description: genDescription, parameters: genInputs, expectedOutput: genExpectedOutput, implementation: currentImplementation || "" }), 
                implementationType: "scraping", 
            }));
            toast({
                title: "Strategy Accepted (Scraping)",
                description: "Implementation type set to scraping. Existing JSON implementation retained. Save the tool to apply, or regenerate if needed.",
            });
        } else if (
            strategyToAccept.recommendedType === RecommendedImplementationType.FUNCTION &&
            seemsToHaveValidImplementation &&
            !currentImplementation.trim().startsWith("{") // Basic check if it does NOT look like JSON
        ) {
            console.log("Function strategy accepted. Implementation appears to be existing code. Skipping automatic regeneration.");
            setGeneratedDefinition(prev => ({
                ...(prev ?? { name: genName, description: genDescription, parameters: genInputs, expectedOutput: genExpectedOutput, implementation: currentImplementation || "" }),
                implementationType: "function",
            }));
            toast({
                title: "Strategy Accepted (Function)",
                description: "Implementation type set to function. Existing code implementation retained. Save the tool to apply, or regenerate if needed.",
            });
        }
         else {
            console.log("Strategy accepted. Proceeding to generate/regenerate implementation using this accepted strategy.");
            await proceedToCodeGeneration(strategyToAccept); // Pass strategyToAccept directly
        }
      }
    }, [
      latestConsultationRound, 
      exampleTargetPageUrl, 
      proceedToCodeGeneration, 
      setGenAdditionalContext, 
      setAcceptedStrategy,
      generatedDefinition, // Dependency needed for currentImplementation
      genName, genDescription, genInputs, genExpectedOutput // Dependencies for setGeneratedDefinition fallback
  ]);
  
// --- MODIFIED: Generate/Regenerate Implementation ---
const handleGenerateImplementation = useCallback(async () => {
  // 1. Check if analysis is needed (no implementation exists AND strategy not accepted yet)
  const needsAnalysis =
    !generatedDefinition?.implementation && !acceptedStrategy;

  if (needsAnalysis) {
    // Trigger analysis FIRST. The rest of this function should only run
    // after the user accepts the strategy proposed by the analysis.
    await handleAnalyzeStrategy(false); // Pass false for initial analysis
    // Stop here. The user needs to interact with the analysis results and click "Accept".
    return;
  }

  // 2. Proceed with generation only if strategy is accepted OR implementation already exists
  // This part is now handled by proceedToCodeGeneration
  await proceedToCodeGeneration(acceptedStrategy); // Pass the current component state `acceptedStrategy`
}, [
  generatedDefinition,
  acceptedStrategy, // component state
  handleAnalyzeStrategy,
  proceedToCodeGeneration,
]);
  // --- NEW HANDLER: Scraper Consultant Handlers ---
  const handleAnalyzeWebsite = useCallback(async () => {
    if (!userId || !consultantUrl) {
        setAnalysisError("User ID and Target URL are required for analysis.");
        return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/playground/analyze-scraping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: userId,
                targetUrl: consultantUrl,
          dataDescription: consultantDataDesc || undefined,
        }),
        });

      const data: ScrapingAnalysisResult | { error: string; details?: any } =
        await response.json();

        if (!response.ok) {
        const errorMsg =
          (data as { error: string }).error ||
          `Analysis request failed: ${response.status}`;
            setAnalysisError(errorMsg);
        if ((data as { details: any }).details)
          console.error(
            "Analysis Validation:",
            (data as { details: any }).details
          );
        } else {
            setAnalysisResult(data as ScrapingAnalysisResult);
        }
    } catch (err) {
        console.error("Scraper Consultant API call failed:", err);
      setAnalysisError(
        err instanceof Error ? err.message : "Analysis API error."
      );
    } finally {
        setIsAnalyzing(false);
    }
  }, [userId, consultantUrl, consultantDataDesc]);

  const handlePopulateFromAnalysis = useCallback(() => {
    if (!analysisResult || !consultantUrl) return; // analysisResult is ScrapingAnalysisResult
    // analysisResult.suggestedMethod, .suggestedSelectors etc. should be valid fields on ScrapingAnalysisResult
    // ... (rest of the function)
  }, [analysisResult, consultantUrl, consultantDataDesc]);

  // --- Render Helper ---
  const adaptedModelProp = {
    ...genModelArgs,
    provider: String(genModelArgs.provider).toUpperCase() as any,
  };
  const displayModelProp = { ...genModelArgs };
  const hasImplementation = !!generatedDefinition?.implementation;
  const isDefinitionFormValid = 
    genName.trim() !== "" &&
    genDescription.trim() !== "" &&
    genExpectedOutput.trim() !== "" &&
    !genInputs.some(
      (p) => !p.name.trim() || !p.type.trim() || !p.description.trim()
    );
  // Update canSaveOrUpdate logic to only require implementation and valid form fields
  const canSaveOrUpdate = hasImplementation && isDefinitionFormValid;
  // Rename the derived constant to avoid conflict with the state setter
  const isExecutionReady =
    selectedToolDetails &&
    selectedToolDetails.parameters.every((param) => {
      const isRequired = param.required !== false;
      if (!isRequired) return true;
      const value = formValues[param.name];
      return !(value === null || value === undefined || value === "");
  });
  const isStrategyAccepted = !!acceptedStrategy; // <-- DECLARE THE CONSTANT HERE

  // --- NEW HANDLERS FOR CREDENTIAL REQUIREMENTS ---
  const handleAddCredentialRequirement = useCallback(() => {
    setCredentialRequirements((prev) => [
      ...prev,
      {
        id: uuidv4(),
        name: "",
        label: "",
        currentSecretValue: "",
        isSecretSaved: false,
      },
    ]);
  }, []);

  const handleRemoveCredentialRequirement = useCallback((id: string) => {
    setCredentialRequirements((prev) => prev.filter((req) => req.id !== id));
  }, []);

  const handleCredentialRequirementChange = useCallback(
    (
      id: string,
      field: keyof Omit<
        CredentialRequirementInput,
        "id" | "isSecretSaved" // currentSecretValue is now handled separately for typing
      > | 'currentSecretValue', // Allow 'currentSecretValue' specifically
      value: string
    ) => {
      setCredentialRequirements((prev) =>
        prev.map((req) => {
          if (req.id === id) {
            if (field === 'currentSecretValue') {
              // If editing the secret value of an already saved credential,
              // mark it as not saved to indicate pending changes.
              return { 
                ...req, 
                currentSecretValue: value, 
                isSecretSaved: req.isSecretSaved ? false : req.isSecretSaved 
              };
            }
            // Ensure 'name' and 'label' are handled correctly for Omit<>
            return { ...req, [field as 'name' | 'label']: value };
          }
          return req;
        })
      );
    },
    []
  );

  // --- NEW HANDLER FOR SAVING A SECRET VALUE ---
  const handleSaveCredentialSecret = useCallback(async (credentialId: string) => {
    if (!userId) {
      toast({ title: "Error", description: "User ID not found. Cannot save secret.", variant: "destructive" });
      return;
    }

    const credentialToSave = credentialRequirements.find(cred => cred.id === credentialId);

    if (!credentialToSave || !credentialToSave.name.trim() || !credentialToSave.currentSecretValue.trim()) {
      toast({ title: "Error", description: "Credential name and secret value cannot be empty.", variant: "destructive" });
      return;
    }

    // TODO: Implement loading state for individual credential save
    console.log(`Attempting to save secret for ${credentialToSave.name}`);
    toast({ title: "Saving Secret...", description: `Sending ${credentialToSave.name} to the backend.`});

    try {
      // THIS IS A HYPOTHETICAL API ENDPOINT. YOU NEED TO CREATE IT.
      const response = await fetch('/api/user/credentials/save-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          credentialName: credentialToSave.name,
          secretValue: credentialToSave.currentSecretValue, // The actual secret
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "An unknown error occurred" }));
        throw new Error(errorData.message || `Failed to save secret: ${response.statusText}`);
      }

      // On successful save:
    setCredentialRequirements(prev =>
        prev.map(cred =>
          cred.id === credentialId
            ? { ...cred, isSecretSaved: true, currentSecretValue: "" } // Clear input and mark as saved
            : cred
        )
      );
      toast({ title: "Success", description: `Secret for ${credentialToSave.name} saved.`});
      console.log(`Secret for ${credentialToSave.name} saved successfully.`);

    } catch (error: any) {
      console.error("Failed to save credential secret:", error);
      toast({ title: "Error Saving Secret", description: error.message, variant: "destructive" });
    } finally {
      // TODO: Reset loading state for individual credential save
    }
  }, [userId, credentialRequirements]);
  // --- END NEW HANDLERS ---

  // --- NEW STATE for Implementation Consultant (within Helpers section) ---
  const [activeHelperTab, setActiveHelperTab] = useState<
    "scraper" | "implementation"
  >("scraper");
  // const [helperImpConName, setHelperImpConName] = useState<string>('');
  // const [helperImpConDescription, setHelperImpConDescription] = useState<string>('');
  // const [helperImpConPurpose, setHelperImpConPurpose] = useState<string>('');
  // const [helperImpConInputsStr, setHelperImpConInputsStr] = useState<string>(''); // Simplified input as string for now
  // const [helperImpConExpectedOutput, setHelperImpConExpectedOutput] = useState<string>('');
  // const [helperImpConConsultationHistory, setHelperImpConConsultationHistory] = useState<ConsultationHistory>([]);
  // const [helperImpConLatestRound, setHelperImpConLatestRound] = useState<ConsultationRound | null>(null);
  // const [isHelperAnalyzingStrategy, setIsHelperAnalyzingStrategy] = useState<boolean>(false);
  // const [helperImpConStrategyError, setHelperImpConStrategyError] = useState<string | null>(null);
  // const [helperImpConStrategyModifications, setHelperImpConStrategyModifications] = useState<string[]>([]);

  // Define the function to render tab content
  const renderHelperTabContent = (
    tab: "scraper" | "implementation"
  ): React.ReactNode => {
    if (tab === "scraper") {
      return (
        <>
          {/* JSX for Scraper Consultant (using consultantUrl, handleAnalyzeWebsite, etc.) */}
          <div>
            <Label
              htmlFor="consultant-url"
              className="text-sm font-medium text-slate-300"
            >
              Target URL
            </Label>
                        <Input 
              id="consultant-url"
              type="url"
              value={consultantUrl}
              onChange={(e) => setConsultantUrl(e.target.value)}
              placeholder="https://example.com/data-page"
              className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400"
              disabled={isAnalyzing}
                        />
                    </div>
          <div>
            <Label
              htmlFor="consultant-data-desc"
              className="text-sm font-medium text-slate-300"
            >
              Data to Extract (Description)
            </Label>
                    <Textarea 
              id="consultant-data-desc"
              value={consultantDataDesc}
              onChange={(e) => setConsultantDataDesc(e.target.value)}
              placeholder="e.g., product names, prices, and availability status"
              className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400 h-24"
              disabled={isAnalyzing}
                    />
                </div>
                        <Button 
            onClick={handleAnalyzeWebsite}
            disabled={isAnalyzing || !consultantUrl}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isAnalyzing
              ? "Analyzing Website..."
              : "Analyze Website for Scraping"}
                        </Button>
          {analysisError && (
            <div className="text-red-400 text-xs p-2 border border-red-700 bg-red-900/30 rounded">
              <p className="font-semibold">Analysis Error:</p>
              <p>{analysisError}</p>
                    </div>
          )}
          {analysisResult && (
            <Card className="mt-4 bg-slate-800/80 border-slate-700 shadow-md">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold text-indigo-300">
                  Scraping Analysis Report
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-1.5">
                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`font-medium ${
                      analysisResult.status === "success"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {analysisResult.status}
                  </span>
                </p>
                <p>
                  <strong>Message:</strong> {analysisResult.message}
                </p>
                <p>
                  <strong>Suggested Method:</strong>{" "}
                  <span className="font-semibold text-purple-300">
                    {analysisResult.suggestedMethod || "N/A"}
                  </span>
                </p>
                {analysisResult.potentialIssues &&
                  analysisResult.potentialIssues.length > 0 && (
                    <div>
                      <strong>Potential Issues:</strong>{" "}
                      <ul className="list-disc list-inside pl-3 text-slate-400">
                        {analysisResult.potentialIssues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                {analysisResult.suggestedSelectors &&
                  Object.keys(analysisResult.suggestedSelectors).length > 0 && (
                    <div>
                      <strong>Suggested Selectors:</strong>{" "}
                      <pre className="bg-slate-900/70 p-2 rounded text-xs overflow-x-auto mt-1 border border-slate-700">
                        {JSON.stringify(
                          analysisResult.suggestedSelectors,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                <Separator className="my-2 bg-slate-600" />
                <p className="text-indigo-400 text-xs font-semibold">
                  Preliminary Check:
                </p>
                <p>
                  Accessible:{" "}
                  {analysisResult.preliminaryCheck?.accessible ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-red-400">No</span>
                  )}
                </p>
                <p>
                  Status Code:{" "}
                  {analysisResult.preliminaryCheck?.statusCode || "N/A"}
                </p>
                <p>
                  Likely Block Page:{" "}
                  {analysisResult.preliminaryCheck?.isLikelyBlockPage ? (
                    <span className="text-yellow-400">
                      Yes (
                      {analysisResult.preliminaryCheck?.blockReason ||
                        "Unknown"}
                      )
                    </span>
                  ) : (
                    "No"
                  )}
                </p>
                {analysisResult.firecrawlCheck?.attempted && (
                  <>
                    <Separator className="my-2 bg-slate-600" />
                    <p className="text-indigo-400 text-xs font-semibold">
                      Firecrawl Check (if attempted):
                    </p>
                    <p>
                      Success:{" "}
                      {analysisResult.firecrawlCheck?.success ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-red-400">No</span>
                      )}
                    </p>
                    {analysisResult.firecrawlCheck?.error && (
                      <p>
                        Error:{" "}
                        <span className="text-red-400">
                          {analysisResult.firecrawlCheck.error}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </CardContent>
              <CardFooter className="pt-3 pb-3">
                <Button
                  onClick={handlePopulateFromAnalysis}
                  variant="outline"
                  size="sm"
                  className="text-indigo-300 border-indigo-600/70 hover:bg-indigo-700/20 hover:text-indigo-200 hover:border-indigo-500 text-xs"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1.5"
                  >
                    <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M4 12a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H4z" />
                  </svg>
                  Populate Main Form from Analysis
                                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      );
    }
    if (tab === "implementation") {
      return (
        <>
          {/* Start of Implementation Consultant UI for Helper Section */}
          <p className="text-sm text-slate-400 mb-3">
            Use this helper to get an AI-driven analysis of the implementation
            strategy for the tool definition currently in the main form.
          </p>
                                <Button 
            onClick={() => handleAnalyzeStrategy(false)}
            disabled={
              isAnalyzingStrategy ||
              !genName ||
              !genDescription ||
              !genExpectedOutput ||
              genInputs.some((p) => !p.name || !p.type || !p.description)
            }
            className="w-full bg-purple-600 hover:bg-purple-700 text-white mb-4"
          >
            {isAnalyzingStrategy
              ? "Analyzing Main Form Strategy..."
              : "Analyze Main Form Strategy"}
                                </Button>

          {/* Display general error from the main analysis call, if not shown by the card and no round yet */}
          {strategyError && !latestConsultationRound && (
            <div className="text-red-400 text-xs p-2 border border-red-700 bg-red-900/30 rounded">
                <p className="font-semibold">Strategy Analysis Error:</p>
                <p>{strategyError}</p>
                            </div>
                        )}

          {/* Reusable card for displaying analysis and refinement options, connected to MAIN state */}
          {latestConsultationRound && (
            <ImplementationStrategyAnalysisCard
                consultationRound={latestConsultationRound}
                strategyError={strategyError} // Main strategy error
                isAnalyzing={isAnalyzingStrategy} // Main analyzing state
                modificationRequests={strategyModificationRequests} // Main modification requests
                onModificationChange={handleStrategyModificationChange} // Main handler
                onAddModification={handleAddStrategyModification} // Main handler
                onRemoveModification={handleRemoveStrategyModification} // Main handler
                onRefineStrategy={() => handleAnalyzeStrategy(true)} // Main handler for refinement
                onAcceptOrPopulate={handleAcceptStrategyAndEnrichContext} // UPDATED HERE
              acceptButtonText={
                isStrategyAccepted
                  ? "Strategy Reviewed"
                  : "Accept Strategy & Proceed"
              }
                refineButtonText="Refine Main Strategy"
                title="Main Form: Strategy Analysis"
                description="Review and refine the strategy based on the main tool definition form."
                cardClassName="bg-slate-800/70 border-slate-700"
                isAccepted={isStrategyAccepted} // Pass accepted state
              exampleTargetPageUrl={exampleTargetPageUrl}
              onExampleTargetPageUrlChange={setExampleTargetPageUrl}
            />
          )}
          {/* End of Implementation Consultant UI for Helper Section */}
        </>
      );
    }
    return null;
  };

  // Add this useEffect to load saved configuration on component mount
  useEffect(() => {
    // Load saved model configuration from localStorage
    try {
      const savedConfig = localStorage.getItem(MODEL_CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as ModelArgs;
        setGenModelArgs(parsedConfig);
      }
    } catch (error) {
      console.error("Failed to load saved model configuration:", error);
    }
  }, []);

  return (
    <div className="p-4 font-sans flex flex-col gap-8 max-w-full mx-auto bg-slate-800 min-h-screen text-slate-200">
      <div className="h-24 w-full" />
      <h1 className="text-3xl font-bold mb-8 text-center text-indigo-300">
        Custom Tool Playground
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-8">
          {!toolRef && !proposedToolRequest && (
            <details open={isQuickStartOpen} onToggle={(e) => setIsQuickStartOpen(e.currentTarget.open)} className="rounded-lg border bg-slate-850 border-slate-700 shadow-md">
              <summary className="list-none cursor-pointer p-4 font-semibold text-indigo-300 flex justify-between items-center">
                <span>{isQuickStartOpen ? '[-] ' : '[+] '}Quick Start: Describe Your Tool</span>
              </summary>
              <div className="p-4 border-t border-slate-700">
            <QuickStartCard
              quickStartName={quickStartName}
              onQuickStartNameChange={setQuickStartName}
              quickStartDesc={quickStartDesc}
              onQuickStartDescChange={setQuickStartDesc}
              quickStartInputs={quickStartInputs}
              onQuickStartInputsChange={setQuickStartInputs}
              quickStartOutputs={quickStartOutputs}
              onQuickStartOutputsChange={setQuickStartOutputs}
              isQuickStarting={isQuickStarting}
              onQuickStart={handleQuickStart}
              quickStartError={quickStartError}
            />
              </div>
            </details>
          )}

          <details open={isToolSelectionOpen} onToggle={(e) => setIsToolSelectionOpen(e.currentTarget.open)} className="rounded-lg border bg-slate-850 border-slate-700 shadow-md">
            <summary className="list-none cursor-pointer p-4 font-semibold text-indigo-300 flex justify-between items-center">
              <span>{isToolSelectionOpen ? '[-] ' : '[+] '}Tool Selection & Execution</span>
            </summary>
            <div className="p-4 border-t border-slate-700">
          <ToolSelectionAndExecutionCard
            userId={userId}
            toolRef={toolRef}
            onToolSelect={handleToolSelect}
            toolList={toolList}
            isListLoading={isListLoading}
            toolListError={toolListError}
            selectedToolDetails={selectedToolDetails}
            isDetailsLoading={isDetailsLoading}
            formValues={formValues}
            onFormChange={handleFormChange}
            onCheckboxChange={handleCheckboxChange}
            isExecuting={isExecuting}
            onExecute={handleExecute}
            isExecutionReady={isExecutionReady || false}
            execError={execError}
            result={result}
            onClearTool={handleClearTool}
            isDisabled={isGeneratingDef || isCreatingTool || isUpdatingTool || isQuickStarting || isRefining || isAnalyzing || isAnalyzingStrategy}
          />
            </div>
          </details>

          <details open={isToolDefinitionOpen} onToggle={(e) => setIsToolDefinitionOpen(e.currentTarget.open)} className="rounded-lg border bg-slate-850 border-slate-700 shadow-md">
            <summary className="list-none cursor-pointer p-4 font-semibold text-indigo-300 flex justify-between items-center">
              <span>{isToolDefinitionOpen ? '[-] ' : '[+] '}Tool Definition & Implementation</span>
            </summary>
            <div className="p-4 border-t border-slate-700">
          <ToolDefinitionCard
            selectedToolDetails={selectedToolDetails}
                genName={genName}
                onGenNameChange={setGenName}
                genPurpose={genPurpose}
                onGenPurposeChange={setGenPurpose}
                genDescription={genDescription}
                onGenDescriptionChange={setGenDescription}
            genModelArgs={genModelArgs}
            onModelProviderChange={handleModelProviderChange}
            onModelNameChange={handleModelNameChange}
            onTemperatureChange={handleTemperatureChange}
            localState={localState}
            genModifications={genModifications}
            onAddModification={handleAddModification}
            onRemoveModification={handleRemoveModification}
            onModificationChange={handleModificationChange}
            genInputs={genInputs}
            onAddParameter={handleAddParameter}
            onRemoveParameter={handleRemoveParameter}
            onParameterChange={handleParameterChange}
            credentialRequirements={credentialRequirements}
            onAddCredentialRequirement={handleAddCredentialRequirement}
            onRemoveCredentialRequirement={handleRemoveCredentialRequirement}
            onCredentialRequirementChange={handleCredentialRequirementChange}
                onSaveCredentialSecret={handleSaveCredentialSecret} // <-- PASS NEW HANDLER
                showCredentialRequirementsSection={
                  showCredentialRequirementsSection
                }
                onToggleCredentialRequirements={
                  setShowCredentialRequirementsSection
                }
            toolRef={toolRef}
            generatedDefinition={generatedDefinition}
                genExpectedOutput={genExpectedOutput}
                onGenExpectedOutputChange={setGenExpectedOutput}
                genCategory={genCategory}
                onGenCategoryChange={setGenCategory}
                genAdditionalContext={genAdditionalContext}
                onGenAdditionalContextChange={setGenAdditionalContext}
                genExamplesJson={genExamplesJson}
                onGenExamplesJsonChange={setGenExamplesJson}
            isGeneratingDef={isGeneratingDef}
            isCreatingTool={isCreatingTool}
            isUpdatingTool={isUpdatingTool}
            isDefinitionFormValid={Boolean(isDefinitionFormValid)}
            canSaveOrUpdate={Boolean(canSaveOrUpdate)}
            hasImplementation={hasImplementation}
            onGenerateImplementation={handleGenerateImplementation}
            onCreateTool={handleCreateTool}
            onUpdateTool={handleUpdateTool}
            onDeleteImplementation={handleDeleteImplementation}
            genDefError={genDefError}
            createToolError={createToolError}
            updateToolError={updateToolError}
            createToolSuccess={createToolSuccess}
            updateToolSuccess={updateToolSuccess}
          />
            </div>
          </details>

          {proposedToolRequest && (
            <details open={isRefineStructureOpen} onToggle={(e) => setIsRefineStructureOpen(e.currentTarget.open)} className="rounded-lg border bg-slate-850 border-slate-700 shadow-md">
              <summary className="list-none cursor-pointer p-4 font-semibold text-indigo-300 flex justify-between items-center">
                <span>{isRefineStructureOpen ? '[-] ' : '[+] '}Refine Tool Structure</span>
              </summary>
              <div className="p-4 border-t border-slate-700">
              <RefineStructureCard
                proposedToolRequest={proposedToolRequest}
                structureModifications={structureModifications}
                onAddStructureModification={handleAddStructureModification}
                onRemoveStructureModification={handleRemoveStructureModification}
                onStructureModificationChange={handleStructureModificationChange}
                isRefining={isRefining}
                onRefineStructure={handleRefineStructure}
                onAcceptStructure={handleAcceptStructure}
                refineError={refineError}
              />
              </div>
            </details>
          )}

          {/* Implementation Consultant UI - this might need its own collapsibility or be part of definition card logic */}
          {latestConsultationRound && !isStrategyAccepted && (
            // This card is already a Card, can be wrapped similarly if desired
            // For now, leaving as is, as it appears conditionally
            <ImplementationStrategyAnalysisCard
              consultationRound={latestConsultationRound}
              strategyError={strategyError}
              isAnalyzing={isAnalyzingStrategy}
              modificationRequests={strategyModificationRequests}
              onModificationChange={handleStrategyModificationChange}
              onAddModification={handleAddStrategyModification}
              onRemoveModification={handleRemoveStrategyModification}
              onRefineStrategy={() => handleAnalyzeStrategy(true)}
              onAcceptOrPopulate={handleAcceptStrategyAndEnrichContext}
              isAccepted={isStrategyAccepted}
              exampleTargetPageUrl={exampleTargetPageUrl}
              onExampleTargetPageUrlChange={setExampleTargetPageUrl}
            />
          )}
          {isStrategyAccepted &&
            latestConsultationRound &&
            !generatedDefinition?.implementation && (
              <div className="mt-4 p-3 rounded border border-yellow-600 bg-yellow-900/30 text-yellow-300 text-sm">
                Strategy accepted (Type:{" "}
                {latestConsultationRound.analysis.recommendedType}). Click
                "Generate/Regenerate Implementation" to create the code.
                            </div>
                        )}
          {isStrategyAccepted &&
            latestConsultationRound &&
            generatedDefinition?.implementation &&
            generatedDefinition.implementation !== "// Generating..." && (
                <div className="mt-4 p-3 rounded border border-green-700 bg-green-900/30 text-green-300 text-sm">
                Strategy previously accepted (Type:{" "}
                {latestConsultationRound.analysis.recommendedType}).
                Implementation has been generated. You can refine or save the
                tool.
                            </div>
                        )}
          {isAnalyzingStrategy && (
            <p className="text-yellow-400 mt-4">Analyzing strategy...</p>
          )}
          {isGeneratingDef &&
            (!generatedDefinition ||
              generatedDefinition.implementation === "// Generating...") && (
              <p className="text-yellow-400 mt-4">
                Generating implementation...
              </p>
            )}

          <div className="lg:hidden mt-8">
            <details open={isMobileHelpersOpen} onToggle={(e) => setIsMobileHelpersOpen(e.currentTarget.open)} className="rounded-lg border bg-slate-850 border-slate-700 shadow-md">
              <summary className="list-none cursor-pointer p-4 font-semibold text-indigo-300 flex justify-between items-center">
                <span>{isMobileHelpersOpen ? '[-] ' : '[+] '}Helpers</span>
              </summary>
              <div className="p-4 border-t border-slate-700">
            <HelpersCard
              activeTab={activeHelperTab}
              onTabChange={setActiveHelperTab}
                  renderTabContent={renderHelperTabContent}
            />
              </div>
            </details>
                    </div>
        </div>

        <div className="lg:col-span-4 space-y-8 hidden lg:block">
          <details open={isHelpersOpen} onToggle={(e) => setIsHelpersOpen(e.currentTarget.open)} className="rounded-lg border bg-slate-850 border-slate-700 shadow-md sticky top-28">
            <summary className="list-none cursor-pointer p-4 font-semibold text-indigo-300 flex justify-between items-center">
              <span>{isHelpersOpen ? '[-] ' : '[+] '}Helpers</span>
            </summary>
            <div className="p-4 border-t border-slate-700">
          <HelpersCard
            activeTab={activeHelperTab}
            onTabChange={setActiveHelperTab}
                className="transition-all hover:shadow-indigo-900/20 hover:shadow-lg" // ClassName was on HelpersCard, check if still needed
                renderTabContent={renderHelperTabContent}
          />
        </div>
          </details>
      </div>
      </div>
    </div>
  );
}
