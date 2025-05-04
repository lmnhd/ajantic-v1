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

// --- Adapter Functions ---
const adaptProviderToEnumCase = (provider: ModelProviderEnum): string => {
    return String(provider).toUpperCase();
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
  // --- End State for Scraper Consultant ---


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

      } catch (err) {
        console.error(`Error fetching details for tool ${toolId || toolRef}:`, err);
        setExecError(err instanceof Error ? err.message : `Failed to load details for ${toolRef}.`);
        // Clear all fields on error
        setSelectedToolDetails(null);
        setFormValues({});
        setGenName(''); setGenDescription(''); setGenPurpose(''); setGenInputs([]);
        setGenExpectedOutput(''); setGenCategory(''); setGenAdditionalContext('');
        setGenExamplesJson('[]'); setGenModifications([]); setGeneratedDefinition(null);
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
      let examplesData: any[] | undefined = undefined; try { const parsed = JSON.parse(genExamplesJson); if (Array.isArray(parsed)) examplesData = parsed; } catch { /* warn */ }
      const payload: SavePayload = { name: genName, description: genDescription, inputs: genInputs, implementation: currentImplementation, purpose: genPurpose || genDescription, expectedOutput: genExpectedOutput, category: genCategory, additionalContext: genAdditionalContext, examples: examplesData };
      const validationResult = savePayloadSchema.safeParse(payload); if (!validationResult.success) { /* ... set error ... */ return null; }
      return validationResult.data;
  }, [generatedDefinition, genName, genDescription, genExpectedOutput, genInputs, genExamplesJson, genPurpose, genCategory, genAdditionalContext, setCreateToolError, setUpdateToolError]);

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
      console.log("Cleared tool state.");
  }, [/* Add any setters if needed by ESLint */]);

  // --- NEW: Handler to delete implementation ---
  const handleDeleteImplementation = useCallback(() => {
      setGeneratedDefinition(prev => {
        if (!prev) return null;
        // Return the definition object, setting implementation to an empty string
        // This satisfies the type requirement while indicating no code.
        return { ...prev, implementation: '' };
      });
      // Optionally clear modification requests too?
      // setGenModifications([]);
      console.log("Deleted generated implementation.");
  }, []);

  // --- REFACTORED: Generate/Regenerate Implementation ---
  const handleGenerateImplementation = useCallback(async () => {
    if (!userId || !genName || !genDescription || !genExpectedOutput || genInputs.some(p => !p.name || !p.type || !p.description)) {
         setGenDefError("Tool Name, Description, Expected Output, and all Parameter details (Name, Type, Description) are required.");
         setIsGeneratingDef(false);
         return;
    }
    setIsGeneratingDef(true); setGenDefError(null);
    // --- MODIFICATION: Set implementation to empty string when starting generation ---
    setGeneratedDefinition(prev => {
        if (!prev) return null; // If no previous definition, keep it null
        // Otherwise, keep the structure but clear the implementation
        return { ...prev, implementation: '' };
    });
    // --- END MODIFICATION ---
    setCreateToolError(null); setCreateToolSuccess(null); setUpdateToolError(null); setUpdateToolSuccess(null);
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
        modelArgs: any;
        examples?: any[];
    };
    const payload: GeneratePayload = {
        userId,
          name: genName,
          description: genDescription,
          purpose: genPurpose || genDescription,
          inputs: genInputs,
          expectedOutput: genExpectedOutput,
          category: genCategory,
          additionalContext: genAdditionalContext,
        modificationRequests: genModifications,
        // Send the PREVIOUS implementation (if it existed) to the API for context
        implementation: generatedDefinition?.implementation,
        modelArgs: {
            ...genModelArgs,
            provider: String(genModelArgs.provider).toUpperCase()
        }
    };
     try {
        const parsedExamples = JSON.parse(genExamplesJson);
        if (Array.isArray(parsedExamples)) {
            payload.examples = parsedExamples;
        }
        const response = await fetch('/api/playground/generate-tool-definition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) {
            setGenDefError(data.error || `Request failed: ${response.status}`);
            // --- MODIFICATION: Restore previous definition if generation fails? Maybe not needed.
        } else {
            setGeneratedDefinition(data.definition); // Set the new full definition
            if (data.definition) {
                setGenName(data.definition.name || genName);
                const params = data.definition.parameters || data.definition.inputs;
                setGenInputs(Array.isArray(params) ? params : genInputs);
                setGenExpectedOutput(data.definition.expectedOutput || genExpectedOutput);
            }
        }
    } catch (err) { setGenDefError(err instanceof Error ? err.message : 'API error.'); } finally { setIsGeneratingDef(false); }
  }, [userId, genName, genDescription, genPurpose, genInputs, genExpectedOutput, genCategory, genAdditionalContext, genModifications, generatedDefinition, genModelArgs, genExamplesJson]);

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
  const isDefinitionFormValid = genName && genDescription && genExpectedOutput && !genInputs.some(p => !p.name || !p.type || !p.description);
  // Update canSaveOrUpdate logic to only require implementation and valid form fields
  const canSaveOrUpdate = hasImplementation && isDefinitionFormValid;
  // Rename the derived constant to avoid conflict with the state setter
  const isExecutionReady = selectedToolDetails && selectedToolDetails.parameters.every(param => {
      const isRequired = param.required !== false;
      if (!isRequired) return true;
      const value = formValues[param.name];
      return !(value === null || value === undefined || value === '');
  });

  return (
    <div className="p-5 font-sans flex flex-col gap-6 max-w-4xl mx-auto">
    <div className="h-24 w-full"/>
      <h1 className="text-3xl font-bold mb-6 text-center">Custom Tool Playground</h1>

      {/* Section 0a: Quick Start - Conditionally Visible */}
      {!toolRef && !proposedToolRequest && (
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

       {/* Section 0b: Scraper Consultant - Conditionally Visible */}
       {!toolRef && !proposedToolRequest && (
        <Card className="border-cyan-300 border">
            <CardHeader>
                <CardTitle className="text-cyan-700">Scraper Consultant</CardTitle>
                <CardDescription>Analyze a website to determine scraping viability and recommended methods before defining the tool below.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                 <div className="grid w-full items-center gap-1.5">
                     <Label htmlFor="consultantUrl">Target Website URL</Label>
                     <Input
                        id="consultantUrl"
                        value={consultantUrl}
                        onChange={(e) => setConsultantUrl(e.target.value)}
                        placeholder="https://example.com"
                        disabled={isAnalyzing}
                        type="url"
                     />
                 </div>
                  <div className="grid w-full items-center gap-1.5">
                     <Label htmlFor="consultantDataDesc">Describe Data to Extract (Optional)</Label>
                     <Textarea
                        id="consultantDataDesc"
                        value={consultantDataDesc}
                        onChange={(e) => setConsultantDataDesc(e.target.value)}
                        placeholder="e.g., Extract all product names, prices, and ratings from the search results page."
                        rows={3}
                        disabled={isAnalyzing}
                     />
                     <p className="text-xs text-gray-500">Helps in suggesting relevant selectors.</p>
                 </div>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-3">
                 <Button onClick={handleAnalyzeWebsite} disabled={isAnalyzing || !userId || !consultantUrl}>
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Website for Scraping'}
                 </Button>
                 {/* Analysis Results Display */}
                 {analysisError && (
                    <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Analysis Error:</strong><pre className="mt-1 text-sm">{analysisError}</pre></div>
                 )}
                 {analysisResult && (
                    <ScrollArea className="border border-gray-300 p-3 bg-gray-50 rounded w-full mt-2 max-h-[300px]">
                        <h4 className="text-sm font-semibold mb-2">Analysis Results:</h4>
                        <p className="text-xs mb-1"><strong className="font-medium">Overall Status:</strong> <span className={analysisResult.status === 'success' ? 'text-green-700' : 'text-red-700'}>{analysisResult.status}</span></p>
                        <p className="text-xs mb-1"><strong className="font-medium">Message:</strong> {analysisResult.message}</p>
                        <Separator className="my-2" />
                        <p className="text-xs mb-1"><strong className="font-medium">Suggested Method:</strong> {analysisResult.suggestedMethod || 'N/A'}</p>
                        <div className="text-xs mb-1">
                            <strong className="font-medium">Potential Issues:</strong>
                             {analysisResult.potentialIssues && analysisResult.potentialIssues.length > 0 ? (
                                <ul className="list-disc list-inside pl-4">
                                    {analysisResult.potentialIssues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                                </ul>
                            ) : (
                                <span> None apparent</span>
                            )}
                        </div>
                        <div className="text-xs">
                            <strong className="font-medium">Suggested Selectors:</strong>
                             <pre className="mt-1 text-xs whitespace-pre-wrap break-all bg-gray-100 p-2 rounded border border-gray-200 text-gray-800 max-h-[150px] overflow-auto">
                                {analysisResult.suggestedSelectors ? JSON.stringify(analysisResult.suggestedSelectors, null, 2) : "{}"}
                             </pre>
                        </div>
                         {/* Populate Button */}
                         <Button
                              variant="secondary"
                              size="sm"
                              className="mt-3"
                              onClick={handlePopulateFromAnalysis}
                              disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                          >
                             Use Analysis Results to Populate Fields Below
                         </Button>
                    </ScrollArea>
                 )}
            </CardFooter>
        </Card>
       )}

      {/* Section 1: Tool Selection & Execution - Always Visible */}
      <Card>
          <CardHeader>
              <CardTitle>{selectedToolDetails ? `Execute: ${selectedToolDetails.name}` : 'Load / Execute Tool'}</CardTitle>
              <CardDescription>{selectedToolDetails ? 'Provide arguments and execute the selected tool.' : 'Select a tool from the list to load its details and enable execution.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
              {/* Tool Selection Dropdown */}
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="toolSelect">Select Tool</Label>
                  <Select onValueChange={handleToolSelect} value={toolRef || "placeholder"} disabled={!userId || isListLoading || isExecuting || isGeneratingDef || isCreatingTool || isUpdatingTool}>
                      <SelectTrigger id="toolSelect" className="w-full">
                          <SelectValue placeholder={
                              !userId ? "Waiting for User ID..." :
                              (isListLoading ? "Loading tools..." : "Select a tool...")
                          } />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="placeholder" disabled>
                              {!userId ? "Waiting..." : (isListLoading ? "Loading..." : "Select...")}
                          </SelectItem>
                          {userId && !isListLoading && toolList.length === 0 && <SelectItem value="no-tools" disabled>No custom tools found</SelectItem>}
                          {userId && !isListLoading && toolList.map((tool) => (
                              <SelectItem key={tool.id} value={tool.reference}>
                                  {tool.name} <span className="text-xs text-gray-500 ml-2">({tool.reference})</span>
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  {toolListError && <p className="text-sm text-red-600 mt-1">{toolListError}</p>}
              </div>

              {/* Arguments Area */}
              {isDetailsLoading && <p className="text-sm text-gray-500">Loading arguments...</p>}
              {!isDetailsLoading && !selectedToolDetails && <p className="text-sm text-gray-500 italic">Select a tool above to view arguments.</p>}
              {selectedToolDetails && !isDetailsLoading && (
                  <div className="border border-gray-200 p-4 rounded flex flex-col gap-3">
                      <h3 className="text-md font-semibold">Arguments for Execution</h3>
                       {selectedToolDetails.parameters.length === 0 && <p className="text-sm text-gray-500">No arguments required.</p>}
                      {selectedToolDetails.parameters.map((param) => (
                           <div key={param.name} className="grid w-full items-center gap-1.5">
                                <Label htmlFor={param.name}>{param.description || param.name}{param.required !== false && <span className="text-red-500 ml-1">*</span>}</Label>
                                {param.type === 'string' && <Input type="text" id={param.name} name={param.name} value={formValues[param.name] || ''} onChange={(e) => handleFormChange(param.name, e.target.value, param.type)} placeholder={param.description || param.name} disabled={isExecuting} />}
                                {param.type === 'number' && <Input type="number" id={param.name} name={param.name} value={formValues[param.name] || ''} onChange={(e) => handleFormChange(param.name, e.target.value, param.type)} placeholder={param.description || param.name} disabled={isExecuting} />}
                                {param.type === 'boolean' && <div className="flex items-center space-x-2 mt-1"><Checkbox id={param.name} name={param.name} checked={!!formValues[param.name]} onCheckedChange={(checked) => handleCheckboxChange(param.name, checked)} disabled={isExecuting} /></div>}
                                {param.type !== 'string' && param.type !== 'number' && param.type !== 'boolean' && <p className="text-xs text-orange-500">Unsupported Input Type: {param.type}</p>}
                           </div>
                       ))}
                  </div>
              )}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
              {/* Execute Button */}
              <Button
                  onClick={handleExecute}
                  disabled={!selectedToolDetails || !isExecutionReady || isExecuting || isDetailsLoading || isGeneratingDef || isCreatingTool || isUpdatingTool}
                >
                  {isExecuting ? 'Executing...' : 'Execute Tool'}
              </Button>
              {selectedToolDetails && !isExecutionReady && <p className="text-xs text-orange-600">Fill required arguments (*).</p>}

              {/* Execution Results/Errors */}
              {execError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Exec Error:</strong><pre className="mt-1 text-sm">{execError}</pre></div>}
              {result && <div className="border border-gray-300 p-3 bg-gray-800 rounded w-full"><strong className="font-semibold">Exec Result:</strong><pre className="mt-1 text-sm whitespace-pre-wrap break-all">{result}</pre></div>}

              {/* Clear Button - Always available */}
              <Button variant="destructive" size="sm" onClick={handleClearTool} className="mt-4"> Clear All / Start Over </Button>
          </CardFooter>
      </Card>

      {/* Section 2: Tool Definition & Implementation - Always Visible */}
      <Card>
        <CardHeader>
            <CardTitle>{selectedToolDetails ? `Define/Edit: ${genName || '(Loading...)'}` : 'Define New Tool'}</CardTitle>
            <CardDescription>
                {selectedToolDetails ? 'Modify the definition or implementation below. Use "Generate..." to update the code, then "Save Updates..." to persist.' : 'Define the structure, generate the implementation, and use "Save as New Tool". Select a tool above to load it for editing.'}
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
             {/* All form fields (genName, genDescription, genInputs, etc.) remain here */}
             {/* ... Name, Description, Purpose ... */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="toolName">Tool Name <span className="text-red-500">*</span></Label>
                    <Input id="toolName" value={genName} onChange={(e) => setGenName(e.target.value)} placeholder="e.g., CLICKBANK_MARKETPLACE_ANALYZER" disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                </div>
                 <div className="grid w-full items-center gap-1.5">
                     <Label htmlFor="toolPurpose">Tool Purpose (Optional)</Label>
                     <Input id="toolPurpose" value={genPurpose} onChange={(e) => setGenPurpose(e.target.value)} placeholder="Defaults to description if empty" disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                 </div>
            </div>
             <div className="grid w-full items-center gap-1.5">
                 <Label htmlFor="toolDescription">Description <span className="text-red-500">*</span></Label>
                 <Textarea id="toolDescription" value={genDescription} onChange={(e) => setGenDescription(e.target.value)} placeholder="Describe what the tool does..." rows={3} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
             </div>

              {/* Model Selection */}
             <div className="border p-3 rounded-md space-y-3 bg-gray-50">
                 <Label className="font-semibold text-gray-700">LLM Configuration (for generation)</Label>
                 <ModelProviderSelect
                    model={displayModelProp}
                    modelProviderChanged={handleModelProviderChange}
                    modelNameChanged={handleModelNameChange}
                    temperatureChanged={handleTemperatureChange}
                    index={0}
                    localState={localState}

                 />
             </div>

              {/* Modification Requests */}
             <div className="border p-3 rounded-md space-y-3">
                 <Label className="font-semibold">Modification Requests (Optional)</Label>
                 <p className="text-xs text-gray-500">Provide instructions to the LLM on how to generate or modify the implementation code below.</p>
                 {genModifications.map((mod, index) => (
                     <div key={index} className="flex items-center gap-2">
                         <Input
                            type="text"
                            value={mod}
                            onChange={(e) => handleModificationChange(index, e.target.value)}
                            placeholder={`e.g., Add error handling for network requests`}
                            className="flex-grow"
                            disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                         />
                         <Button variant="ghost" size="sm" onClick={() => handleRemoveModification(index)} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}>X</Button>
                     </div>
                 ))}
                 <Button variant="outline" size="sm" onClick={handleAddModification} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}>+ Add Modification Request</Button>
             </div>

             {/* Input Parameters Section */}
             <div className="border p-3 rounded-md space-y-3">
                <Label className="font-semibold">Input Parameters <span className="text-red-500">*</span></Label>
                 {genInputs.map((param, index) => (
                    <div key={index} className="border-t pt-3 mt-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                           <p className="text-sm font-medium">Parameter {index + 1}</p>
                           <Button variant="ghost" size="sm" onClick={() => handleRemoveParameter(index)} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}>Remove</Button>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                             <div className="grid w-full items-center gap-1.5">
                                 <Label htmlFor={`param-name-${index}`}>Name <span className="text-red-500">*</span></Label>
                                 <Input id={`param-name-${index}`} value={param.name} onChange={(e) => handleParameterChange(index, 'name', e.target.value)} placeholder="e.g., niche_category" disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                             </div>
                             <div className="grid w-full items-center gap-1.5">
                                <Label htmlFor={`param-type-${index}`}>Type <span className="text-red-500">*</span></Label>
                                 <Select value={param.type} onValueChange={(value) => handleParameterChange(index, 'type', value)} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}>
                                     <SelectTrigger id={`param-type-${index}`}><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="array">Array</SelectItem>
                                        <SelectItem value="object">Object</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                         <div className="grid w-full items-center gap-1.5">
                             <Label htmlFor={`param-desc-${index}`}>Description <span className="text-red-500">*</span></Label>
                             <Input id={`param-desc-${index}`} value={param.description} onChange={(e) => handleParameterChange(index, 'description', e.target.value)} placeholder="Describe the parameter" disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                         </div>
                         <div className="flex items-center space-x-2 mt-1">
                             <Checkbox id={`param-required-${index}`} checked={param.required !== false} onCheckedChange={(checked) => handleParameterChange(index, 'required', typeof checked === 'boolean' ? checked : false)} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                             <Label htmlFor={`param-required-${index}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Required?</Label>
                         </div>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddParameter} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}>+ Add Parameter</Button>
            </div>

             {/* Expected Output */}
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="expectedOutput">Expected Output <span className="text-red-500">*</span></Label>
                <Textarea id="expectedOutput" value={genExpectedOutput} onChange={(e) => setGenExpectedOutput(e.target.value)} placeholder="Describe the expected output format or data..." rows={3} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
            </div>

             {/* Optional Fields */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid w-full items-center gap-1.5">
                     <Label htmlFor="category">Category (Optional)</Label>
                     <Input id="category" value={genCategory} onChange={(e) => setGenCategory(e.target.value)} placeholder="e.g., Web Scraping, Data Analysis" disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                 </div>
                 <div className="grid w-full items-center gap-1.5">
                     <Label htmlFor="additionalContext">Additional Context (Optional)</Label>
                     <Textarea id="additionalContext" value={genAdditionalContext} onChange={(e) => setGenAdditionalContext(e.target.value)} placeholder="Any other notes for the LLM during generation..." rows={3} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                 </div>
             </div>
              <div className="grid w-full items-center gap-1.5">
                 <Label htmlFor="examplesJson">Examples (Optional JSON Array)</Label>
                 <Textarea id="examplesJson" value={genExamplesJson} onChange={(e) => setGenExamplesJson(e.target.value)} placeholder={`[ { "input": {"arg1": "value1"}, "output": "result1" } ]`} rows={4} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} />
                 <p className="text-xs text-gray-500">Provide input/output examples as a JSON array.</p>
             </div>
        </CardContent>
         <CardFooter className="flex flex-col items-start gap-3">
              {/* Button layout/logic remains the same */}
             <div className="flex flex-wrap gap-3">
                 {/* Generate Button */}
                 <Button onClick={handleGenerateImplementation} disabled={!isDefinitionFormValid || isGeneratingDef || isCreatingTool || isUpdatingTool}>
                     {isGeneratingDef ? 'Generating...' : (hasImplementation ? 'Regenerate Implementation' : 'Generate Implementation')}
                 </Button>
                  {/* Save New Button */}
                  <Button variant="secondary" onClick={handleCreateTool} disabled={!canSaveOrUpdate || isGeneratingDef || isCreatingTool || isUpdatingTool}>
                     {isCreatingTool ? 'Saving...' : 'Save as New Tool'}
                 </Button>
                  {/* Save Updates Button - Disabled if no tool selected */}
                  <Button variant="outline" onClick={handleUpdateTool} disabled={!selectedToolDetails || !canSaveOrUpdate || isGeneratingDef || isCreatingTool || isUpdatingTool}>
                     {isUpdatingTool ? 'Saving...' : 'Save Updates to Selected Tool'}
                 </Button>
             </div>

              {/* Status messages remain the same */}
              {genDefError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Generation Error:</strong><pre className="mt-1 text-sm">{genDefError}</pre></div>}
              {createToolError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Create Error:</strong><pre className="mt-1 text-sm">{createToolError}</pre></div>}
              {createToolSuccess && <div className="text-green-700 border border-green-500 p-3 rounded w-full"><strong className="font-semibold">Success:</strong> {createToolSuccess}</div>}
              {updateToolError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full"><strong className="font-semibold">Update Error:</strong><pre className="mt-1 text-sm">{updateToolError}</pre></div>}
              {updateToolSuccess && <div className="text-green-700 border border-green-500 p-3 rounded w-full"><strong className="font-semibold">Success:</strong> {updateToolSuccess}</div>}


             {/* Implementation Display */}
              {generatedDefinition?.implementation && ( // Only show the box if implementation exists
                 <div className="border border-gray-300 p-3 bg-gray-900 text-white rounded w-full mt-2">
                     <div className="flex justify-between items-center mb-2">
                         <h4 className="text-sm font-semibold text-gray-300">Generated Implementation Code:</h4>
                         {/* --- ADD DELETE BUTTON --- */}
                         <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/50"
                            onClick={handleDeleteImplementation}
                            disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                         >
                            Delete Implementation
                         </Button>
                         {/* --- END DELETE BUTTON --- */}
                     </div>
                     <pre className="text-xs whitespace-pre-wrap break-all overflow-x-auto max-h-[400px]">{generatedDefinition.implementation}</pre>
                 </div>
              )}
             {/* --- ADJUST MESSAGES --- */}
             {!hasImplementation && isDefinitionFormValid && <p className="text-sm text-blue-600 italic mt-2">Define the structure above, then click "Generate Implementation" to create the function body.</p>}
             {!isDefinitionFormValid && <p className="text-sm text-orange-600 italic mt-2">Fill required definition fields (*) before generating/saving.</p>}
              {/* --- END ADJUST MESSAGES --- */}
         </CardFooter>
      </Card>

      {/* Section 3: Refine Tool Structure - Conditionally Visible */}
      {proposedToolRequest && (
          <Card className="border-blue-300 border-2">
              <CardHeader>
                  <CardTitle className="text-blue-700">Refine Proposed Tool Structure</CardTitle>
                  <CardDescription>Review the structure generated by Quick Start. Add modification requests and click "Refine Structure" or "Accept Structure".</CardDescription>
              </CardHeader>
               <CardContent className="flex flex-col gap-4">
                   {/* Display Proposed Structure */}
                   <div className="border p-3 rounded bg-blue-50 space-y-2">
                       <h4 className="font-semibold text-sm text-blue-800">Proposed Structure:</h4>
                       <p className="text-xs"><strong className="font-medium">Name:</strong> {proposedToolRequest.name}</p>
                       <p className="text-xs"><strong className="font-medium">Desc:</strong> {proposedToolRequest.description}</p>
                       <p className="text-xs"><strong className="font-medium">Purpose:</strong> {proposedToolRequest.purpose || '(Same as description)'}</p>
                       <p className="text-xs"><strong className="font-medium">Output:</strong> {proposedToolRequest.expectedOutput}</p>
                       <div>
                           <p className="text-xs font-medium mb-1">Inputs:</p>
                           <ul className="list-disc list-inside pl-4 text-xs">
                               {Array.isArray(proposedToolRequest.inputs) && proposedToolRequest.inputs.map((inp, i) => (
                                   <li key={i}>{inp.name} ({inp.type}) - {inp.description} {inp.required ? '(Required)' : '(Optional)'}</li>
                               ))}
                                {!Array.isArray(proposedToolRequest.inputs) && <li>(No inputs defined)</li>}
                           </ul>
                       </div>
                   </div>

                   {/* Modification Requests for Structure */}
                   <div className="border p-3 rounded-md space-y-3">
                       <Label className="font-semibold">Refinement Requests (Optional)</Label>
                       <p className="text-xs text-gray-500">Instruct the AI how to change the structure above (e.g., rename a parameter, make an input optional).</p>
                       {structureModifications.map((mod, index) => (
                           <div key={index} className="flex items-center gap-2">
                               <Input
                                  type="text"
                                  value={mod}
                                  onChange={(e) => handleStructureModificationChange(index, e.target.value)}
                                  placeholder={`e.g., Change 'pdfFilePath' to 'file_url'`}
                                  className="flex-grow"
                                  disabled={isRefining}
                               />
                               <Button variant="ghost" size="sm" onClick={() => handleRemoveStructureModification(index)} disabled={isRefining}>X</Button>
                           </div>
                       ))}
                       <Button variant="outline" size="sm" onClick={handleAddStructureModification} disabled={isRefining}>+ Add Refinement Request</Button>
                   </div>
               </CardContent>
              <CardFooter className="flex flex-wrap gap-3 items-start">
                  <Button onClick={handleRefineStructure} disabled={isRefining}>
                      {isRefining ? 'Refining...' : 'Refine Structure'}
                  </Button>
                  <Button variant="secondary" onClick={handleAcceptStructure} disabled={isRefining}>
                      Accept Structure & Populate Definition
                  </Button>
                  {refineError && <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full basis-full"><strong className="font-semibold">Refine Error:</strong><pre className="mt-1 text-sm">{refineError}</pre></div>}
              </CardFooter>
          </Card>
      )}

    </div> // End main container
  );
}

