"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolInputParameter, ModelArgs} from '@/src/lib/types'; // Assuming types are defined here or imported
import { GeneratedToolDefinition, ToolDetails } from '@/src/app/api/playground/custom-tool/types'; // Import ToolDetails
import { ModelProviderSelect } from '@/components/global/model-provider-select';
import { AISessionState } from '@/src/lib/types';
import { CredentialRequirementInput } from '@/src/app/playground/custom-tool/page'; // Assuming this type is exported from page.tsx or a types file

interface ToolDefinitionCardProps {
  selectedToolDetails: ToolDetails | null; // To know if editing
  genName: string;
  onGenNameChange: (value: string) => void;
  genPurpose: string;
  onGenPurposeChange: (value: string) => void;
  genDescription: string;
  onGenDescriptionChange: (value: string) => void;
  genModelArgs: ModelArgs;
  onModelProviderChange: (provider: string) => void;
  onModelNameChange: (modelName: string) => void;
  onTemperatureChange: (temperature: number) => void;
  localState: AISessionState; // For ModelProviderSelect
  genModifications: string[];
  onAddModification: () => void;
  onRemoveModification: (index: number) => void;
  onModificationChange: (index: number, value: string) => void;
  genInputs: ToolInputParameter[];
  onAddParameter: () => void;
  onRemoveParameter: (index: number) => void;
  onParameterChange: (index: number, field: keyof ToolInputParameter, value: any) => void;
  credentialRequirements: CredentialRequirementInput[];
  onAddCredentialRequirement: () => void;
  onRemoveCredentialRequirement: (id: string) => void;
  onCredentialRequirementChange: (
    id: string,
    field: keyof Omit<CredentialRequirementInput, 'id' | 'isSecretSaved'> | 'currentSecretValue',
    value: string
  ) => void;
  showCredentialRequirementsSection: boolean;
  onToggleCredentialRequirements: (show: boolean) => void; // Or direct set
  toolRef?: string; // To determine if a tool is loaded for conditional credential section button
  generatedDefinition: GeneratedToolDefinition | null;
  genExpectedOutput: string;
  onGenExpectedOutputChange: (value: string) => void;
  genCategory: string;
  onGenCategoryChange: (value: string) => void;
  genAdditionalContext: string;
  onGenAdditionalContextChange: (value: string) => void;
  genExamplesJson: string;
  onGenExamplesJsonChange: (value: string) => void;
  isGeneratingDef: boolean;
  isCreatingTool: boolean;
  isUpdatingTool: boolean;
  // Footer Props
  isDefinitionFormValid: boolean;
  canSaveOrUpdate: boolean;
  hasImplementation: boolean;
  onGenerateImplementation: () => void;
  onCreateTool: () => void;
  onUpdateTool: () => void;
  onDeleteImplementation: () => void;
  genDefError: string | null;
  createToolError: string | null;
  updateToolError: string | null;
  createToolSuccess: string | null;
  updateToolSuccess: string | null;
  onSaveCredentialSecret: (id: string) => void;
}

