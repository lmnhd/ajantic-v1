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
import { AnalysisResult } from '../../api/playground/analyze-scraping/_types';
import { Separator } from '@/components/ui/separator'; // Import Separator for visual division
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea for results
import {
    ConsultationRequest,
    ConsultationResponse,
    ConsultationHistory,
    ConsultationRound,
} from '@/src/app/api/playground/analyze-implementation-strategy/_types'; // Adjust path if needed
// Import the specific schema used in the API route's type definition
import { consultationRequestSchema, toolRequestSchema as apiToolRequestSchema } from '@/src/app/api/playground/analyze-implementation-strategy/_types';
import { v4 as uuidv4 } from 'uuid'; // For unique IDs
import QuickStartCard from '@/components/custom-tools/QuickStartCard';
import ToolSelectionAndExecutionCard from '@/components/custom-tools/ToolSelectionAndExecutionCard';
import ToolDefinitionCard from '@/components/custom-tools/ToolDefinitionCard';
import RefineStructureCard from '@/components/custom-tools/RefineStructureCard';
import { HelpersCard } from '@/components/custom-tools/HelpersCard';
import ImplementationStrategyAnalysisCard from '@/components/custom-tools/ImplementationStrategyAnalysisCard';

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


export default function CustomToolPage() {
  // --- Access Zustand State ---
  const { localState, setLocalState } = useAnalysisStore();
  const userId = localState.userId;
  // --- End Access Zustand State ---

  // --- State for Tool Execution Section ---
  const [toolRef, setToolRef] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [toolList, setToolList] = useState<ToolListItem[]>([]);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [selectedToolDetails, setSelectedToolDetails] = useState<ToolDetails | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [toolListError, setToolListError] = useState<string | null>(null);
  const [canExecute, setCanExecute] = useState<boolean>(false);

  // --- State for Definition Generation Section ---
  const [genName, setGenName] = useState<string>('');
  const [genDescription, setGenDescription] = useState<string>('');
  const [genPurpose, setGenPurpose] = useState<string>('');
  const [genModifications, setGenModifications] = useState<string[]>([])
  const [genInputs, setGenInputs] = useState<ToolInputParameter[]>([]);
  const [genExpectedOutput, setGenExpectedOutput] = useState<string>('');
  const [genCategory, setGenCategory] = useState<string>('');
  const [genAdditionalContext, setGenAdditionalContext] = useState<string>('');
  const [genExamplesJson, setGenExamplesJson] = useState<string>('[]');
  const [isGeneratingDef, setIsGeneratingDef] = useState<boolean>(false);
  const [genDefError, setGenDefError] = useState<string | null>(null);
  const [generatedDefinition, setGeneratedDefinition] = useState<GeneratedToolDefinition | null>(null);

   // --- State for Tool Creation Section ---
   const [isCreatingTool, setIsCreatingTool] = useState<boolean>(false);
   const [createToolError, setCreateToolError] = useState<string | null>(null);
   const [createToolSuccess, setCreateToolSuccess] = useState<string | null>(null);
   const [isUpdatingTool, setIsUpdatingTool] = useState<boolean>(false);
   const [updateToolError, setUpdateToolError] = useState<string | null>(null);
   const [updateToolSuccess, setUpdateToolSuccess] = useState<string | null>(null);

  // --- State for Quick Start Section ---
  const [quickStartName, setQuickStartName] = useState<string>('');
  const [quickStartDesc, setQuickStartDesc] = useState<string>('');
  const [quickStartInputs, setQuickStartInputs] = useState<string>('');
  const [quickStartOutputs, setQuickStartOutputs] = useState<string>('');
  const [isQuickStarting, setIsQuickStarting] = useState<boolean>(false);
  const [quickStartError, setQuickStartError] = useState<string | null>(null);

  // --- State for Structure Refinement ---
  const [proposedToolRequest, setProposedToolRequest] = useState<ToolRequest | null>(null);
  const [structureModifications, setStructureModifications] = useState<string[]>([]);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  // --- Restore ModelArgs STATE ---
  const [genModelArgs, setGenModelArgs] = useState<ModelArgs>(UTILS_getModelArgsByName(MODEL_JSON().OpenAI['gpt-4.5-preview'].name));

  // --- State for Scraper Consultant ---
  const [consultantUrl, setConsultantUrl] = useState<string>('');
  const [consultantDataDesc, setConsultantDataDesc] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // --- NEW STATE for Implementation Consultant ---
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory>([]);
  const [strategyModificationRequests, setStrategyModificationRequests] = useState<string[]>([]);
  const [isAnalyzingStrategy, setIsAnalyzingStrategy] = useState<boolean>(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [latestConsultationRound, setLatestConsultationRound] = useState<ConsultationRound | null>(null);
  const [isStrategyAccepted, setIsStrategyAccepted] = useState<boolean>(false); // Flag to proceed after analysis
  // --- END NEW STATE ---

  // In your component's state:
  const [credentialRequirements, setCredentialRequirements] = useState<CredentialRequirementInput[]>([]);
  const [showCredentialRequirementsSection, setShowCredentialRequirementsSection] = useState<boolean>(false); // New state

  // When loading an existing tool for editing, you would populate this state
  // based on toolDefinition.requiredCredentialNames and potentially by checking
  // if those credentials already exist for the user (to set isSecretSaved).

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
        setToolListError(err instanceof Error ? err.message : 'Failed to load tool list.');
        setToolList([]);
      } finally {
        setIsListLoading(false);
      }
    };
    fetchTools();
  }, [userId]);

  // Fetch tool details when toolRef changes AND update BOTH Execution & Definition forms
  useEffect(() => {
    const fetchToolDetails = async () => {
      // --- CLEAR ALL STATE if no toolRef ---
      if (!toolRef || toolRef === "placeholder" || toolRef === "no-tools") {
        setSelectedToolDetails(null);
        setFormValues({});
        setGenName('');
        setGenDescription('');
        setGenPurpose('');
        setGenInputs([]);
        setGenExpectedOutput('');
        setGenCategory('');
        setGenAdditionalContext('');
        setGenExamplesJson('[]');
        setGenModifications([]); // Keep modifications? Maybe clear them too.
        setGeneratedDefinition(null);
        setExecError(null); // Clear execution errors too
        setResult(null);
        // Do not clear proposedToolRequest here, handleClearTool does that
        setConsultationHistory([]); // Clear consultant state
        setStrategyModificationRequests([]);
        setLatestConsultationRound(null);
        setStrategyError(null);
        setIsStrategyAccepted(false);
        setCredentialRequirements([]); // Clear credentials
        setShowCredentialRequirementsSection(false); // Hide when no tool loaded
        return;
      }

      // --- FETCH AND POPULATE if toolRef exists ---
      if (!userId) {
          setExecError("User ID not found. Cannot load tool details.");
          setIsDetailsLoading(false);
          // Clear fields if user ID disappears after selection? Maybe not needed.
          return;
      }

      let toolId: string = toolRef.includes(':') ? toolRef.split(':')[1] : toolRef;

      setIsDetailsLoading(true);
      setExecError(null);
      setResult(null);
      setFormValues({}); // Clear execution form values before loading
      setSelectedToolDetails(null); // Clear previous details

      try {
        const response = await fetch(`/api/playground/tool-details?id=${encodeURIComponent(toolId)}&userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({ error: `Failed to fetch details: ${response.statusText}` }));
           throw new Error(errorData.error || `Failed to fetch details: ${response.statusText}`);
        }
        const data: ToolDetails = await response.json();

        // --- Process Parameters (used by both sections) ---
        let parsedParameters: ToolInputParameter[] = [];
         if (data.parameters) {
             if (typeof data.parameters === 'string') {
                 try {
                     const parsed = JSON.parse(data.parameters);
                     if (Array.isArray(parsed)) {
                         const validationResult = z.array(z.object({ name: z.string(), type: z.enum(["string", "number", "boolean", "array", "object"]), description: z.string(), required: z.boolean().optional(), default: z.any().optional() })).safeParse(parsed);
                         if (validationResult.success) parsedParameters = validationResult.data; else console.warn("Parsed parameters string did not match schema.", validationResult.error);
                     } else { console.warn("Parsed parameters string was not an array."); }
                 } catch (e) { console.error("Failed to parse parameters JSON string:", e); }
             } else if (Array.isArray(data.parameters)) {
                 const validationResult = z.array(z.object({ name: z.string(), type: z.enum(["string", "number", "boolean", "array", "object"]), description: z.string(), required: z.boolean().optional(), default: z.any().optional() })).safeParse(data.parameters);
                 if (validationResult.success) parsedParameters = validationResult.data; else console.warn("Parameters array did not match schema.", validationResult.error);
             } else { console.warn("Parameters field is neither a string nor an array."); }
         }
        // --- End Parameter Processing ---

        // --- Set State for Execution Section (Section 1) ---
        setSelectedToolDetails({ ...data, parameters: parsedParameters }); // Store details
        const initialFormValues: Record<string, any> = {};
        parsedParameters.forEach(param => { initialFormValues[param.name] = param.type === 'boolean' ? (param.default ?? false) : (param.default ?? ''); });
        setFormValues(initialFormValues); // Set execution form values

        // --- Set State for Definition Section (Section 2) ---
        setGenName(data.name || '');
        setGenDescription(data.description || '');
        setGenPurpose(data.purpose || '');
        setGenExpectedOutput(data.expectedOutput || '');
        setGenInputs(parsedParameters); // Use the same parsed parameters
        setGenCategory(data.metadata?.category || '');
        setGenAdditionalContext(data.metadata?.additionalContext || '');
        setGenExamplesJson(JSON.stringify(data.metadata?.examples || [], null, 2));
        setGenModifications([]); // Clear modifications when loading a new tool

        if (data.implementation) {
          setGeneratedDefinition({
            name: data.name || '',
            description: data.description || '',
            parameters: parsedParameters,
            expectedOutput: data.expectedOutput || '',
            implementation: data.implementation,
          });
        } else {
          setGeneratedDefinition(null);
        }
        // --- End Setting State for Section 2 ---

        // --- POPULATE CREDENTIAL REQUIREMENTS ---
        if (data.requiredCredentialNames && Array.isArray(data.requiredCredentialNames)) {
          const newCredentialInputs: CredentialRequirementInput[] = data.requiredCredentialNames.map(cred => ({
            id: uuidv4(),
            name: cred.name,
            label: cred.label,
            currentSecretValue: '', // Always clear on load
            isSecretSaved: false // We'll implement checking this later if needed
          }));
          setCredentialRequirements(newCredentialInputs);
        } else {
          setCredentialRequirements([]);
        }
        // --- END POPULATE ---

        if (data.requiredCredentialNames && data.requiredCredentialNames.length > 0) {
          setShowCredentialRequirementsSection(true); // Show if tool has credentials
        } else {
          setCredentialRequirements([]);
          setShowCredentialRequirementsSection(false); // Hide if tool has no credentials
        }

      } catch (err) {
        console.error(`Error fetching details for tool ${toolId || toolRef}:`, err);
        setExecError(err instanceof Error ? err.message : `Failed to load details for ${toolRef}.`);
        // Clear all fields on error
        setSelectedToolDetails(null);
        setFormValues({});
        setGenName(''); setGenDescription(''); setGenPurpose(''); setGenInputs([]);
        setGenExpectedOutput(''); setGenCategory(''); setGenAdditionalContext('');
        setGenExamplesJson('[]'); setGenModifications([]); setGeneratedDefinition(null);
        setCredentialRequirements([]); // Clear on error too
        setShowCredentialRequirementsSection(false); // Hide on error
      } finally {
        setIsDetailsLoading(false);
      }
    };
    fetchToolDetails();
  // Add ALL gen* state variables that are set inside to the dependency array
  // Although technically they are only *set* here, adding them prevents potential
  // stale closure issues if this hook were more complex. React lint rules might require it.
  }, [
      userId, toolRef,
      // Add setters to dependencies is generally safe, but values aren't needed
      // If ESLint complains, add the setters: setGenName, setGenDescription, etc.
  ]);

  // Check if execution is possible based on required args
  useEffect(() => {
    if (!selectedToolDetails || !selectedToolDetails.parameters || selectedToolDetails.parameters.length === 0) {
        setCanExecute(true);
        return;
    }
    const allRequiredFilled = selectedToolDetails.parameters.every(param => {
        const isRequired = param.required !== false;
        if (!isRequired) return true;
        const value = formValues[param.name];
        if (value === null || value === undefined || value === '') return false;
        return true;
    });
    setCanExecute(allRequiredFilled);
  }, [formValues, selectedToolDetails]);

  // Generic handler for input changes in the dynamic form
  const handleFormChange = useCallback((paramName: string, value: any, type: string) => {
    setFormValues(prev => ({
      ...prev,
      [paramName]: type === 'number' ? Number(value) || 0 : value
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
       setGenModifications(prev => [...prev, '']);
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
    setStructureModifications(prev => [...prev, '']);
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

  // --- NEW HANDLER FUNCTIONS FOR STRATEGY MODIFICATIONS START ---
  const handleAddStrategyModification = useCallback(() => {
    setStrategyModificationRequests(prev => [...prev, '']);
  }, []);

  const handleRemoveStrategyModification = useCallback((index: number) => {
      setStrategyModificationRequests(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStrategyModificationChange = useCallback((index: number, value: string) => {
      setStrategyModificationRequests(prev => {
          const newMods = [...prev];
          newMods[index] = value;
          return newMods;
      });
  }, []);
  // --- NEW HANDLER FUNCTIONS FOR STRATEGY MODIFICATIONS END ---

  const handleExecute = async () => {
    if (!userId || !canExecute || !selectedToolDetails) return;
    setIsExecuting(true); setExecError(null); setResult(null);
    try {
      const argsToSend = { ...formValues };
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
      const response = await fetch('/api/playground/custom-tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, toolRef, toolArgs: argsToSend }) });
      const data = await response.json();
      if (!response.ok) setExecError(data.error || `Request failed: ${response.status}`); else setResult(JSON.stringify(data.result, null, 2));
    } catch (err) { setExecError(err instanceof Error ? err.message : 'API error.'); } finally { setIsExecuting(false); }
  };

  const handleToolSelect = useCallback((value: string) => {
      if (value === "no-tools" || value === "placeholder") { setToolRef(''); return; };
      setToolRef(value); setExecError(null); setResult(null);
  }, []);

  // --- Restore ModelProviderSelect Handlers ---
  const handleModelProviderChange = useCallback((providerEnumFromComponent: string) => {
    const providerEnum = providerEnumFromComponent as ModelProviderEnum;
    const newModelName = UTILS_updateModelNameAfterProviderChange(providerEnum);
    setGenModelArgs(prevArgs => ({
        ...prevArgs,
        provider: providerEnum,
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
  const savePayloadSchema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      inputs: z.array(z.object({
          name: z.string(), type: z.enum(["string", "number", "boolean", "array", "object"]),
          description: z.string(), required: z.boolean().optional(), default: z.any().optional()
      })),
      implementation: z.string().min(1),
      purpose: z.string().optional(),
      expectedOutput: z.string().optional(),
      category: z.string().optional(),
      additionalContext: z.string().optional(),
      examples: z.array(z.object({ input: z.record(z.any()), output: z.any() })).optional(),
      requiredCredentialNames: z.array(z.object({ name: z.string().min(1), label: z.string().min(1) })).optional(), // <-- ADDED
  });
  type SavePayload = z.infer<typeof savePayloadSchema>;

  const buildSavePayload = useCallback((): SavePayload | null => {
      const currentImplementation = generatedDefinition?.implementation;
      if (!currentImplementation) {
          const errorMsg = "No implementation code generated or loaded. Please generate or load an implementation first.";
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          return null;
      }
      if (!genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description)) {
          const errorMsg = "Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required before saving.";
          setCreateToolError(errorMsg);
          setUpdateToolError(errorMsg);
          return null;
      }
      // Validate credential requirements: ensure names and labels are filled if any are defined
      if (credentialRequirements.some(req => (req.name && !req.label) || (!req.name && req.label) || (req.name && req.name.trim() === '') || (req.label && req.label.trim() === ''))) {
        const errorMsg = "All defined credential requirements must have both a unique 'Name (as ENV VAR)' and a 'User-Friendly Label'.";
        setCreateToolError(errorMsg);
        setUpdateToolError(errorMsg);
        return null;
      }
      const uniqueCredentialNames = new Set(credentialRequirements.filter(req => req.name.trim()).map(req => req.name.trim()));
      if (uniqueCredentialNames.size !== credentialRequirements.filter(req => req.name.trim()).length) {
        const errorMsg = "Credential 'Name (as ENV VAR)' must be unique for each requirement.";
        setCreateToolError(errorMsg);
        setUpdateToolError(errorMsg);
        return null;
      }


      let examplesData: any[] | undefined = undefined; try { const parsed = JSON.parse(genExamplesJson); if (Array.isArray(parsed)) examplesData = parsed; } catch { /* warn */ }
      
      const activeCredentialRequirements = credentialRequirements
        .filter(req => req.name.trim() !== '' && req.label.trim() !== '')
        .map(req => ({ name: req.name.trim(), label: req.label.trim() }));

      const payload: SavePayload = {
          name: genName,
          description: genDescription,
          inputs: genInputs,
          implementation: currentImplementation,
          purpose: genPurpose || genDescription,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
          examples: examplesData,
          requiredCredentialNames: activeCredentialRequirements.length > 0 ? activeCredentialRequirements : undefined, // <-- ADDED
      };
      const validationResult = savePayloadSchema.safeParse(payload);
      if (!validationResult.success) {
           const errorMsg = `Payload validation error: ${validationResult.error.flatten().fieldErrors}`;
           setCreateToolError(errorMsg);
           setUpdateToolError(errorMsg);
           console.error("Save Payload Validation Error:", validationResult.error.flatten());
           return null;
      }
      return validationResult.data;
  }, [
    generatedDefinition, genName, genDescription, genExpectedOutput, genInputs,
    genExamplesJson, genPurpose, genCategory, genAdditionalContext,
    credentialRequirements, // New dependency
    setCreateToolError, setUpdateToolError
  ]);

  // --- REFACTORED: Save as New Tool ---
  const handleCreateTool = useCallback(async () => {
      if (!userId) { setCreateToolError("User ID not found."); return; }
      setIsCreatingTool(true); setCreateToolError(null); setCreateToolSuccess(null);
      setGenDefError(null); setUpdateToolError(null); setUpdateToolSuccess(null);
      const savePayload = buildSavePayload(); if (!savePayload) { setIsCreatingTool(false); return; }
      const finalPayload = { ...savePayload, userId };
      try {
          const response = await fetch('/api/playground/create-tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalPayload) });
          const data = await response.json();
          if (!response.ok) {
              setCreateToolError(data.error || `Req failed: ${response.status}`);
          } else {
              setCreateToolSuccess(data.message || 'Created!');
              setGeneratedDefinition(data.definition);
              setToolRef(data.toolRef);
          }
      } catch (err) { setCreateToolError(err instanceof Error ? err.message : 'API error.'); } finally { setIsCreatingTool(false); }
  }, [userId, buildSavePayload]);

  // --- REFACTORED: Save Updates to Selected Tool ---
  const handleUpdateTool = useCallback(async () => {
      if (!toolRef || toolRef === "placeholder" || toolRef === "no-tools") { setUpdateToolError("No tool selected."); return; }
      if (!userId) { setUpdateToolError("User ID not found."); return; }
      setIsUpdatingTool(true); setUpdateToolError(null); setUpdateToolSuccess(null);
      setGenDefError(null); setCreateToolError(null); setCreateToolSuccess(null);
      const savePayload = buildSavePayload(); if (!savePayload) { setIsUpdatingTool(false); return; }
      const finalPayload = { ...savePayload, userId };
      try {
          const response = await fetch(`/api/playground/update-tool?ref=${encodeURIComponent(toolRef)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalPayload) });
          const data = await response.json();
          if (!response.ok) {
              setUpdateToolError(data.error || `Req failed: ${response.status}`);
          } else {
              setUpdateToolSuccess(data.message || 'Updated!');
              setGeneratedDefinition(data.definition);
          }
      } catch (err) { setUpdateToolError(err instanceof Error ? err.message : 'API error.'); } finally { setIsUpdatingTool(false); }
  }, [userId, toolRef, buildSavePayload]);

  // --- NEW HANDLER: Quick Start Tool --- 
  const handleQuickStart = useCallback(async () => {
      if (!userId || !quickStartName || !quickStartDesc || !quickStartInputs || !quickStartOutputs) {
          setQuickStartError("Please fill in all Quick Start fields.");
          setIsQuickStarting(false);
          return;
      }
      setIsQuickStarting(true); setQuickStartError(null);
      setGeneratedDefinition(null);
      setGenDefError(null); setCreateToolError(null); setUpdateToolError(null);
      const quickRequestData = { userId, toolName: quickStartName, toolDescription: quickStartDesc, suggestedInputs: quickStartInputs.split('\n').map(s => s.trim()).filter(Boolean), suggestedOutputs: quickStartOutputs.split('\n').map(s => s.trim()).filter(Boolean) };
      try {
          const response = await fetch('/api/playground/quick-start-tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quickRequestData) });
          const data = await response.json();
          if (!response.ok) {
              setQuickStartError(data.error || `Req failed: ${response.status}`);
          } else if (data.toolRequest) {
              setProposedToolRequest(data.toolRequest as ToolRequest);
              setStructureModifications([]); setRefineError(null);
              setGenName(''); setGenDescription(''); setGenPurpose('');
              setGenInputs([]); setGenExpectedOutput('');
              setGenModifications([]); setGeneratedDefinition(null);
              setQuickStartName(''); setQuickStartDesc(''); setQuickStartInputs(''); setQuickStartOutputs('');
          } else {
              setQuickStartError("Received unexpected response from server.");
          }
      } catch (err) {
          console.error("Quick Start API call failed:", err);
          setQuickStartError(err instanceof Error ? err.message : 'Quick Start API error.');
      } finally {
          setIsQuickStarting(false);
      }
  }, [userId, quickStartName, quickStartDesc, quickStartInputs, quickStartOutputs]);

  // --- NEW HANDLER: Refine Structure ---
  const handleRefineStructure = useCallback(async () => {
      if (!proposedToolRequest || !userId) return;
      setIsRefining(true); setRefineError(null);
      const payload = { userId, currentStructure: proposedToolRequest, modifications: structureModifications };
      try {
          const response = await fetch('/api/playground/refine-tool-structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const data = await response.json();
          if (!response.ok) {
              setRefineError(data.error || `Refinement request failed: ${response.status}`);
          } else if (data.refinedToolRequest) {
              setProposedToolRequest(data.refinedToolRequest as ToolRequest);
              setStructureModifications([]);
          } else {
              setRefineError("Received unexpected response from refinement server.");
          }
      } catch (err) {
          console.error("Refine Structure API call failed:", err);
          setRefineError(err instanceof Error ? err.message : 'Refinement API error.');
      } finally {
          setIsRefining(false);
      }
  }, [userId, proposedToolRequest, structureModifications]);

  // --- NEW HANDLER: Accept Structure ---
  const handleAcceptStructure = useCallback(() => {
      if (!proposedToolRequest) return;
      setGenName(proposedToolRequest.name);
      setGenDescription(proposedToolRequest.description);
      setGenPurpose(proposedToolRequest.purpose || proposedToolRequest.description);
      setGenInputs(Array.isArray(proposedToolRequest.inputs) ? proposedToolRequest.inputs : []);
      setGenExpectedOutput(proposedToolRequest.expectedOutput);
      setProposedToolRequest(null);
      setStructureModifications([]);
      setRefineError(null);
  }, [proposedToolRequest]);

  // --- NEW HANDLER: Clear Tool / Start Over ---
  const handleClearTool = useCallback(() => {
      setToolRef(''); // This will trigger the useEffect above to clear most state
      // Explicitly clear states not covered by the useEffect's clear path
      setProposedToolRequest(null);
      setStructureModifications([]);
      setQuickStartName(''); setQuickStartDesc(''); setQuickStartInputs(''); setQuickStartOutputs('');
      setConsultantUrl(''); setConsultantDataDesc(''); setAnalysisResult(null);
      // Clear errors/success messages
      setExecError(null); setResult(null); setToolListError(null);
      setGenDefError(null); setCreateToolError(null); setUpdateToolError(null);
      setQuickStartError(null); setRefineError(null); setAnalysisError(null);
      setCreateToolSuccess(null); setUpdateToolSuccess(null);
      // Ensure all definition fields are cleared (useEffect might miss some edge cases)
      setGenName(''); setGenDescription(''); setGenPurpose(''); setGenInputs([]);
      setGenExpectedOutput(''); setGenCategory(''); setGenAdditionalContext('');
      setGenExamplesJson('[]'); setGenModifications([]); setGeneratedDefinition(null);
      setIsGeneratingDef(false); setIsCreatingTool(false); setIsUpdatingTool(false);
      setIsQuickStarting(false); setIsRefining(false); setIsAnalyzing(false);
      setIsListLoading(false); setIsDetailsLoading(false); setIsExecuting(false);
      console.log("Cleared tool state including consultant.");
      // Clear Consultant State
      setConsultationHistory([]); setStrategyModificationRequests([]);
      setLatestConsultationRound(null); setStrategyError(null); setIsStrategyAccepted(false);
      setCredentialRequirements([]); // Clear credentials
      setShowCredentialRequirementsSection(false); // Hide on clear
  }, [/* Add any setters if needed by ESLint */]);

  // --- NEW: Handler to delete implementation ---
  const handleDeleteImplementation = useCallback(() => {
      setGeneratedDefinition(prev => {
        if (!prev) return null;
        return { ...prev, implementation: '' };
      });
      setIsStrategyAccepted(false); // Reset acceptance if implementation is deleted
      console.log("Deleted generated implementation and reset strategy acceptance.");
  }, []);

  // --- NEW HANDLER: Analyze Implementation Strategy ---
  const handleAnalyzeStrategy = useCallback(async (isRefinement: boolean = false) => {
      if (!userId) {
          setStrategyError("User ID not found. Cannot analyze strategy.");
          return;
      }
      // Basic validation for core definition fields needed for analysis
      if (!genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description)) {
           setStrategyError("Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required before analyzing strategy.");
           return;
      }

      setIsAnalyzingStrategy(true);
      setStrategyError(null);
      setIsStrategyAccepted(false); // Reset acceptance on new analysis/refinement
      // Clear definition error from previous attempts
      setGenDefError(null);

      // Construct the current tool request object from the form state
      const currentToolRequestObject: ToolRequest = { // Use the base ToolRequest type here
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

      // Validate the constructed object against the specific schema expected by the API
      const validationResult = apiToolRequestSchema.safeParse(currentToolRequestObject);
      if (!validationResult.success) {
            setStrategyError(`Internal Error: Constructed tool request is invalid - ${validationResult.error.flatten().fieldErrors}`);
            setIsAnalyzingStrategy(false);
            return;
      }
      const validatedToolRequest = validationResult.data; // Use the validated data

      const payload: ConsultationRequest = {
          userId,
          currentToolRequest: validatedToolRequest, // Use the validated object
          consultationHistory: isRefinement ? consultationHistory : [],
          newStrategyModifications: strategyModificationRequests,
      };

      try {
          const response = await fetch('/api/playground/analyze-implementation-strategy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          const data: ConsultationResponse | { error: string; details?: any } = await response.json();

          if (!response.ok) {
              const errorMsg = (data as { error: string }).error || `Strategy analysis request failed: ${response.status}`;
              setStrategyError(errorMsg);
              setLatestConsultationRound(null); // Clear previous results on error
              // Optionally clear history if the request failed fundamentally?
              // setConsultationHistory([]);
          } else {
              const result = data as ConsultationResponse;
              setLatestConsultationRound(result.latestRound);
              setConsultationHistory(result.updatedHistory);
              setStrategyModificationRequests([]); // Clear input mods after successful round
          }
      } catch (err) {
          console.error("Analyze Strategy API call failed:", err);
          setStrategyError(err instanceof Error ? err.message : 'Strategy analysis API error.');
          setLatestConsultationRound(null);
      } finally {
          setIsAnalyzingStrategy(false);
      }

  }, [
      userId, genName, genDescription, genPurpose, genInputs, genExpectedOutput,
      genCategory, genAdditionalContext, generatedDefinition, // Include potentially used state
      consultationHistory, strategyModificationRequests // Include state read in the handler
      // Add setters if needed by linting
  ]);
  // --- END NEW HANDLER ---

  // --- MODIFIED: Generate/Regenerate Implementation ---
  const handleGenerateImplementation = useCallback(async () => {
    // 1. Check if analysis is needed (no implementation exists AND strategy not accepted yet)
    const needsAnalysis = !generatedDefinition?.implementation && !isStrategyAccepted;

    if (needsAnalysis) {
        // Trigger analysis FIRST. The rest of this function should only run
        // after the user accepts the strategy proposed by the analysis.
        await handleAnalyzeStrategy(false); // Pass false for initial analysis
        // Stop here. The user needs to interact with the analysis results and click "Accept".
        return;
    }

    // 2. Proceed with generation only if strategy is accepted OR implementation already exists
    // Basic validation (as before)
    if (!userId || !genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description)) {
         setGenDefError("Tool Name, Description, Expected Output, and all Parameter details are required.");
         // Don't set loading false here if analysis was just triggered
         // setIsGeneratingDef(false);
         return;
    }

    // --- Original Generation Logic ---
    setIsGeneratingDef(true); setGenDefError(null);
    // Clear implementation visually while generating
    setGeneratedDefinition(prev => {
        if (!prev) return null;
        return { ...prev, implementation: '// Generating...' }; // Show placeholder
    });
    setCreateToolError(null); setCreateToolSuccess(null); setUpdateToolError(null); setUpdateToolSuccess(null);
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
        implementation?: string; // <<< Added this missing field
        modelArgs: any;
        examples?: any[];
    };
    const payload: GeneratePayload = { /* ... construct payload as before ... */
        userId,
          name: genName,
          description: genDescription,
          purpose: genPurpose || genDescription,
          inputs: genInputs,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
        modificationRequests: genModifications,
        implementation: generatedDefinition?.implementation === '// Generating...' ? undefined : generatedDefinition?.implementation, // Send previous implementation if exists
        modelArgs: { /* ... construct modelArgs ... */ }
        // examples: ... parse from genExamplesJson ...
    };

     try {
        // ... parse examples ...
        const response = await fetch('/api/playground/generate-tool-definition', { /* ... fetch options ... */ body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) {
            setGenDefError(data.error || `Request failed: ${response.status}`);
            // Restore previous implementation if generation failed?
             setGeneratedDefinition(prev => ({ ...(prev ?? {} as GeneratedToolDefinition), implementation: payload.implementation || '' }));
        } else {
            setGeneratedDefinition(data.definition);
            // Update form fields based on refined definition from AI (optional but good)
            if (data.definition) {
                setGenName(data.definition.name || genName);
                const params = data.definition.parameters || data.definition.inputs;
                setGenInputs(Array.isArray(params) ? params : genInputs);
                setGenExpectedOutput(data.definition.expectedOutput || genExpectedOutput);
            }
        }
    } catch (err) {
        setGenDefError(err instanceof Error ? err.message : 'API error.');
         // Restore previous implementation on catch
         setGeneratedDefinition(prev => ({ ...(prev ?? {} as GeneratedToolDefinition), implementation: payload.implementation || '' }));
    } finally {
        setIsGeneratingDef(false);
    }
  }, [
      userId, genName, genDescription, genPurpose, genInputs, genExpectedOutput,
      genCategory, genAdditionalContext, genModifications, generatedDefinition,
      genModelArgs, genExamplesJson,
      isStrategyAccepted, // Include new dependency
      handleAnalyzeStrategy // Include handler dependency
      // Add setters if needed
  ]);
  // --- END MODIFIED ---

  // --- NEW: Scraper Consultant Handlers ---
  const handleAnalyzeWebsite = useCallback(async () => {
    if (!userId || !consultantUrl) {
        setAnalysisError("User ID and Target URL are required for analysis.");
        return;
    }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
        const response = await fetch('/api/playground/analyze-scraping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                targetUrl: consultantUrl,
                dataDescription: consultantDataDesc || undefined
            })
        });

        const data: AnalysisResult | { error: string; details?: any } = await response.json();

        if (!response.ok) {
            const errorMsg = (data as { error: string }).error || `Analysis request failed: ${response.status}`;
            setAnalysisError(errorMsg);
             if ((data as { details: any }).details) console.error("Analysis Validation:", (data as { details: any }).details);
        } else {
            setAnalysisResult(data as AnalysisResult);
        }
    } catch (err) {
        console.error("Scraper Consultant API call failed:", err);
        setAnalysisError(err instanceof Error ? err.message : 'Analysis API error.');
    } finally {
        setIsAnalyzing(false);
    }
  }, [userId, consultantUrl, consultantDataDesc]);

  const handlePopulateFromAnalysis = useCallback(() => {
    if (!analysisResult || !consultantUrl) return;

    // 1. Populate Basic Info
    try {
        const urlHostname = new URL(consultantUrl).hostname.replace(/\./g, '_');
        setGenName(`scrape_${urlHostname}`);
    } catch {
        setGenName(`scrape_website`);
    }
    setGenDescription(`Scrapes ${consultantDataDesc || 'data'} from ${consultantUrl} using ${analysisResult.suggestedMethod || 'the recommended method'}.`);
    setGenPurpose(`To extract specific data ('${consultantDataDesc || 'general content'}') from the target website.`);
    setGenInputs([{ name: 'url', type: 'string', description: 'Target URL to scrape', required: true, default: consultantUrl }]);
    setGenExpectedOutput(`Structured data containing ${consultantDataDesc || 'the extracted content'} in JSON format.`);

    // 2. Generate Modification Requests
    const newModifications: string[] = [];
    const method = analysisResult.suggestedMethod;

    if (method?.includes('Firecrawl')) {
        newModifications.push("Use the 'executeFirecrawlScrape' helper function. Import it from '@/src/lib/agent-tools/helpers/web-scraping'. Handle potential errors.");
    } else if (method?.includes('Visual Scrape')) {
        newModifications.push("Use the 'executeVisualScrape' helper function. Import it from '@/src/lib/agent-tools/helpers/visual-scraping'. Handle potential errors.");
    } else if (method?.includes('Standard Fetch / Cheerio')) {
        newModifications.push("Use standard Node.js fetch and the 'cheerio' library to parse HTML.");
        if (analysisResult.suggestedSelectors && Object.keys(analysisResult.suggestedSelectors).length > 0) {
             newModifications.push(`Attempt to use these suggested selectors: ${JSON.stringify(analysisResult.suggestedSelectors)}`);
        }
    } else {
         newModifications.push("Carefully review the analysis results and implement the most appropriate scraping method.");
    }

    analysisResult.potentialIssues?.forEach(issue => {
        if (issue.toLowerCase().includes('javascript') || issue.toLowerCase().includes('js rendering')) {
             newModifications.push("Ensure the chosen method handles JavaScript rendering if necessary (Firecrawl/VisualScrape do, Fetch/Cheerio does not).");
        } else if (issue.toLowerCase().includes('cloudflare') || issue.toLowerCase().includes('anti-bot')) {
            newModifications.push("Implement robust error handling and potentially add request headers/delays to mimic a real browser, or rely on helpers designed to bypass basic blocks.");
        } else if (issue.toLowerCase().includes('timeout')) {
             newModifications.push("Implement proper timeout handling for network requests.");
        } else if (issue.toLowerCase().includes('login')) {
             newModifications.push("Scraping requires handling login; this tool likely needs parameters for credentials or session cookies.");
        } else if (issue.toLowerCase().includes('selector')) {
             newModifications.push("Carefully validate or manually define CSS selectors for reliable data extraction.");
        } else {
            newModifications.push(`Address potential issue: ${issue}`);
        }
    });
    setGenModifications(prev => [...new Set([...prev, ...newModifications])]);

    // 3. Set Additional Context
    const analysisSummary = `
## Scraping Analysis Results for: ${consultantUrl}
User Data Description: ${consultantDataDesc || '(Not provided)'}
---------------------------------------------
Status: ${analysisResult.status || 'N/A'}
Message: ${analysisResult.message || 'N/A'}
Suggested Method: ${analysisResult.suggestedMethod || 'N/A'}
Potential Issues: ${analysisResult.potentialIssues?.join('; ') || 'None apparent'}

## Suggested Selectors
\`\`\`json
${analysisResult.suggestedSelectors ? JSON.stringify(analysisResult.suggestedSelectors, null, 2) : '{}'}
\`\`\`

## Preliminary Check Details
Accessible: ${analysisResult.preliminaryCheck?.accessible ? 'Yes' : 'No'}
Status Code: ${analysisResult.preliminaryCheck?.statusCode || 'N/A'}
Content Type: ${analysisResult.preliminaryCheck?.contentType || 'N/A'}
Likely Block Page: ${analysisResult.preliminaryCheck?.isLikelyBlockPage ? `Yes (${analysisResult.preliminaryCheck?.blockReason || 'Unknown'})` : 'No'}
Error: ${analysisResult.preliminaryCheck?.error || 'None'}

## Firecrawl Check Details (if attempted)
Attempted: ${analysisResult.firecrawlCheck?.attempted ? 'Yes' : 'No'}
Success: ${analysisResult.firecrawlCheck?.success ? 'Yes' : 'No'}
Error: ${analysisResult.firecrawlCheck?.error || 'None'}
    `.trim();
    setGenAdditionalContext(prev => prev ? `${prev}\n\n${analysisSummary}` : analysisSummary);

    console.log("Populated definition fields based on analysis.");

  }, [analysisResult, consultantUrl, consultantDataDesc]);

  // --- Render Helper ---
  const adaptedModelProp = { ...genModelArgs, provider: String(genModelArgs.provider).toUpperCase() as any };
  const displayModelProp = { ...genModelArgs };
  const hasImplementation = !!generatedDefinition?.implementation;
  const isDefinitionFormValid = 
    genName.trim() !== '' && 
    genDescription.trim() !== '' && 
    genExpectedOutput.trim() !== '' && 
    !genInputs.some(p => !p.name.trim() || !p.type.trim() || !p.description.trim());
  // Update canSaveOrUpdate logic to only require implementation and valid form fields
  const canSaveOrUpdate = hasImplementation && isDefinitionFormValid;
  // Rename the derived constant to avoid conflict with the state setter
  const isExecutionReady = selectedToolDetails && selectedToolDetails.parameters.every(param => {
      const isRequired = param.required !== false;
      if (!isRequired) return true;
      const value = formValues[param.name];
      return !(value === null || value === undefined || value === '');
  });

  // --- NEW HANDLERS FOR CREDENTIAL REQUIREMENTS ---
  const handleAddCredentialRequirement = useCallback(() => {
    setCredentialRequirements(prev => [...prev, { id: uuidv4(), name: '', label: '', currentSecretValue: '', isSecretSaved: false }]);
  }, []);

  const handleRemoveCredentialRequirement = useCallback((id: string) => {
    setCredentialRequirements(prev => prev.filter(req => req.id !== id));
  }, []);

  const handleCredentialRequirementChange = useCallback((id: string, field: keyof Omit<CredentialRequirementInput, 'id' | 'currentSecretValue' | 'isSecretSaved'>, value: string) => {
    setCredentialRequirements(prev =>
      prev.map(req =>
        req.id === id ? { ...req, [field]: value } : req
      )
    );
  }, []);
  // --- END NEW HANDLERS ---

  // --- NEW STATE for Implementation Consultant (within Helpers section) ---
  const [activeHelperTab, setActiveHelperTab] = useState<'scraper' | 'implementation'>('scraper');
  const [helperImpConName, setHelperImpConName] = useState<string>('');
  const [helperImpConDescription, setHelperImpConDescription] = useState<string>('');
  const [helperImpConPurpose, setHelperImpConPurpose] = useState<string>('');
  const [helperImpConInputsStr, setHelperImpConInputsStr] = useState<string>(''); // Simplified input as string for now
  const [helperImpConExpectedOutput, setHelperImpConExpectedOutput] = useState<string>('');
  const [helperImpConConsultationHistory, setHelperImpConConsultationHistory] = useState<ConsultationHistory>([]);
  const [helperImpConLatestRound, setHelperImpConLatestRound] = useState<ConsultationRound | null>(null);
  const [isHelperAnalyzingStrategy, setIsHelperAnalyzingStrategy] = useState<boolean>(false);
  const [helperImpConStrategyError, setHelperImpConStrategyError] = useState<string | null>(null);
  const [helperImpConStrategyModifications, setHelperImpConStrategyModifications] = useState<string[]>([]);

  // Define the function to render tab content
  const renderHelperTabContent = (tab: 'scraper' | 'implementation'): React.ReactNode => {
    if (tab === 'scraper') {
      return (
        <>
          {/* JSX for Scraper Consultant (using consultantUrl, handleAnalyzeWebsite, etc.) */}
          <div>
            <Label htmlFor="consultant-url" className="text-sm font-medium text-slate-300">Target URL</Label>
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
            <Label htmlFor="consultant-data-desc" className="text-sm font-medium text-slate-300">Data to Extract (Description)</Label>
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
            {isAnalyzing ? 'Analyzing Website...' : 'Analyze Website for Scraping'}
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
                <CardTitle className="text-sm font-semibold text-indigo-300">Scraping Analysis Report</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 space-y-1.5">
                <p><strong>Status:</strong> <span className={`font-medium ${analysisResult.status === 'success' ? 'text-green-400' : 'text-yellow-400'}`}>{analysisResult.status}</span></p>
                <p><strong>Message:</strong> {analysisResult.message}</p>
                <p><strong>Suggested Method:</strong> <span className="font-semibold text-purple-300">{analysisResult.suggestedMethod || 'N/A'}</span></p>
                {analysisResult.potentialIssues && analysisResult.potentialIssues.length > 0 && (
                  <div><strong>Potential Issues:</strong> <ul className="list-disc list-inside pl-3 text-slate-400">{analysisResult.potentialIssues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>
                )}
                {analysisResult.suggestedSelectors && Object.keys(analysisResult.suggestedSelectors).length > 0 && (
                  <div><strong>Suggested Selectors:</strong> <pre className="bg-slate-900/70 p-2 rounded text-xs overflow-x-auto mt-1 border border-slate-700">{JSON.stringify(analysisResult.suggestedSelectors, null, 2)}</pre></div>
                )}
                <Separator className="my-2 bg-slate-600"/>
                <p className='text-indigo-400 text-xs font-semibold'>Preliminary Check:</p>
                <p>Accessible: {analysisResult.preliminaryCheck?.accessible ? <span className='text-green-400'>Yes</span> : <span className='text-red-400'>No</span>}</p>
                <p>Status Code: {analysisResult.preliminaryCheck?.statusCode || 'N/A'}</p>
                <p>Likely Block Page: {analysisResult.preliminaryCheck?.isLikelyBlockPage ? <span className='text-yellow-400'>Yes ({analysisResult.preliminaryCheck?.blockReason || 'Unknown'})</span> : 'No'}</p>
                {analysisResult.firecrawlCheck?.attempted && (
                  <>
                    <Separator className='my-2 bg-slate-600'/>
                    <p className='text-indigo-400 text-xs font-semibold'>Firecrawl Check (if attempted):</p>
                    <p>Success: {analysisResult.firecrawlCheck?.success ? <span className='text-green-400'>Yes</span> : <span className='text-red-400'>No</span>}</p>
                    {analysisResult.firecrawlCheck?.error && <p>Error: <span className='text-red-400'>{analysisResult.firecrawlCheck.error}</span></p>}
                  </>
                )}
              </CardContent>
              <CardFooter className="pt-3 pb-3">
                <Button onClick={handlePopulateFromAnalysis} variant="outline" size="sm" className="text-indigo-300 border-indigo-600/70 hover:bg-indigo-700/20 hover:text-indigo-200 hover:border-indigo-500 text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M4 12a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H4z"/></svg>
                  Populate Main Form from Analysis
                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      );
    }
    if (tab === 'implementation') {
      return (
        <>
          {/* Start of Implementation Consultant UI for Helper Section */}
          <div>
            <Label htmlFor="helper-impcon-name" className="text-sm font-medium text-slate-300">Tool Name</Label>
            <Input id="helper-impcon-name" value={helperImpConName} onChange={(e) => setHelperImpConName(e.target.value)} placeholder="e.g., getWeatherForecast" className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400" disabled={isHelperAnalyzingStrategy} />
          </div>
          <div>
            <Label htmlFor="helper-impcon-desc" className="text-sm font-medium text-slate-300">Tool Description</Label>
            <Textarea id="helper-impcon-desc" value={helperImpConDescription} onChange={(e) => setHelperImpConDescription(e.target.value)} placeholder="Describes what the tool does" className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400 h-20" disabled={isHelperAnalyzingStrategy}/>
          </div>
          <div>
            <Label htmlFor="helper-impcon-purpose" className="text-sm font-medium text-slate-300">Tool Purpose (Optional)</Label>
            <Input id="helper-impcon-purpose" value={helperImpConPurpose} onChange={(e) => setHelperImpConPurpose(e.target.value)} placeholder="Specific goal or use case" className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400" disabled={isHelperAnalyzingStrategy} />
          </div>
          <div>
            <Label htmlFor="helper-impcon-inputs" className="text-sm font-medium text-slate-300">Inputs (one per line: name:type:description)</Label>
            <Textarea id="helper-impcon-inputs" value={helperImpConInputsStr} onChange={(e) => setHelperImpConInputsStr(e.target.value)} placeholder="location:string:City and state, e.g. San Francisco, CA\nunit:string(opt):Temperature unit (celsius or fahrenheit)" className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400 h-24 font-mono text-xs" disabled={isHelperAnalyzingStrategy}/>
          </div>
          <div>
            <Label htmlFor="helper-impcon-output" className="text-sm font-medium text-slate-300">Expected Output Description</Label>
            <Input id="helper-impcon-output" value={helperImpConExpectedOutput} onChange={(e) => setHelperImpConExpectedOutput(e.target.value)} placeholder="e.g., JSON with temperature, conditions" className="mt-1 bg-slate-600 border-slate-500 text-slate-100 placeholder:text-slate-400" disabled={isHelperAnalyzingStrategy}/>
          </div>

          <Button 
            onClick={() => handleAnalyzeStrategy(false)} 
            disabled={isHelperAnalyzingStrategy || !helperImpConName || !helperImpConDescription || !helperImpConExpectedOutput}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isHelperAnalyzingStrategy && !helperImpConLatestRound ? 'Analyzing Strategy...' : 'Analyze Implementation Strategy'}
          </Button>

          {/* Display general error from the helper analysis call, if not shown by the card */}
          {helperImpConStrategyError && !helperImpConLatestRound && (
            <div className="text-red-400 text-xs p-2 border border-red-700 bg-red-900/30 rounded">
                <p className="font-semibold">Strategy Analysis Error:</p>
                <p>{helperImpConStrategyError}</p>
            </div>
          )}

          {/* Reusable card for displaying analysis and refinement options for the HELPER */}
          {helperImpConLatestRound && (
            <ImplementationStrategyAnalysisCard
                consultationRound={helperImpConLatestRound}
                strategyError={helperImpConStrategyError} // Pass the specific error for the helper context
                isAnalyzing={isHelperAnalyzingStrategy}
                modificationRequests={helperImpConStrategyModifications}
                onModificationChange={handleModificationChange}
                onAddModification={handleAddModification}
                onRemoveModification={handleRemoveModification}
                onRefineStrategy={() => handleAnalyzeStrategy(true)} // true for refinement
                onAcceptOrPopulate={handleAcceptStructure}
                acceptButtonText="Use This Configuration in Main Form"
                refineButtonText="Refine Helper Strategy"
                title="Helper: Strategy Analysis"
                description="Review and refine the strategy for this helper tool definition."
                cardClassName="bg-slate-800/70 border-slate-700" // Slightly different styling for helper card
            />
          )}
          {/* End of Implementation Consultant UI for Helper Section */}
        </>
      );
    }
    return null;
  };

  return (
    <div className="p-4 font-sans flex flex-col gap-8 max-w-full mx-auto bg-slate-800 min-h-screen text-slate-200">
    <div className="h-24 w-full"/>
      <h1 className="text-3xl font-bold mb-8 text-center text-indigo-300">Custom Tool Playground</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main content area - 8 columns on large screens */}
        <div className="lg:col-span-8 space-y-8">
          {/* Section 0a: Quick Start - Conditionally Visible */}
          {!toolRef && !proposedToolRequest && (
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
          )}

          {/* Section 1: Tool Selection & Execution - Always Visible */}
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

          {/* Section 2: Tool Definition & Implementation - Always Visible */}
          <ToolDefinitionCard
            selectedToolDetails={selectedToolDetails}
            genName={genName} onGenNameChange={setGenName}
            genPurpose={genPurpose} onGenPurposeChange={setGenPurpose}
            genDescription={genDescription} onGenDescriptionChange={setGenDescription}
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
            showCredentialRequirementsSection={showCredentialRequirementsSection}
            onToggleCredentialRequirements={setShowCredentialRequirementsSection}
            toolRef={toolRef}
            generatedDefinition={generatedDefinition}
            genExpectedOutput={genExpectedOutput} onGenExpectedOutputChange={setGenExpectedOutput}
            genCategory={genCategory} onGenCategoryChange={setGenCategory}
            genAdditionalContext={genAdditionalContext} onGenAdditionalContextChange={setGenAdditionalContext}
            genExamplesJson={genExamplesJson} onGenExamplesJsonChange={setGenExamplesJson}
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

          {/* Section 3: Refine Tool Structure - Conditionally Visible */}
          {proposedToolRequest && (
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
          )}

          {/* Implementation Consultant UI */}
          {latestConsultationRound && !isStrategyAccepted && (
            <ImplementationStrategyAnalysisCard
              consultationRound={latestConsultationRound}
              strategyError={strategyError}
              isAnalyzing={isAnalyzingStrategy}
              modificationRequests={strategyModificationRequests}
              onModificationChange={handleStrategyModificationChange}
              onAddModification={handleAddStrategyModification}
              onRemoveModification={handleRemoveStrategyModification}
              onRefineStrategy={() => handleAnalyzeStrategy(true)}
              onAcceptOrPopulate={() => setIsStrategyAccepted(true)}
              isAccepted={isStrategyAccepted}
            />
          )}

          {isStrategyAccepted && latestConsultationRound && (
              <div className="mt-4 p-3 rounded border border-green-700 bg-green-900/30 text-green-300 text-sm">
                  Strategy accepted (Type: {latestConsultationRound.analysis.recommendedType}). You can now generate the implementation or save the tool.
              </div>
          )}
          {isAnalyzingStrategy && <p className="text-yellow-400 mt-4">Analyzing strategy...</p>}

          {/* Mobile Helpers Section */}
          <div className="lg:hidden mt-8">
            <HelpersCard
              activeTab={activeHelperTab}
              onTabChange={setActiveHelperTab}
              renderTabContent={renderHelperTabContent} // Pass the render function
            />
          </div>
        </div>

        {/* Sidebar / Helpers column - Only visible on large screens */}
        <div className="lg:col-span-4 space-y-8 hidden lg:block">
          <HelpersCard
            activeTab={activeHelperTab}
            onTabChange={setActiveHelperTab}
            className="sticky top-28 transition-all hover:shadow-indigo-900/20 hover:shadow-lg"
            renderTabContent={renderHelperTabContent} // Pass the render function
          />
        </div>
      </div>
    </div> // End main container
  );
}

