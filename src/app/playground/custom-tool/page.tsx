"use client"; // This needs to be a client component

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Keep for maybe showing raw JSON if needed
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Use Card for layout
import { ToolRequest, ToolInputParameter, ModelArgs, ModelProviderEnum, ModelNames } from '@/src/lib/types'; // Import ToolRequest type and ModelArgs
import { ModelProviderSelect } from '@/components/global/model-provider-select'; // Import the component
import { AISessionState } from '@/src/lib/types';
import { UTILS_updateModelNameAfterProviderChange } from '@/src/lib/utils';

import { ToolListItem, ToolDefinitionResponse, ToolExecutionResponse, ToolCreationResponse, ToolDetails, GeneratedToolDefinition } from '@/src/app/api/playground/custom-tool/types'; // Assuming types are defined here or imported
import { useAnalysisStore } from '@/src/lib/store/analysis-store';
import { MODEL_JSON, UTILS_getModelArgsByName } from '@/src/lib/utils';
import { z } from 'zod'; // Import z for schema definition in helper

// --- Adapter Functions ---
const adaptProviderToEnumCase = (provider: ModelProviderEnum): string => {
    // Map Enum type to the string value the component SelectItem expects (UPPERCASE)
    return String(provider).toUpperCase(); // Convert enum member name/value to UPPERCASE string
};

// --- End Adapter Functions ---