export default function ToolDefinitionCard({
  selectedToolDetails,
  genName, onGenNameChange,
  genPurpose, onGenPurposeChange,
  genDescription, onGenDescriptionChange,
  genModelArgs, onModelProviderChange, onModelNameChange, onTemperatureChange, localState,
  genModifications, onAddModification, onRemoveModification, onModificationChange,
  genInputs, onAddParameter, onRemoveParameter, onParameterChange,
  credentialRequirements, onAddCredentialRequirement, onRemoveCredentialRequirement, onCredentialRequirementChange,
  showCredentialRequirementsSection, onToggleCredentialRequirements,
  toolRef,
  generatedDefinition,
  genExpectedOutput, onGenExpectedOutputChange,
  genCategory, onGenCategoryChange,
  genAdditionalContext, onGenAdditionalContextChange,
  genExamplesJson, onGenExamplesJsonChange,
  isGeneratingDef, isCreatingTool, isUpdatingTool,
  // Footer Props
  isDefinitionFormValid,
  canSaveOrUpdate,
  hasImplementation,
  onGenerateImplementation,
  onCreateTool,
  onUpdateTool,
  onDeleteImplementation,
  genDefError,
  createToolError,
  updateToolError,
  createToolSuccess,
  updateToolSuccess,
  onSaveCredentialSecret
}: ToolDefinitionCardProps) {

  const [isLlmConfigOpen, setIsLlmConfigOpen] = useState(false);
  const [isInputParamsOpen, setIsInputParamsOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);

  // Internal display logic for model provider select
  const displayModelProp = { ...genModelArgs }; 

  return (
    <Card className="bg-slate-700 shadow-xl border-slate-600 border overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-700 to-purple-900">
        <CardTitle className="text-purple-300">
          {selectedToolDetails ? `Tool Implementation: ${genName || '(Loading...)'}` : 'Tool Implementation'}
        </CardTitle>
        <CardDescription className="text-slate-300">
          {selectedToolDetails
            ? 'Modify the definition or implementation below. Use "Generate..." to update the code, then "Save Updates..." to persist.'
            : 'Define the structure, generate the implementation, and use "Save as New Tool". Select a tool above to load it for editing.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-6 bg-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="toolNameDef" className="text-slate-300 font-medium">Tool Name <span className="text-red-400">*</span></Label>
            <Input
              id="toolNameDef"
              value={genName}
              onChange={(e) => onGenNameChange(e.target.value)}
              placeholder="e.g., CLICKBANK_MARKETPLACE_ANALYZER"
              disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
              className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400"
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="toolPurposeDef" className="text-slate-300 font-medium">Tool Purpose (Optional)</Label>
            <Input
              id="toolPurposeDef"
              value={genPurpose}
              onChange={(e) => onGenPurposeChange(e.target.value)}
              placeholder="Defaults to description if empty"
              disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
              className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="toolDescriptionDef" className="text-slate-300 font-medium">Description <span className="text-red-400">*</span></Label>
          <Textarea
            id="toolDescriptionDef"
            value={genDescription}
            onChange={(e) => onGenDescriptionChange(e.target.value)}
            placeholder="Describe what the tool does..."
            rows={3}
            disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
            className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400"
          />
        </div>

        <details open={isLlmConfigOpen} onToggle={(e) => setIsLlmConfigOpen(e.currentTarget.open)} className="border border-slate-600 rounded-md bg-slate-700">
          <summary className="list-none cursor-pointer p-3 flex justify-between items-center">
            <span className="font-semibold text-slate-300">{isLlmConfigOpen ? '[-] ' : '[+] '}LLM Configuration (for generation)</span>
          </summary>
          <div className="p-3 border-t border-slate-600">
            <ModelProviderSelect
              model={displayModelProp}
              modelProviderChanged={onModelProviderChange}
              modelNameChanged={onModelNameChange}
              temperatureChanged={onTemperatureChange}
              index={0}
              localState={localState}
            />
          </div>
        </details>

        {generatedDefinition?.implementation && (
          <div className="border border-slate-600 p-4 rounded-lg space-y-3 bg-gradient-to-r from-slate-700 to-slate-800">
            <div className="flex justify-between items-center">
              <Label className="font-semibold text-teal-300">Modification Requests (Optional)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddModification}
                disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                className="text-xs border-teal-800 bg-slate-800 text-teal-300 hover:bg-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14"></path></svg>
                Add Request
              </Button>
            </div>
            <p className="text-xs text-teal-400/70">Provide instructions to the LLM on how to generate or modify the implementation code.</p>
            <div className="space-y-2">
              {genModifications.map((mod, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-700 p-2 rounded-md border border-slate-600 shadow-sm">
                  <Input
                    type="text"
                    value={mod}
                    onChange={(e) => onModificationChange(index, e.target.value)}
                    placeholder={`e.g., Add error handling for network requests`}
                    className="flex-grow text-sm bg-slate-800 border-slate-600 text-slate-200"
                    disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveModification(index)}
                    disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                    className="h-8 w-8 p-0 text-teal-400 hover:text-red-400 hover:bg-slate-900/50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              ))}
              {genModifications.length === 0 && (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-md border border-dashed border-teal-800">
                  <p className="text-teal-300 text-sm mb-2">No modification requests yet</p>
                  <p className="text-xs text-center text-teal-400/70 mb-2">Add requests to guide how the AI should implement or improve the code</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddModification}
                    disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                    className="text-xs border-teal-800 bg-slate-800 text-teal-300 hover:bg-slate-700"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14"></path></svg>
                    Add First Request
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <details open={isInputParamsOpen} onToggle={(e) => setIsInputParamsOpen(e.currentTarget.open)} className="border border-slate-600 rounded-lg bg-gradient-to-r from-slate-700 to-slate-800">
          <summary className="list-none cursor-pointer p-5 flex justify-between items-center">
            <span className="font-semibold text-amber-300">{isInputParamsOpen ? '[-] ' : '[+] '}Input Parameters <span className="text-red-400">*</span></span>
            <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); onAddParameter(); if (!isInputParamsOpen) setIsInputParamsOpen(true); }} disabled={isGeneratingDef || isCreatingTool || isUpdatingTool} className="text-xs border-amber-800 bg-slate-800 text-amber-300 hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14"></path></svg>
              Add Parameter
            </Button>
          </summary>
          <div className="p-5 border-t border-slate-600 space-y-4">
            {genInputs.map((param, index) => (
              <div key={index} className="flex flex-col space-y-2 bg-slate-700 p-3 rounded-md border border-slate-600 shadow-sm">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-amber-300">Parameter #{index + 1}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveParameter(index)}
                    disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                    className="h-8 w-8 p-0 text-amber-400 hover:text-red-400 hover:bg-slate-900/50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor={`param-name-${index}-def`} className="text-xs text-slate-300">Name <span className="text-red-400">*</span></Label>
                    <Input
                      id={`param-name-${index}-def`}
                      value={param.name}
                      onChange={(e) => onParameterChange(index, 'name', e.target.value)}
                      placeholder="e.g., apiKey"
                      disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                      className="bg-slate-800 border-slate-600 text-slate-200 text-sm"
                    />
                  </div>
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor={`param-type-${index}-def`} className="text-xs text-slate-300">Type <span className="text-red-400">*</span></Label>
                    <Select
                      value={param.type}
                      onValueChange={(value) => onParameterChange(index, 'type', value)}
                      disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                    >
                      <SelectTrigger id={`param-type-${index}-def`} className="bg-slate-800 border-slate-600 text-slate-200 text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
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
                  <Label htmlFor={`param-desc-${index}-def`} className="text-xs text-slate-300">Description <span className="text-red-400">*</span></Label>
                  <Input
                    id={`param-desc-${index}-def`}
                    value={param.description}
                    onChange={(e) => onParameterChange(index, 'description', e.target.value)}
                    placeholder="Describe this parameter..."
                    disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                    className="bg-slate-800 border-slate-600 text-slate-200 text-sm"
                  />
                </div>
                <div className="flex items-center space-x-6 mt-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`param-required-${index}-def`}
                      checked={param.required !== false}
                      onCheckedChange={(checked) => onParameterChange(index, 'required', !!checked)}
                      disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                      className="text-amber-600 border-amber-800 data-[state=checked]:bg-amber-700"
                    />
                    <Label htmlFor={`param-required-${index}-def`} className="text-xs text-slate-300">Required</Label>
                  </div>
                  <div className="grid w-full items-center gap-1 grow">
                    <Label htmlFor={`param-default-${index}-def`} className="text-xs text-slate-300">Default Value (Optional)</Label>
                    <Input
                      id={`param-default-${index}-def`}
                      value={param.default !== undefined ? String(param.default) : ''}
                      onChange={(e) => {
                        let val: any = e.target.value;
                        if (param.type === 'number' && val) { val = Number(val); }
                        if (param.type === 'boolean') { val = val.toLowerCase() === 'true'; }
                        onParameterChange(index, 'default', val);
                      }}
                      placeholder="Default value"
                      disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                      className="bg-slate-800 border-slate-600 text-slate-200 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            {genInputs.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-md border border-dashed border-amber-800 my-3">
                <p className="text-amber-300 text-sm mb-2">No parameters defined yet</p>
                <p className="text-xs text-center text-amber-400/70 mb-3">Define the inputs your tool will accept</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddParameter}
                  disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                  className="text-xs border-amber-800 bg-slate-800 text-amber-300 hover:bg-slate-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14"></path></svg>
                  Add First Parameter
                </Button>
              </div>
            )}
          </div>
        </details>

        {(showCredentialRequirementsSection || credentialRequirements.length > 0) && (toolRef || genName || generatedDefinition) ? (
          <details open={isCredentialsOpen} onToggle={(e) => setIsCredentialsOpen(e.currentTarget.open)} className="border border-slate-600 rounded-lg bg-gradient-to-r from-slate-700 to-slate-800 mt-5">
            <summary className="list-none cursor-pointer p-5 flex justify-between items-center">
                <span className="font-semibold text-pink-300">{isCredentialsOpen ? '[-] ' : '[+] '}Required Credentials</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { 
                    e.preventDefault(); 
                    onAddCredentialRequirement(); 
                    if (!isCredentialsOpen) setIsCredentialsOpen(true); 
                    if (!showCredentialRequirementsSection) onToggleCredentialRequirements(true);
                  }}
                  disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                  className="text-xs border-pink-800 bg-slate-800 text-pink-300 hover:bg-slate-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 5v14M5 12h14"></path></svg>
                  Add Credential
                </Button>
            </summary>
            <div className="p-5 border-t border-slate-600 space-y-4">
              {credentialRequirements.map((cred, index) => (
                <div key={cred.id} className="flex flex-col space-y-3 bg-slate-700 p-4 rounded-md border border-slate-600 shadow-sm">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium text-pink-300">Credential #{index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveCredentialRequirement(cred.id)}
                      disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                      className="h-8 w-8 p-0 text-pink-400 hover:text-red-400 hover:bg-slate-900/50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid w-full items-center gap-1.5">
                      <Label htmlFor={`cred-name-${cred.id}-def`} className="text-xs text-slate-300">Name (as ENV VAR) <span className="text-red-400">*</span></Label>
                      <Input
                        id={`cred-name-${cred.id}-def`}
                        value={cred.name}
                        onChange={(e) => onCredentialRequirementChange(cred.id, 'name', e.target.value)}
                        placeholder="e.g., OPENAI_API_KEY"
                        disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                        className="bg-slate-800 border-slate-600 text-slate-200 text-sm"
                      />
                      <p className="text-xs text-slate-400">Unique identifier for the credential.</p>
                    </div>
                    <div className="grid w-full items-center gap-1.5">
                      <Label htmlFor={`cred-label-${cred.id}-def`} className="text-xs text-slate-300">User-Friendly Label <span className="text-red-400">*</span></Label>
                      <Input
                        id={`cred-label-${cred.id}-def`}
                        value={cred.label}
                        onChange={(e) => onCredentialRequirementChange(cred.id, 'label', e.target.value)}
                        placeholder="e.g., OpenAI API Key"
                        disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                        className="bg-slate-800 border-slate-600 text-slate-200 text-sm"
                      />
                      <p className="text-xs text-slate-400">How it will be shown to the user.</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-3 border-t border-slate-600/50 space-y-2">
                    <Label htmlFor={`cred-secret-${cred.id}-def`} className="text-xs text-slate-300">
                      Secret Value
                      {cred.isSecretSaved && <span className="ml-2 text-green-400 font-semibold">(Saved ✔️)</span>}
                      {!cred.isSecretSaved && <span className="ml-2 text-yellow-400 font-semibold">(Not Saved)</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`cred-secret-${cred.id}-def`}
                        type="password"
                        value={cred.currentSecretValue}
                        onChange={(e) => onCredentialRequirementChange(cred.id, 'currentSecretValue', e.target.value)}
                        placeholder={cred.isSecretSaved ? "Enter new secret to update" : "Enter the secret value"}
                        disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
                        className="bg-slate-800 border-slate-600 text-slate-200 text-sm flex-grow"
                      />
                      <Button
                        size="sm"
                        onClick={() => onSaveCredentialSecret(cred.id)}
                        disabled={isGeneratingDef || isCreatingTool || isUpdatingTool || !cred.currentSecretValue.trim()}
                        className="text-xs bg-green-700 hover:bg-green-800 text-white disabled:opacity-60"
                      >
                        {cred.isSecretSaved ? 'Update Secret' : 'Save Secret'}
                      </Button>
                    </div>
                    {cred.isSecretSaved && (
                       <p className="text-xs text-slate-400">To update, enter the new secret above and click "Update Secret".</p>
                    )}
                  </div>
                </div>
              ))}
              {credentialRequirements.length === 0 && showCredentialRequirementsSection && (
                <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-md border border-dashed border-pink-800 my-3">
                  <p className="text-pink-300 text-sm mb-2">No credential requirements defined yet for this tool.</p>
                  <p className="text-xs text-pink-400/70 mb-2">Click "Add Credential" above to start.</p>
                </div>
              )}
            </div>
          </details>
        ) : (
          (toolRef || genName || generatedDefinition) && !showCredentialRequirementsSection && credentialRequirements.length === 0 &&
          <div className="mt-5 py-3 border-t border-b border-slate-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onToggleCredentialRequirements(true);
                if (credentialRequirements.length === 0) { onAddCredentialRequirement(); }
                setIsCredentialsOpen(true);
              }}
              disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
              className="text-xs border-pink-800 bg-slate-800 text-pink-300 hover:bg-slate-700 w-full justify-start"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 5v14M5 12h14"></path></svg>
              Add / Define Required Credentials (Optional)
            </Button>
          </div>
        )}

        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="expectedOutputDef" className="text-slate-300 font-medium">Expected Output <span className="text-red-400">*</span></Label>
          <Textarea
            id="expectedOutputDef"
            value={genExpectedOutput}
            onChange={(e) => onGenExpectedOutputChange(e.target.value)}
            placeholder="Describe the expected output format or data..."
            rows={3}
            disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
            className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="categoryDef" className="text-slate-300 font-medium">Category (Optional)</Label>
            <Input
              id="categoryDef"
              value={genCategory}
              onChange={(e) => onGenCategoryChange(e.target.value)}
              placeholder="e.g., Web Scraping, Data Analysis"
              disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
              className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400"
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="additionalContextDef" className="text-slate-300 font-medium">Additional Context (Optional)</Label>
            <Textarea
              id="additionalContextDef"
              value={genAdditionalContext}
              onChange={(e) => onGenAdditionalContextChange(e.target.value)}
              placeholder="Any other notes for the LLM during generation..."
              rows={3}
              disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
              className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="examplesJsonDef" className="text-slate-300 font-medium">Examples (Optional JSON Array)</Label>
          <Textarea
            id="examplesJsonDef"
            value={genExamplesJson}
            onChange={(e) => onGenExamplesJsonChange(e.target.value)}
            placeholder={`[ { "input": {"arg1": "value1"}, "output": "result1" } ]`}
            rows={4}
            disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
            className="bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500 placeholder:text-slate-400 font-mono text-sm"
          />
          <p className="text-xs text-slate-400">Provide input/output examples as a JSON array.</p>
        </div>
      </CardContent>

      {/* Footer with action buttons and messages */}
      <CardFooter className="flex flex-col items-start gap-3 p-6 bg-gradient-to-r from-slate-800 to-slate-700">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onGenerateImplementation}
            disabled={!isDefinitionFormValid || isGeneratingDef || isCreatingTool || isUpdatingTool}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isGeneratingDef ? 'Generating...' : (hasImplementation ? 'Regenerate Implementation' : 'Generate Implementation')}
          </Button>
          <Button
            variant="secondary"
            onClick={onCreateTool}
            disabled={!canSaveOrUpdate || isGeneratingDef || isCreatingTool || isUpdatingTool}
            className="bg-teal-800 hover:bg-teal-900 text-teal-200 border-none"
          >
            {isCreatingTool ? 'Saving...' : 'Save as New Tool'}
          </Button>
          <Button
            variant="outline"
            onClick={onUpdateTool}
            disabled={!selectedToolDetails || !canSaveOrUpdate || isGeneratingDef || isCreatingTool || isUpdatingTool}
            className="border-indigo-700 text-indigo-300 hover:bg-slate-700"
          >
            {isUpdatingTool ? 'Saving...' : 'Save Updates to Selected Tool'}
          </Button>
        </div>

        {genDefError && <div className="text-red-400 border border-red-900 bg-red-900/25 p-3 rounded-lg whitespace-pre-wrap w-full"><strong className="font-semibold">Generation Error:</strong><pre className="mt-1 text-sm">{genDefError}</pre></div>}
        {createToolError && <div className="text-red-400 border border-red-900 bg-red-900/25 p-3 rounded-lg whitespace-pre-wrap w-full"><strong className="font-semibold">Create Error:</strong><pre className="mt-1 text-sm">{createToolError}</pre></div>}
        {createToolSuccess && <div className="text-green-400 border border-green-900 bg-green-900/25 p-3 rounded-lg w-full"><strong className="font-semibold">Success:</strong> {createToolSuccess}</div>}
        {updateToolError && <div className="text-red-400 border border-red-900 bg-red-900/25 p-3 rounded-lg whitespace-pre-wrap w-full"><strong className="font-semibold">Update Error:</strong><pre className="mt-1 text-sm">{updateToolError}</pre></div>}
        {updateToolSuccess && <div className="text-green-400 border border-green-900 bg-green-900/25 p-3 rounded-lg w-full"><strong className="font-semibold">Success:</strong> {updateToolSuccess}</div>}

        {generatedDefinition?.implementation && (
          <div className="border border-indigo-800 p-4 bg-gradient-to-r from-slate-800 to-indigo-900/50 rounded-lg w-full mt-4 shadow-md">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-indigo-300">Generated Implementation Code:</h4>
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 border-red-700 bg-slate-800/80 hover:bg-red-900/30"
                onClick={onDeleteImplementation}
                disabled={isGeneratingDef || isCreatingTool || isUpdatingTool}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete Implementation
              </Button>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-md shadow-inner">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all overflow-x-auto p-4 max-h-[400px] overflow-y-auto font-mono">
                {typeof generatedDefinition.implementation === 'object'
                  ? JSON.stringify(generatedDefinition.implementation, null, 2)
                  : generatedDefinition.implementation}
              </pre>
            </div>
          </div>
        )}
        {!hasImplementation && isDefinitionFormValid && <p className="text-sm text-indigo-400 italic mt-2">Define the structure above, then click "Generate Implementation" to create the function body.</p>}
        {!isDefinitionFormValid && <p className="text-sm text-amber-400 italic mt-2">Fill required definition fields (*) before generating/saving.</p>}
      </CardFooter>
    </Card>
  );
}
