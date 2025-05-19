"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolListItem, ToolDetails } from '@/src/app/api/playground/custom-tool/types'; // Adjust path as needed
import { ToolInputParameter } from '@/src/lib/types';

interface ToolSelectionAndExecutionCardProps {
  userId: string | null;
  toolRef: string;
  onToolSelect: (value: string) => void;
  toolList: ToolListItem[];
  isListLoading: boolean;
  toolListError: string | null;
  selectedToolDetails: ToolDetails | null;
  isDetailsLoading: boolean;
  formValues: Record<string, any>;
  onFormChange: (paramName: string, value: any, type: string) => void;
  onCheckboxChange: (paramName: string, checked: boolean | 'indeterminate') => void;
  isExecuting: boolean;
  onExecute: () => void;
  isExecutionReady: boolean;
  execError: string | null;
  result: string | null;
  onClearTool: () => void; // For the clear button
  isDisabled?: boolean; // General disable flag for other operations
}

export default function ToolSelectionAndExecutionCard({
  userId,
  toolRef,
  onToolSelect,
  toolList,
  isListLoading,
  toolListError,
  selectedToolDetails,
  isDetailsLoading,
  formValues,
  onFormChange,
  onCheckboxChange,
  isExecuting,
  onExecute,
  isExecutionReady,
  execError,
  result,
  onClearTool,
  isDisabled = false,
}: ToolSelectionAndExecutionCardProps) {

  return (
    <Card className="bg-slate-700 shadow-xl border-slate-600 border overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-700 to-blue-900">
        <CardTitle className="text-blue-300">
          {selectedToolDetails ? `Execute: ${selectedToolDetails.name}` : 'Load / Execute Tool'}
        </CardTitle>
        <CardDescription className="text-slate-300">
          {selectedToolDetails
            ? 'Provide arguments and execute the selected tool.'
            : 'Select a tool from the list to load its details and enable execution.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-6 bg-slate-800">
        <div className="grid w-full items-center gap-2">
          <Label htmlFor="toolSelectGlobal" className="text-slate-300 font-medium">Select Tool</Label>
          <Select
            onValueChange={onToolSelect}
            value={toolRef || "placeholder"}
            disabled={!userId || isListLoading || isExecuting || isDisabled}
          >
            <SelectTrigger id="toolSelectGlobal" className="w-full bg-slate-700 border-slate-600 text-slate-200 focus:border-blue-500">
              <SelectValue placeholder={
                !userId ? "Waiting for User ID..." :
                (isListLoading ? "Loading tools..." : "Select a tool...")
              } />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
              <SelectItem value="placeholder" disabled>
                {!userId ? "Waiting..." : (isListLoading ? "Loading..." : "Select...")}
              </SelectItem>
              {userId && !isListLoading && toolList.length === 0 && (
                <SelectItem value="no-tools" disabled>No custom tools found</SelectItem>
              )}
              {userId && !isListLoading && toolList.map((tool) => (
                <SelectItem key={tool.id} value={tool.reference}>
                  {tool.name} <span className="text-xs text-slate-400 ml-2">({tool.reference})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {toolListError && <p className="text-sm text-red-400 mt-1">{toolListError}</p>}
        </div>

        {isDetailsLoading && <p className="text-sm text-blue-400">Loading arguments...</p>}
        {!isDetailsLoading && !selectedToolDetails && toolRef && toolRef !=='placeholder' && toolRef !== 'no-tools' && (
             <p className="text-sm text-slate-400 italic">Loading details or tool has no arguments defined...</p>
        )}
        {!isDetailsLoading && !selectedToolDetails && (!toolRef || toolRef ==='placeholder' || toolRef === 'no-tools') && (
             <p className="text-sm text-slate-400 italic">Select a tool above to view arguments.</p>
        )}
        
        {selectedToolDetails && !isDetailsLoading && (
          <div className="border border-slate-600 bg-slate-700 p-5 rounded-lg flex flex-col gap-4">
            <h3 className="text-md font-semibold text-blue-300">Arguments for Execution</h3>
            {selectedToolDetails.parameters.length === 0 && <p className="text-sm text-slate-400">No arguments required.</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedToolDetails.parameters.map((param: ToolInputParameter) => (
                <div key={param.name} className="bg-slate-800 p-3 rounded-md border border-slate-600 shadow-sm">
                  <Label htmlFor={param.name} className="text-sm font-medium text-slate-300 mb-1 block">
                    {param.description || param.name}
                    {param.required !== false && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  {param.type === 'string' && (
                    <Input
                      type="text"
                      id={param.name}
                      name={param.name}
                      value={formValues[param.name] || ''}
                      onChange={(e) => onFormChange(param.name, e.target.value, param.type)}
                      placeholder={param.description || param.name}
                      disabled={isExecuting || isDisabled}
                      className="bg-slate-700 border-slate-600 text-slate-200 focus:border-blue-500"
                    />
                  )}
                  {param.type === 'number' && (
                    <Input
                      type="number"
                      id={param.name}
                      name={param.name}
                      value={formValues[param.name] || ''}
                      onChange={(e) => onFormChange(param.name, e.target.value, param.type)}
                      placeholder={param.description || param.name}
                      disabled={isExecuting || isDisabled}
                      className="bg-slate-700 border-slate-600 text-slate-200 focus:border-blue-500"
                    />
                  )}
                  {param.type === 'boolean' && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id={param.name}
                        name={param.name}
                        checked={!!formValues[param.name]}
                        onCheckedChange={(checked) => onCheckboxChange(param.name, checked)}
                        disabled={isExecuting || isDisabled}
                        className="text-blue-600 border-blue-800 data-[state=checked]:bg-blue-700"
                      />
                      <Label htmlFor={param.name} className="text-sm text-slate-300">Enable</Label>
                    </div>
                  )}
                  {param.type !== 'string' && param.type !== 'number' && param.type !== 'boolean' && (
                    <p className="text-xs text-orange-400 mt-1">Unsupported Input Type: {param.type}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-4 p-6 bg-gradient-to-r from-slate-800 to-slate-700">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onExecute}
            disabled={!selectedToolDetails || !isExecutionReady || isExecuting || isDetailsLoading || isDisabled}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isExecuting ? 'Executing...' : 'Execute Tool'}
          </Button>
          <Button 
            variant="outline" 
            size="default" 
            onClick={onClearTool} 
            className="border-slate-500 text-slate-300 hover:bg-slate-700"
            disabled={isDisabled || isExecuting}
          >
            Clear All / Start Over
          </Button>
        </div>
        {selectedToolDetails && !isExecutionReady && (
          <p className="text-xs text-orange-400">Fill required arguments (*).</p>
        )}
        {execError && (
          <div className="text-red-400 border border-red-900 bg-red-900/25 p-3 rounded-lg whitespace-pre-wrap w-full">
            <strong className="font-semibold">Error:</strong>
            <pre className="mt-1 text-sm whitespace-pre-wrap break-words">{execError}</pre>
          </div>
        )}
        {result && (
          <div className="border border-blue-800 bg-slate-800 p-3 rounded-lg w-full">
            <strong className="font-semibold text-blue-300">Result:</strong>
            <pre className="mt-1 text-sm whitespace-pre-wrap break-all text-slate-300 bg-slate-900 p-3 rounded border border-slate-700 font-mono">
              {result}
            </pre>
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 