export default function CustomToolPage() {
  // --- Access Zustand State ---
  const { localState, setLocalState } = useAnalysisStore();
  const userId = localState.userId;
  // --- End Access Zustand State ---

  // --- State for Tool Execution Section ---
  const [toolRef, setToolRef] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null); // Renamed for clarity
  const [isExecuting, setIsExecuting] = useState<boolean>(false); // Renamed for clarity
  const [toolList, setToolList] = useState<ToolListItem[]>([]);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [selectedToolDetails, setSelectedToolDetails] = useState<ToolDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [toolListError, setToolListError] = useState<string | null>(null); // Use a dedicated state for list errors
  const [canExecute, setCanExecute] = useState<boolean>(false); // <-- New state for button disable logic

  // --- State for Definition Generation Section ---
  const [genName, setGenName] = useState<string>('');
  const [genDescription, setGenDescription] = useState<string>('');
  const [genPurpose, setGenPurpose] = useState<string>('');
  const [genModifications, setGenModifications] = useState<string[]>([])
  const [genInputs, setGenInputs] = useState<ToolInputParameter[]>([]); // ADD: State for structured inputs
  const [genExpectedOutput, setGenExpectedOutput] = useState<string>('');
  const [genCategory, setGenCategory] = useState<string>(''); // Optional
  const [genAdditionalContext, setGenAdditionalContext] = useState<string>(''); // Optional
  const [genExamplesJson, setGenExamplesJson] = useState<string>('[]'); // Optional
  const [isGeneratingDef, setIsGeneratingDef] = useState<boolean>(false);
  const [genDefError, setGenDefError] = useState<string | null>(null);
  const [generatedDefinition, setGeneratedDefinition] = useState<GeneratedToolDefinition | null>(null);

   // --- State for Tool Creation Section ---
   // Reuses most state from Definition Generation section
   const [isCreatingTool, setIsCreatingTool] = useState<boolean>(false);
   const [createToolError, setCreateToolError] = useState<string | null>(null);
   const [createToolSuccess, setCreateToolSuccess] = useState<string | null>(null);
   const [isUpdatingTool, setIsUpdatingTool] = useState<boolean>(false); // New state for update
   const [updateToolError, setUpdateToolError] = useState<string | null>(null); // New state for update error
   const [updateToolSuccess, setUpdateToolSuccess] = useState<string | null>(null); // New state for update success

  // --- State for Quick Start Section ---
  const [quickStartName, setQuickStartName] = useState<string>('');
  const [quickStartDesc, setQuickStartDesc] = useState<string>('');
  const [quickStartInputs, setQuickStartInputs] = useState<string>(''); // Simple string input for now
  const [quickStartOutputs, setQuickStartOutputs] = useState<string>(''); // Simple string input for now
  const [isQuickStarting, setIsQuickStarting] = useState<boolean>(false);
  const [quickStartError, setQuickStartError] = useState<string | null>(null);

  // --- State for Structure Refinement ---
  const [proposedToolRequest, setProposedToolRequest] = useState<ToolRequest | null>(null);
  const [structureModifications, setStructureModifications] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refineError, setRefineError] = useState<string | null>(null);

 

  // --- Restore ModelArgs STATE ---
  const [genModelArgs, setGenModelArgs] = useState<ModelArgs>(UTILS_getModelArgsByName(MODEL_JSON().OpenAI['gpt-4.5-preview'].name));

  // Fetch the tool list on component mount
  useEffect(() => {
    // Clear previous list error when userId changes or component mounts
    setToolListError(null);

    if (!userId) {
      // User ID isn't ready yet. Don't fetch, don't set an error.
      // The loading state might still be true initially, or set to false
      // if we know userId is definitively missing (e.g., not logged in).
      // For simplicity, we'll just prevent the fetch.
      setIsListLoading(false); // Indicate we're not actively loading *tools*
      setToolList([]);      // Ensure list is empty
      console.log("User ID not available yet, skipping tool list fetch.");
      return; // Stop the effect execution here
    }

    // If we reach here, userId is available, proceed with fetching.
    const fetchTools = async () => {
      setIsListLoading(true);
      setToolListError(null); // Clear previous list errors before new fetch
      // setExecError(null); // Keep execError separate for execution attempts
      try {
        const response = await fetch(`/api/playground/list-custom-tools?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ error: `Failed to fetch tool list: ${response.statusText}` }));
             throw new Error(errorData.error || `Failed to fetch tool list: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.tools || !Array.isArray(data.tools)) throw new Error("Invalid tool list format received from API.");
        setToolList(data.tools);
      } catch (err) {
        console.error("Error fetching tool list:", err);
        // Use the dedicated state for list errors
        setToolListError(err instanceof Error ? err.message : 'Failed to load tool list.');
        setToolList([]); // Clear list on error
      } finally {
        setIsListLoading(false);
      }
    };

    fetchTools();
  }, [userId]); // Dependency remains on userId

  // Fetch tool details when toolRef changes
  useEffect(() => {
    const fetchToolDetails = async () => {
      // Keep this clear for when generating NEW definitions later
      // setGeneratedDefinition(null); // <-- Keep this if you want generation to override loaded view
                                      // OR set based on fetched data below

      // ... other state clears ...

      if (!toolRef || toolRef === "placeholder" || toolRef === "no-tools") {
        setSelectedToolDetails(null); setFormValues({});
        // Reset generator form when no tool is selected
        setGenName(''); setGenDescription(''); setGenPurpose('');
        setGenInputs([]); setGenExpectedOutput('');
        setGenCategory(''); setGenAdditionalContext(''); setGenExamplesJson('[]');
        setGeneratedDefinition(null); // Clear implementation view too
        return;
      }

      if (!userId) { // Check if userId is available
          setExecError("User ID not found. Cannot load tool details.");
          setIsDetailsLoading(false);
          setSelectedToolDetails(null); setFormValues({});
          // Also reset generator form
          setGenName(''); setGenDescription(''); setGenPurpose('');
          setGenInputs([]); setGenExpectedOutput('');
          setGenCategory(''); setGenAdditionalContext(''); setGenExamplesJson('[]');
          setGeneratedDefinition(null);
          return;
      }

      let toolId: string = ''; // <<< Declare toolId here

      setIsDetailsLoading(true); setExecError(null); setFormValues({}); setSelectedToolDetails(null);
      try {
        // --- Extract toolId ---
        if (toolRef.includes(':')) {
            toolId = toolRef.split(':')[1];
        } else {
            // Handle case where toolRef might not have the expected format (log or throw error)
            console.warn(`Tool reference '${toolRef}' might not be in the expected CUSTOM_TOOL:id format.`);
            toolId = toolRef; // Or handle as an error
        }
        // --- End extraction ---

        const response = await fetch(`/api/playground/tool-details?id=${encodeURIComponent(toolId)}&userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({ error: `Failed to fetch details: ${response.statusText}` }));
           throw new Error(errorData.error || `Failed to fetch details: ${response.statusText}`);
        }
        const data: ToolDetails = await response.json();
        console.log('<<< RAW API Response for Tool Details: >>>', data); // <-- ADD CONSOLE LOG

        // --- REVISED PARAMETER PARSING & VALIDATION --- 
        let parsedInputs: any[] = []; // Start with any[] for parsing flexibility
        if (data.parameters) {
            if (typeof data.parameters === 'string') {
                try {
                    parsedInputs = JSON.parse(data.parameters);
                    if (!Array.isArray(parsedInputs)) {
                         console.warn("Parsed parameters string did not result in an array.");
                         parsedInputs = []; // Default to empty if parse result isn't array
                    }
                } catch (e) {
                    console.error("Failed to parse parameters JSON string:", e);
                    // Don't throw here, just proceed with empty array
                    parsedInputs = []; 
                }
            } else if (Array.isArray(data.parameters)) {
                // It's already an array, use it directly
                parsedInputs = data.parameters;
            } else {
                console.warn("Parameters field is neither a string nor an array.");
                parsedInputs = []; // Default to empty array if unexpected type
            }
        }

        // Now validate the parsedInputs array (which should be an array or [])
        const validParameterTypes = ["string", "number", "boolean", "array", "object"];
        const validatedInputs = parsedInputs.map((param): ToolInputParameter => {
             // Ensure param is an object before accessing properties
             if (typeof param !== 'object' || param === null) {
                console.warn("Encountered non-object item during parameter validation, skipping.");
                // Return a default valid structure or handle as error? For now, default.
                return { name: 'parse_error', type: 'string', description: 'Invalid parameter structure found', required: false }; 
            }
            const paramType = typeof param.type === 'string' && validParameterTypes.includes(param.type) 
                ? param.type as ToolInputParameter['type'] 
                : 'string'; 
            return {
                // Provide fallbacks for potentially missing properties
                name: param.name || 'unnamed_param',
                type: paramType, 
                description: param.description || '',
                required: param.required ?? true,
                default: param.default // Keep default as is
            };
        });
        setGenInputs(validatedInputs);
        // --- END REVISED LOGIC ---

        setSelectedToolDetails({ ...data, parameters: validatedInputs });

        // --- Populate Generator Form Fields ---
        setGenName(data.name || '');
        setGenDescription(data.description || '');
        setGenPurpose(data.purpose || '');
        setGenExpectedOutput(data.expectedOutput || '');
        setGenCategory(data.metadata?.category || '');
        setGenAdditionalContext(data.metadata?.additionalContext || '');
        setGenExamplesJson(JSON.stringify(data.metadata?.examples || [], null, 2));

        // --- FIX START: Populate implementation display state ---
        if (data.implementation) {
            // Set the state used for displaying the implementation code
            setGeneratedDefinition({
                name: data.name || '', // Populate with fetched data
                description: data.description || '',
                parameters: validatedInputs, // Use 'parameters' key
                expectedOutput: data.expectedOutput || '',
                implementation: data.implementation // The fetched code
            });
        } else {
             // Clear display if no implementation was fetched
             setGeneratedDefinition(null);
        }
        // --- FIX END ---

        // Initialize execution form values
        const initialValues: Record<string, any> = {};
        // Use validatedInputs here as well for consistency
        validatedInputs.forEach(param => { initialValues[param.name] = param.type === 'boolean' ? (param.default ?? false) : (param.default ?? ''); });
        setFormValues(initialValues);

      } catch (err) {
        console.error(`Error fetching details for tool ${toolId || toolRef}:`, err); // Use toolId or fallback to toolRef
        setExecError(err instanceof Error ? err.message : `Failed to load details for ${toolRef}.`);
        setSelectedToolDetails(null);
        setFormValues({});
        // Clear generator form on error too
        setGenName(''); setGenDescription(''); setGenPurpose('');
        setGenInputs([]); setGenExpectedOutput('');
        setGenCategory(''); setGenAdditionalContext(''); setGenExamplesJson('[]');
        setGeneratedDefinition(null); // Clear implementation on error too
      } finally {
        setIsDetailsLoading(false);
      }
    };

    fetchToolDetails();
  }, [toolRef, userId]); // Re-run when toolRef changes

  // --- NEW EFFECT: Check if execution is possible based on required args ---
  useEffect(() => {
    if (!selectedToolDetails || !selectedToolDetails.parameters || selectedToolDetails.parameters.length === 0) {
        // If no tool is selected or it has no parameters, execution is technically possible (or N/A)
        setCanExecute(true);
        return;
    }

    // Check if all required parameters have a non-empty value
    const allRequiredFilled = selectedToolDetails.parameters.every(param => {
        // Parameter is considered optional if required is explicitly false
        const isRequired = param.required !== false;
        if (!isRequired) {
            return true; // Optional parameters don't block execution
        }

        const value = formValues[param.name];

        // Check for empty: null, undefined, empty string. Allow 0 for numbers and false for booleans.
        if (value === null || value === undefined || value === '') {
            return false; // Required parameter is empty
        }

        return true; // Required parameter has a value
    });

    setCanExecute(allRequiredFilled);

  }, [formValues, selectedToolDetails]); // Re-run when form values or selected tool details change
  // --- END NEW EFFECT ---

  // Generic handler for input changes in the dynamic form
  const handleFormChange = useCallback((paramName: string, value: any, type: string) => {
    setFormValues(prev => ({
      ...prev,
      [paramName]: type === 'number' ? Number(value) || 0 : value // Handle number conversion
    }));
  }, []);

   // Handler for checkbox changes
   const handleCheckboxChange = useCallback((paramName: string, checked: boolean | 'indeterminate') => {
    // Ensure checked is a boolean
    const booleanChecked = typeof checked === 'boolean' ? checked : false;
    setFormValues(prev => ({
        ...prev,
        [paramName]: booleanChecked
    }));
   }, []);

   // --- ADD HANDLER FUNCTIONS FOR DYNAMIC INPUTS START ---
    const handleAddParameter = useCallback(() => {
        setGenInputs(prev => [...prev, { name: '', type: 'string', description: '', required: true }]);
    }, []);

    const handleRemoveParameter = useCallback((index: number) => {
        setGenInputs(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleParameterChange = useCallback((index: number, field: keyof ToolInputParameter, value: any) => {
        setGenInputs(prev => {
            const newInputs = [...prev];
            const itemToUpdate = { ...newInputs[index] }; // Create a copy
            // Type assertion needed because field is keyof ToolInputParameter
            (itemToUpdate as any)[field] = value;
            newInputs[index] = itemToUpdate;
            return newInputs;
        });
    }, []);
   // --- ADD HANDLER FUNCTIONS FOR DYNAMIC INPUTS END ---

   // --- ADD HANDLER FUNCTIONS FOR MODIFICATIONS START ---
   const handleAddModification = useCallback(() => {
       setGenModifications(prev => [...prev, '']); // Add empty string for new input
   }, []);

   const handleRemoveModification = useCallback((index: number) => {
       setGenModifications(prev => prev.filter((_, i) => i !== index));
   }, []);

   const handleModificationChange = useCallback((index: number, value: string) => {
       setGenModifications(prev => {
           const newMods = [...prev];
           newMods[index] = value;
           return newMods;
       });
   }, []);
  // --- ADD HANDLER FUNCTIONS FOR MODIFICATIONS END ---

  // --- ADD HANDLER FUNCTIONS FOR STRUCTURE MODIFICATIONS START ---
  const handleAddStructureModification = useCallback(() => {
    setStructureModifications(prev => [...prev, '']); // Add empty string
  }, []);

  const handleRemoveStructureModification = useCallback((index: number) => {
      setStructureModifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStructureModificationChange = useCallback((index: number, value: string) => {
      setStructureModifications(prev => {
          const newMods = [...prev];
          newMods[index] = value;
          return newMods;
      });
  }, []);
  // --- ADD HANDLER FUNCTIONS FOR STRUCTURE MODIFICATIONS END ---

  const handleExecute = async () => {
    if (!userId || !canExecute) return; // Added !canExecute check
    setIsExecuting(true);
    setExecError(null);
    setResult(null);

    if (!selectedToolDetails) {
         setExecError("No tool details loaded to execute.");
         setIsExecuting(false);
            return;
        }

    try {
      // Use the formValues state directly
      const argsToSend = { ...formValues };

      // Optional: Convert empty strings for numbers back to undefined or handle as needed by API
      selectedToolDetails.parameters.forEach(param => {
          if (param.type === 'number' && argsToSend[param.name] === '') {
               // Decide how to handle empty number fields: send 0, undefined, or keep as ''?
               // Let's send undefined if not required, otherwise it might fail validation later
               if(param.required !== true) {
                   delete argsToSend[param.name];
               } else {
                   // Or potentially set to 0, depends on tool logic
                   argsToSend[param.name] = 0;
               }
          }
      });


      const response = await fetch('/api/playground/custom-tool', { // Ensure this API route exists
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userId, // Add userId
            toolRef,
            toolArgs: argsToSend
        }), // Send structured form values
      });
      const data = await response.json();
      if (!response.ok) {
        setExecError(data.error || `Request failed with status ${response.status}`);
        if(data.details) console.error("Validation Details:", data.details);
      } else {
        setResult(JSON.stringify(data.result, null, 2));
      }
    } catch (err) {
      console.error("API call failed:", err);
      setExecError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToolSelect = (value: string) => {
      if (value === "no-tools" || value === "placeholder") {
          setToolRef(''); // Clear ref if placeholder selected
          return;
      };
      setToolRef(value);
      setExecError(null);
      setResult(null); // Clear errors/results on new selection
  };

  // --- Restore ModelProviderSelect Handlers ---
  const handleModelProviderChange = useCallback((providerEnumFromComponent: string) => {
    // The component callback gives the string value from the SelectItem,
    // which corresponds to the enum member's string value (UPPERCASE)
    const providerEnum = providerEnumFromComponent as ModelProviderEnum; // Cast the received string value to the enum type
    const newModelName = UTILS_updateModelNameAfterProviderChange(providerEnum);

    setGenModelArgs(prevArgs => ({
        ...prevArgs,
        provider: providerEnum, // Update state with the actual Enum type
        modelName: newModelName as ModelNames,
    }));
  }, []);

  const handleModelNameChange = useCallback((modelName: string) => {
      setGenModelArgs(prevArgs => ({
          ...prevArgs,
          modelName: modelName as ModelNames,
      }));
  }, []);

  const handleTemperatureChange = useCallback((temperature: number) => {
      setGenModelArgs(prevArgs => ({
          ...prevArgs,
          temperature: temperature,
      }));
  }, []);

  // --- NEW HELPER: Build Payload for Save/Update ---
  // Defines the structure expected by the simplified Create/Update endpoints
  const savePayloadSchema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      inputs: z.array(z.object({
          name: z.string(), type: z.enum(["string", "number", "boolean", "array", "object"]),
          description: z.string(), required: z.boolean().optional(), default: z.any().optional()
      })),
      implementation: z.string().min(1), // Implementation is required
      purpose: z.string().optional(),
      expectedOutput: z.string().optional(),
      category: z.string().optional(),
      additionalContext: z.string().optional(),
      examples: z.array(z.object({ input: z.record(z.any()), output: z.any() })).optional(),
  });
  type SavePayload = z.infer<typeof savePayloadSchema>;

  const buildSavePayload = (): SavePayload | null => {
      const currentImplementation = generatedDefinition?.implementation;
      if (!currentImplementation) {
          const errorMsg = "No implementation code generated or loaded. Please generate or load an implementation first.";
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          return null;
      }

      // Validate basic required fields from form state
      if (!genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description)) {
          const errorMsg = "Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required before saving.";
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          return null;
      }

      let examplesData: any[] | undefined = undefined;
      try {
          const parsedExamples = JSON.parse(genExamplesJson);
          if (Array.isArray(parsedExamples)) { examplesData = parsedExamples; }
      } catch (e) { console.warn("Could not parse examples JSON for save payload."); }

      const payload: SavePayload = {
          name: genName,
          description: genDescription,
          inputs: genInputs,
          implementation: currentImplementation, // Include the implementation
          purpose: genPurpose || genDescription,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
          examples: examplesData,
      };

      // Validate the constructed payload
      const validationResult = savePayloadSchema.safeParse(payload);
      if (!validationResult.success) {
          const errorMsg = "Payload validation failed before saving: " + JSON.stringify(validationResult.error.flatten());
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          console.error("Save Payload Validation Error:", validationResult.error.flatten());
          return null;
      }

      return validationResult.data; // Return the validated data
  }

  // --- REFACTORED: Save as New Tool ---
  const handleCreateTool = async () => {
      if (!userId) { setCreateToolError("User ID not found."); return; }
      setIsCreatingTool(true); setCreateToolError(null); setCreateToolSuccess(null);
      setGenDefError(null); setUpdateToolError(null); setUpdateToolSuccess(null); // Clear other statuses

      const savePayload = buildSavePayload();
      if (!savePayload) {
          setIsCreatingTool(false);
          return; // Error already set by buildSavePayload
      }

      const finalPayload = { ...savePayload, userId: userId }; // Add userId for the API

      try {
          const response = await fetch('/api/playground/create-tool', { // Uses the direct create route
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(finalPayload),
          });
          const data = await response.json();
          if (!response.ok) {
              setCreateToolError(data.error || `Request failed: ${response.status}`);
              if (data.details) console.error("Validation:", data.details);
          } else {
              setCreateToolSuccess(data.message || 'Tool created successfully!');
              setGeneratedDefinition(data.definition); // API returns the saved definition
               // Optionally refresh tool list or select the new tool
               // await fetchTools(); // Consider adding a fetchTools call here if needed
               setToolRef(data.toolRef); // Select the newly created tool
          }
      } catch (err) { setCreateToolError(err instanceof Error ? err.message : 'API call failed.'); }
      finally { setIsCreatingTool(false); }
  };

  // --- REFACTORED: Save Updates to Selected Tool ---
  const handleUpdateTool = async () => {
      if (!toolRef || toolRef === "placeholder" || toolRef === "no-tools") { setUpdateToolError("No existing tool selected."); return; }
      if (!userId) { setUpdateToolError("User ID not found."); return; }
      setIsUpdatingTool(true); setUpdateToolError(null); setUpdateToolSuccess(null);
      setGenDefError(null); setCreateToolError(null); setCreateToolSuccess(null); // Clear other statuses

      const savePayload = buildSavePayload();
      if (!savePayload) {
          setIsUpdatingTool(false);
          return; // Error already set by buildSavePayload
      }

      const finalPayload = { ...savePayload, userId: userId }; // Add userId for the API

      try {
          const response = await fetch(`/api/playground/update-tool?ref=${encodeURIComponent(toolRef)}`, { // Uses the direct update route
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(finalPayload),
          });
          const data = await response.json();
          if (!response.ok) {
              setUpdateToolError(data.error || `Req failed: ${response.status}`);
              if (data.details) console.error("Validation:", data.details);
          } else {
              setUpdateToolSuccess(data.message || 'Tool updated!');
              setGeneratedDefinition(data.definition); // API returns the updated definition
               // Form fields are already updated via state, refresh if needed
               // Consider re-fetching details if API doesn't return full new state
          }
      } catch (err) { setUpdateToolError(err instanceof Error ? err.message : 'API call failed.'); }
      finally { setIsUpdatingTool(false); }
  };

  // --- NEW HANDLER: Quick Start Tool --- 
  const handleQuickStart = async () => {
      if (!userId) { setQuickStartError("User ID not found."); return; } // Check userId
      setIsQuickStarting(true);
      setQuickStartError(null);
      // Clear main form potentially?
      // setGenName(''); setGenDescription(''); setGenPurpose('');
      // setGenInputs([]); setGenExpectedOutput('');
      // setGenModifications([]);
      setGeneratedDefinition(null);
      setGenDefError(null); setCreateToolError(null); setUpdateToolError(null);

      // Basic validation
      if (!quickStartName || !quickStartDesc || !quickStartInputs || !quickStartOutputs) {
          setQuickStartError("Please fill in all Quick Start fields.");
          setIsQuickStarting(false);
          return;
      }

      const quickRequestData = {
          userId: userId, // **** MODIFIED: Add userId ****
          toolName: quickStartName,
          toolDescription: quickStartDesc,
          suggestedInputs: quickStartInputs.split('\n').map(s => s.trim()).filter(Boolean), // Split by newline
          suggestedOutputs: quickStartOutputs.split('\n').map(s => s.trim()).filter(Boolean), // Split by newline
          // toolGroup could be added if needed
      };

      try {
          const response = await fetch('/api/playground/quick-start-tool', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(quickRequestData),
          });
          const data = await response.json();

          if (!response.ok) {
              setQuickStartError(data.error || `Request failed: ${response.status}`);
          } else if (data.toolRequest) {
              // Populate main form with the generated ToolRequest details
              // const toolReq = data.toolRequest as ToolRequest;
              // setGenName(toolReq.name);
              // setGenDescription(toolReq.description);
              // setGenPurpose(toolReq.purpose || toolReq.description);
              // setGenInputs(Array.isArray(toolReq.inputs) ? toolReq.inputs : []);
              // setGenExpectedOutput(toolReq.expectedOutput);
              
              // --- NEW: Set proposed structure instead of main form ---
              setProposedToolRequest(data.toolRequest as ToolRequest);
              setStructureModifications([]); // Clear old structure mods
              setRefineError(null); // Clear refinement errors
              // Clear main form as we start refinement
              setGenName('');
              setGenDescription('');
              setGenPurpose('');
              setGenInputs([]);
              setGenExpectedOutput('');
              setGenModifications([]);
              setGeneratedDefinition(null);
              // ---------------------------------------------------------

              // Clear quick start form
              setQuickStartName('');
              setQuickStartDesc('');
              setQuickStartInputs('');
              setQuickStartOutputs('');
          } else {
              setQuickStartError("Received unexpected response from server.");
          }
      } catch (err) {
          console.error("Quick Start API call failed:", err);
          setQuickStartError(err instanceof Error ? err.message : 'Quick Start API error.');
      } finally {
          setIsQuickStarting(false);
      }
  };

  // --- NEW HANDLER: Refine Structure ---
  const handleRefineStructure = async () => {
      if (!proposedToolRequest) return; // Should not happen if button is shown
      if (!userId) { setRefineError("User ID not found."); return; } // Check userId

      setIsRefining(true);
      setRefineError(null);

      const payload = {
          userId: userId, // **** MODIFIED: Add userId ****
          currentStructure: proposedToolRequest,
          modifications: structureModifications,
      };

      try {
          const response = await fetch('/api/playground/refine-tool-structure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
          });
          const data = await response.json();

          if (!response.ok) {
              setRefineError(data.error || `Refinement request failed: ${response.status}`);
          } else if (data.refinedToolRequest) {
              // Update the proposed structure with the refined version
              setProposedToolRequest(data.refinedToolRequest as ToolRequest);
              setStructureModifications([]); // Clear mods after successful refinement
          } else {
              setRefineError("Received unexpected response from refinement server.");
          }
      } catch (err) {
          console.error("Refine Structure API call failed:", err);
          setRefineError(err instanceof Error ? err.message : 'Refinement API error.');
      } finally {
          setIsRefining(false);
      }
  };

  // --- NEW HANDLER: Accept Structure ---
  const handleAcceptStructure = () => {
      if (!proposedToolRequest) return; // Should not happen

      // Populate main form with the accepted structure
      setGenName(proposedToolRequest.name);
      setGenDescription(proposedToolRequest.description);
      setGenPurpose(proposedToolRequest.purpose || proposedToolRequest.description);
      setGenInputs(Array.isArray(proposedToolRequest.inputs) ? proposedToolRequest.inputs : []);
      setGenExpectedOutput(proposedToolRequest.expectedOutput);
      
      // Clear refinement state
      setProposedToolRequest(null);
      setStructureModifications([]);
      setRefineError(null);
  };

  // --- NEW HANDLER: Clear Tool / Start Over ---
  const handleClearTool = () => {
      setToolRef('');
      setSelectedToolDetails(null);
      setProposedToolRequest(null);

      // Reset main form
      setGenName('');
      setGenDescription('');
      setGenPurpose('');
      setGenInputs([]);
      setGenExpectedOutput('');
      setGenCategory('');
      setGenAdditionalContext('');
      setGenExamplesJson('[]');
      setGenModifications([]);

      // Reset other states
      setStructureModifications([]);
      setGeneratedDefinition(null);
      setFormValues({});

      // Clear errors
      setExecError(null);
      setGenDefError(null);
      setCreateToolError(null);
      setUpdateToolError(null);
      setQuickStartError(null);
      setRefineError(null);
      setCreateToolSuccess(null); // Also clear success messages
      setUpdateToolSuccess(null);
  };

  // Prepare the model prop for the component, adapting the provider case FOR THE COMPONENT'S VALUE PROP
  // The component's value prop expects the string value of the enum member (UPPERCASE)
  const adaptedModelProp = {
      ...genModelArgs,
      // Use the actual enum value for comparison logic within the component,
      // but ensure the string value passed matches the <SelectItem value="...">
      // The Select's `value` prop needs the string the SelectItem uses.
      provider: String(genModelArgs.provider).toUpperCase() as any // Provide the UPPERCASE string value for the Select prop
  };

  // Prepare the model prop for the component display logic
  const displayModelProp = {
      ...genModelArgs
      // provider is already the correct Enum type needed for internal comparisons
  }

  // Determine if Save/Update buttons should be enabled (requires implementation)
  const hasImplementation = !!generatedDefinition?.implementation;
  const canSaveOrUpdate = hasImplementation && genName && genDescription && genExpectedOutput && !genInputs.some(p => !p.name || !p.type || !p.description);

  // --- REFACTORED: Generate/Regenerate Implementation ---
  const handleGenerateImplementation = async () => {
      if (!userId) { setGenDefError("User ID not found."); return; }
      setIsGeneratingDef(true); setGenDefError(null); setGeneratedDefinition(null); // Clear previous result
      setCreateToolError(null); setCreateToolSuccess(null); setUpdateToolError(null); setUpdateToolSuccess(null); // Clear save status

      // Basic form validation
      if (!genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description)) {
           setGenDefError("Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required.");
           setIsGeneratingDef(false);
           return;
      }

      // Define an explicit type for the payload, including optional 'examples'
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
          modelArgs: any; // Consider defining a more specific type for ModelArgs being sent
          examples?: any[]; // Explicitly add optional examples field
      };

      const payload: GeneratePayload = { // Use the explicit type here
          userId: userId,
          name: genName,
          description: genDescription,
          purpose: genPurpose || genDescription,
          inputs: genInputs,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
          modificationRequests: genModifications,
          implementation: generatedDefinition?.implementation,
          modelArgs: {
              ...genModelArgs,
              provider: String(genModelArgs.provider).toUpperCase()
          }
          // 'examples' will be added below conditionally
      };
       try {
          const parsedExamples = JSON.parse(genExamplesJson);
          if (Array.isArray(parsedExamples)) {
              payload.examples = parsedExamples; // Now TypeScript knows 'examples' is a valid property
          }
      } catch (e) { console.warn("Could not parse examples JSON."); }

      try {
          const response = await fetch('/api/playground/generate-tool-definition', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload), // Send the correctly typed payload
          });
          const data = await response.json();
          if (!response.ok) {
              setGenDefError(data.error || `Request failed: ${response.status}`);
              if (data.details) console.error("Validation:", data.details);
          } else {
              setGeneratedDefinition(data.definition); // Store the full definition + implementation
              // Update form fields with potentially refined structure from AI
              if (data.definition) {
                  setGenName(data.definition.name || genName);
                  setGenDescription(data.definition.description || genDescription);
                  // Use 'parameters' key if API returns that
                  const params = data.definition.parameters || data.definition.inputs;
                  setGenInputs(Array.isArray(params) ? params : genInputs);
                  setGenExpectedOutput(data.definition.expectedOutput || genExpectedOutput);
              }
          }
      } catch (err) { setGenDefError(err instanceof Error ? err.message : 'API call failed.'); }
      finally { setIsGeneratingDef(false); }
  };

  return (
    <div className="p-5 font-sans flex flex-col gap-6 max-w-3xl mx-auto"> {/* Increased max-width */}
    <div className="h-24 w-full"/>
      <h1 className="text-3xl font-bold mb-6 text-center">Custom Tool Playground</h1>

      {/* Section 0: Quick Start - Only show if not loading existing or refining new */}
      {!selectedToolDetails && !proposedToolRequest && (
          <Card>
              <CardHeader>
                  <CardTitle>Quick Start: Define a Tool Concept</CardTitle>
                  <CardDescription>Provide basic details, and the AI will generate a starting structure (name, description, parameters, output) for the tool definition below.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                  <div className="grid w-full items-center gap-1.5">
                      <Label htmlFor="quickStartName">Tool Name Idea</Label>
                      <Input id="quickStartName" value={quickStartName} onChange={(e) => setQuickStartName(e.target.value)} placeholder="e.g., PDF Text Extractor" disabled={isQuickStarting} />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                      <Label htmlFor="quickStartDesc">Brief Description</Label>
                      <Input id="quickStartDesc" value={quickStartDesc} onChange={(e) => setQuickStartDesc(e.target.value)} placeholder="e.g., Extracts all text content from a PDF file" disabled={isQuickStarting} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="grid w-full items-center gap-1.5">
                          <Label htmlFor="quickStartInputs">Suggest Inputs (one per line)</Label>
                          <Textarea id="quickStartInputs" value={quickStartInputs} onChange={(e) => setQuickStartInputs(e.target.value)} placeholder="e.g., pdfFilePath\npageNumber (optional)" rows={3} disabled={isQuickStarting} />
                      </div>
                      <div className="grid w-full items-center gap-1.5">
                          <Label htmlFor="quickStartOutputs">Suggest Outputs (one per line)</Label>
                          <Textarea id="quickStartOutputs" value={quickStartOutputs} onChange={(e) => setQuickStartOutputs(e.target.value)} placeholder="e.g., extractedText (string)\nerrorIfExists (boolean)" rows={3} disabled={isQuickStarting} />
                      </div>
                  </div>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2">
                  <Button onClick={handleQuickStart} disabled={isQuickStarting || !quickStartName || !quickStartDesc || !quickStartInputs || !quickStartOutputs}>
                      {isQuickStarting ? 'Generating Structure...' : 'Generate Tool Structure'}
                  </Button>
                  {quickStartError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Quick Start Error:</strong><pre className="mt-1 text-sm">{quickStartError}</pre></div>}
              </CardFooter>
          </Card>
      )}

      {/* Section 1: Test Existing Tool Execution */}
      <Card>
        <CardHeader>
          <CardTitle>Tool Execution</CardTitle>
          <CardDescription>Select a registered custom tool and provide arguments to test its execution.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
           {/* Tool Selection Dropdown */}
      <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="toolSelect">Select Tool</Label>
                <Select
                    onValueChange={handleToolSelect}
                    value={toolRef || "placeholder"}
                    // Disable if userId is missing OR list is loading
                    disabled={!userId || isListLoading || isExecuting || isGeneratingDef || isCreatingTool || isUpdatingTool}
                >
                    <SelectTrigger id="toolSelect" className="w-full">
                        <SelectValue placeholder={
                            !userId ? "Waiting for User ID..." :
                            (isListLoading ? "Loading tools..." : "Select a tool...")
                        } />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="placeholder" disabled>
                            {!userId ? "Waiting for User ID..." :
                            (isListLoading ? "Loading tools..." : "Select a tool...")}
                        </SelectItem>
                        {/* Only map tools if userId exists and not loading */}
                        {userId && !isListLoading && toolList.length === 0 && <SelectItem value="no-tools" disabled>No custom tools found for user</SelectItem>}
                        {userId && !isListLoading && toolList.map((tool) => ( <SelectItem key={tool.id} value={tool.reference}>{tool.name} <span className="text-xs text-gray-500 ml-2">({tool.reference})</span></SelectItem> ))}
                    </SelectContent>
                </Select>
                {/* Display dedicated list loading error */}
                {toolListError && <p className="text-sm text-red-600 mt-1">{toolListError}</p>}
                {/* Display tool description if available */}
                {selectedToolDetails?.description && <p className="text-sm text-gray-600 mt-1">{selectedToolDetails.description}</p>}
      </div>
            {/* Dynamic Arguments Form Area */}
            {isDetailsLoading && <p className="text-sm text-gray-500">Loading arguments...</p>}
            {selectedToolDetails && !isDetailsLoading && (
              <div className="border border-gray-200 p-4 rounded flex flex-col gap-3">
                  <h3 className="text-md font-semibold">Arguments</h3>
                  {selectedToolDetails.parameters.length === 0 && <p className="text-sm text-gray-500">This tool requires no arguments.</p>}
                  {selectedToolDetails.parameters.map((param) => ( /* Render form fields based on params */
                      <div key={param.name} className="grid w-full items-center gap-1.5">
                           <Label htmlFor={param.name}>{param.description || param.name}{param.required !== false && <span className="text-red-500 ml-1">*</span>}</Label>
                           {param.type === 'string' && <Input type="text" id={param.name} name={param.name} value={formValues[param.name] || ''} onChange={(e) => handleFormChange(param.name, e.target.value, param.type)} placeholder={param.description || param.name} disabled={isExecuting} />}
                           {param.type === 'number' && <Input type="number" id={param.name} name={param.name} value={formValues[param.name] || ''} onChange={(e) => handleFormChange(param.name, e.target.value, param.type)} placeholder={param.description || param.name} disabled={isExecuting} />}
                           {param.type === 'boolean' && <div className="flex items-center space-x-2 mt-1"><Checkbox id={param.name} name={param.name} checked={!!formValues[param.name]} onCheckedChange={(checked) => handleCheckboxChange(param.name, checked)} disabled={isExecuting} /></div>}
                           {param.type !== 'string' && param.type !== 'number' && param.type !== 'boolean' && <p className="text-xs text-orange-500">Unsupported: {param.type}</p>}
      </div>
                  ))}
      </div>
      )}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2">
           <Button onClick={handleExecute} disabled={!userId || isExecuting || !toolRef || toolRef === "placeholder" || isListLoading || isDetailsLoading || !canExecute}>
             {isExecuting ? 'Executing...' : 'Execute Tool'}
           </Button>
            {/* Add a helper text if button is disabled due to missing required fields */}
            {selectedToolDetails && !canExecute && <p className="text-xs text-orange-600">Please fill in all required arguments (*).</p>}
            {/* Execution Error/Result */}
            {execError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Execution Error:</strong><pre className="mt-1 text-sm">{execError}</pre></div>}
            {result && <div className="border border-gray-300 p-3 bg-gray-800 rounded w-full"><strong className="font-semibold">Execution Result:</strong><pre className="mt-1 text-sm whitespace-pre-wrap break-all">{result}</pre></div>}
            {/* Add Clear button if a tool is loaded */} 
            {selectedToolDetails && (
                <Button variant="destructive" size="sm" onClick={handleClearTool} className="mt-4">
                    Clear Tool / Start Over
                </Button>
            )}
        </CardFooter>
      </Card>

      {/* Section 2: Test Definition Generation */}
       <Card>
        <CardHeader>
           <CardTitle>Tool Definition & Implementation</CardTitle>
           <CardDescription>
               Define the tool's structure (name, parameters, etc.) and generate its implementation code.
               Use "Generate/Regenerate Implementation" to create or modify the code below using the selected AI model.
               Once you have the desired implementation, use "Save as New Tool" or "Save Updates" to persist it.
           </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            {/* Inputs for Tool Definition */}
             <div className="grid w-full items-center gap-1.5">
                 <Label htmlFor="genName">Tool Name</Label>
                 <Input id="genName" value={genName} onChange={(e) => setGenName(e.target.value)} placeholder="e.g., SearchClickbank" disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
             </div>
              <div className="grid w-full items-center gap-1.5">
                 <Label htmlFor="genDescription">Tool Description</Label>
                 <Textarea id="genDescription" value={genDescription} onChange={(e) => setGenDescription(e.target.value)} placeholder="e.g., Searches the Clickbank marketplace..." rows={2} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
             </div>
              <div className="grid w-full items-center gap-1.5">
                 <Label htmlFor="genPurpose">Tool Purpose (Optional, helps AI)</Label>
                 <Textarea id="genPurpose" value={genPurpose} onChange={(e) => setGenPurpose(e.target.value)} placeholder="e.g., To find high-gravity affiliate products in a niche." rows={2} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
             </div>

             {/* --- Restore Generation Model Selection --- */}
             <div className="border p-3 rounded-md bg-gray-50/50">
                 <Label className="text-md font-semibold block mb-2">Generation Model</Label>
                 <ModelProviderSelect
                    index={0}
                    localState={localState}
                    model={displayModelProp} // Use this for internal logic if needed
                    modelProviderChanged={handleModelProviderChange}
                    modelNameChanged={handleModelNameChange}
                    temperatureChanged={handleTemperatureChange}
                 />
             </div>

             {/* Keep Modifications Section for USER INPUT ONLY */}
             <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                 <Label className="text-md font-semibold block mb-2">Implementation Modification Requests (Optional)</Label>
                 {genModifications.length === 0 && (
                     <p className="text-xs text-gray-500 italic">Add specific instructions to modify the generated code.</p>
                 )}
                 {genModifications.map((mod, index) => (
                     <div key={index} className="flex items-center gap-2">
                         <Input
                             type="text"
                             value={mod}
                             onChange={(e) => handleModificationChange(index, e.target.value)}
                             placeholder={`Modification request ${index + 1}...`}
                             disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                             className="flex-grow h-8 text-sm"
                         />
                         <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleRemoveModification(index)}
                             disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                             aria-label="Remove modification"
                             className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 shrink-0"
                         >
                             X
                         </Button>
                     </div>
                 ))}
                 <Button 
                     onClick={handleAddModification} 
                     variant="outline"
                     size="sm"
                     disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                     className="text-xs mt-2"
                 >
                     + Add Modification Request
                 </Button>
             </div>

             {/* --- RE-ADD Input Parameters Section --- */}
             <div className="space-y-4 border p-4 rounded-md">
                 <div className="flex justify-between items-center mb-2">
                     <Label className="text-lg font-semibold">Input Parameters</Label>
                     <Button 
                         onClick={handleAddParameter} 
                         variant="outline" 
                         size="sm"
                         disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                     >
                         Add Parameter
                     </Button>
                 </div>
                 
                 {genInputs.length === 0 && (
                     <div className="text-center py-6 text-gray-500">
                         No parameters defined. Click "Add Parameter" to create one.
                     </div>
                 )}
                 
                 {genInputs.length > 0 && (
                     <div className="space-y-2">
                         {/* Table header */}
                         <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded-t-md text-xs font-semibold text-gray-700">
                             <div className="col-span-3">NAME</div>
                             <div className="col-span-2">TYPE</div>
                             <div className="col-span-5">DESCRIPTION</div>
                             <div className="col-span-1 text-center">REQ</div>
                             <div className="col-span-1 text-center"></div>
                         </div>
                         
                         {/* Parameter rows */}
                         {genInputs.map((input, index) => (
                             <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2 border rounded-md items-center hover:bg-gray-50">
                                 {/* Name */}
                                 <div className="col-span-3">
                                     <Input
                                         id={`param-name-${index}`}
                                         value={input.name}
                                         onChange={(e) => handleParameterChange(index, 'name', e.target.value)}
                                         placeholder="parameter_name"
                                         disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                                         className="font-mono text-sm h-8"
                                     />
                                 </div>
                                 
                                 {/* Type */}
                                 <div className="col-span-2">
                                     <Select
                                         value={input.type}
                                         onValueChange={(value) => handleParameterChange(index, 'type', value)}
                                         disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                                     >
                                         <SelectTrigger id={`param-type-${index}`} className="h-8 text-xs">
                                             <SelectValue placeholder="Type" />
                                         </SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="string">string</SelectItem>
                                             <SelectItem value="number">number</SelectItem>
                                             <SelectItem value="boolean">boolean</SelectItem>
                                             <SelectItem value="array">array</SelectItem>
                                             <SelectItem value="object">object</SelectItem>
                                         </SelectContent>
                                     </Select>
                                 </div>
                                 
                                 {/* Description */}
                                 <div className="col-span-5">
                                     <Input
                                         id={`param-desc-${index}`}
                                         value={input.description}
                                         onChange={(e) => handleParameterChange(index, 'description', e.target.value)}
                                         placeholder="Parameter description"
                                         disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                                         className="text-sm h-8"
                                     />
                                 </div>

                                 {/* Required checkbox */}
                                 <div className="col-span-1 flex justify-center">
                                     <Checkbox
                                         id={`param-required-${index}`}
                                         checked={input.required ?? true}
                                         onCheckedChange={(checked) => handleParameterChange(index, 'required', typeof checked === 'boolean' ? checked : true)}
                                         disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                                     />
                                 </div>

                                 {/* Delete button */}
                                 <div className="col-span-1 flex justify-center">
                                     <Button
                                         variant="ghost"
                                         size="sm"
                                         onClick={() => handleRemoveParameter(index)}
                                         disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                                         aria-label="Remove parameter"
                                         className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                                     >
                                         X
                                     </Button>
                                 </div>
                                 
                                 {/* Default value - shown in expandable area or tooltip */}
                                 {/* This could be added in the future if needed */}
                             </div>
                         ))}
                     </div>
                 )}
                 
                 {genInputs.length > 0 && (
                     <div className="flex mt-2">
                         <Button 
                             onClick={handleAddParameter} 
                             variant="outline"
                             size="sm"
                             disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                             className="text-xs"
                         >
                             + Add Parameter
                         </Button>
                     </div>
                 )}
             </div>
             {/* --- END RE-ADD Input Parameters Section --- */}

              <div className="grid w-full items-center gap-1.5">
                 <Label htmlFor="genExpectedOutput">Expected Output Description</Label>
                 <Input id="genExpectedOutput" value={genExpectedOutput} onChange={(e) => setGenExpectedOutput(e.target.value)} placeholder="e.g., A JSON string containing a list of products." disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
      </div>
        </CardContent>
         <CardFooter className="flex flex-col items-start gap-3">
             <div className="flex flex-wrap gap-3"> {/* Use flex-wrap */}
                 <Button onClick={handleGenerateImplementation} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool || !genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description) }>
                     {isGeneratingDef ? 'Generating...' : 'Generate/Regenerate Implementation'}
                 </Button>
                  <Button variant="secondary" onClick={handleCreateTool} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool || !canSaveOrUpdate}>
                     {isCreatingTool ? 'Saving...' : 'Save as New Tool'}
                 </Button>
                 <Button variant="outline" onClick={handleUpdateTool} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool || !selectedToolDetails || !canSaveOrUpdate}>
                     {isUpdatingTool ? 'Saving...' : 'Save Updates to Selected Tool'}
                 </Button>
             </div>
              {/* Display Area for Generation */}
              {genDefError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Generation Error:</strong><pre className="mt-1 text-sm">{genDefError}</pre></div>}
              {createToolError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Creation Error:</strong><pre className="mt-1 text-sm">{createToolError}</pre></div>}
               {createToolSuccess && <div className="text-green-600 border border-green-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Creation Success:</strong><pre className="mt-1 text-sm">{createToolSuccess}</pre></div>}
               {updateToolError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Update Error:</strong><pre className="mt-1 text-sm">{updateToolError}</pre></div>}
               {updateToolSuccess && <div className="text-green-600 border border-green-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Update Success:</strong><pre className="mt-1 text-sm">{updateToolSuccess}</pre></div>}
              {generatedDefinition && (
                 <div className="border border-gray-300 p-3 bg-gray-50 rounded w-full mt-2">
                   <strong className="font-semibold block text-sm mb-1">Current Implementation:</strong>
                   <pre className="mt-1 text-xs whitespace-pre-wrap break-all bg-gray-100 p-2 rounded border border-gray-200 text-gray-800">{generatedDefinition.implementation || "No implementation loaded or generated."}</pre>
                 </div>
              )}
         </CardFooter>
      </Card>

      {/* --- NEW Section: Refine Tool Structure --- */}
      {proposedToolRequest && (
          <Card className="border-blue-300 border-2">
              <CardHeader>
                  <CardTitle className="text-blue-700">Refine Proposed Tool Structure</CardTitle>
                  <CardDescription>Review the proposed structure. Add modification requests to refine it, or accept it to proceed.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                  {/* Display Proposed Structure (Read-only for now) */}
                  <div className="space-y-2 p-3 border rounded bg-white">
                      <h4 className="text-sm font-semibold">Proposed Name: <span className="font-mono text-blue-800">{proposedToolRequest.name}</span></h4>
                      <p className="text-xs text-gray-600"><strong className="font-medium">Description:</strong> {proposedToolRequest.description}</p>
                      <p className="text-xs text-gray-600"><strong className="font-medium">Purpose:</strong> {proposedToolRequest.purpose}</p>
                      <p className="text-xs text-gray-600"><strong className="font-medium">Expected Output:</strong> {proposedToolRequest.expectedOutput}</p>
                      <div>
                          <strong className="font-medium text-xs block mb-1">Parameters:</strong>
                          {proposedToolRequest.inputs.length === 0 ? (
                              <p className="text-xs italic text-gray-500">No parameters proposed.</p>
                          ) : (
                              <ul className="list-disc list-inside space-y-1 pl-2">
                                  {proposedToolRequest.inputs.map((p, i) => (
                                      <li key={i} className="text-xs">
                                          <span className="font-mono font-medium">{p.name}</span> ({p.type}): {p.description} {p.required === false ? '(Optional)' : ''}
                                      </li>
                                  ))}
                              </ul>
                          )}
                      </div>
                  </div>

                  {/* Structure Modifications Input */}
                  <div className="space-y-2 border p-3 rounded-md bg-blue-50">
                      <Label className="text-md font-semibold block mb-2 text-blue-800">Structure Modification Requests (Optional)</Label>
                      {structureModifications.length === 0 && (
                          <p className="text-xs text-gray-500 italic">Add specific instructions to modify the structure above (e.g., "Make the 'pageNumber' parameter optional", "Rename tool to PDF_READER").</p>
                      )}
                      {structureModifications.map((mod, index) => (
                          <div key={`structure-mod-${index}`} className="flex items-center gap-2">
                              <Input
                                  id={`structure-mod-input-${index}`}
                                  type="text"
                                  value={mod}
                                  onChange={(e) => handleStructureModificationChange(index, e.target.value)}
                                  placeholder={`Structure modification ${index + 1}...`}
                                  disabled={isRefining}
                                  className="flex-grow h-8 text-sm"
                              />
                              <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveStructureModification(index)}
                                  disabled={isRefining}
                                  aria-label="Remove structure modification"
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 shrink-0"
                              >
                                  X
                              </Button>
                          </div>
                      ))}
                      <Button 
                          onClick={handleAddStructureModification} 
                          variant="outline"
                          size="sm"
                          disabled={isRefining}
                          className="text-xs mt-2"
                      >
                          + Add Structure Modification
                      </Button>
                  </div>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2">
                  <div className="flex gap-3">
                      <Button onClick={handleRefineStructure} disabled={isRefining || structureModifications.length === 0}>
                          {isRefining ? 'Refining...' : 'Refine Structure'}
                      </Button>
                      <Button variant="secondary" onClick={handleAcceptStructure} disabled={isRefining}>
                          Accept Structure & Proceed
                      </Button>
                      {/* Add Clear button during refinement */} 
                      <Button variant="destructive" size="sm" onClick={handleClearTool} className="ml-auto">
                           Clear / Start Over
                      </Button>
                  </div>
                  {refineError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Refinement Error:</strong><pre className="mt-1 text-sm">{refineError}</pre></div>}
              </CardFooter>
          </Card>
      )}
      {/* --- END Section: Refine Tool Structure --- */}

    </div> // End main container
  );
}

