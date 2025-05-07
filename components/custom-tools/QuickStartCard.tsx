"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickStartCardProps {
  quickStartName: string;
  onQuickStartNameChange: (value: string) => void;
  quickStartDesc: string;
  onQuickStartDescChange: (value: string) => void;
  quickStartInputs: string;
  onQuickStartInputsChange: (value: string) => void;
  quickStartOutputs: string;
  onQuickStartOutputsChange: (value: string) => void;
  isQuickStarting: boolean;
  onQuickStart: () => void;
  quickStartError: string | null;
  // userId: string | null; // No longer needed directly in this component if onQuickStart handles it
}

export default function QuickStartCard({
  quickStartName,
  onQuickStartNameChange,
  quickStartDesc,
  onQuickStartDescChange,
  quickStartInputs,
  onQuickStartInputsChange,
  quickStartOutputs,
  onQuickStartOutputsChange,
  isQuickStarting,
  onQuickStart,
  quickStartError,
}: QuickStartCardProps) {
  return (
    <Card className="bg-slate-700 shadow-xl border-slate-600 border overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-700 to-indigo-900">
        <CardTitle className="text-indigo-300">Quick Start: Define a Tool Concept</CardTitle>
        <CardDescription className="text-slate-300">
          Provide basic details, and the AI will generate a starting structure (name, description, parameters, output) for the tool definition below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="quickStartName">Tool Name Idea</Label>
          <Input
            id="quickStartName"
            value={quickStartName}
            onChange={(e) => onQuickStartNameChange(e.target.value)}
            placeholder="e.g., PDF Text Extractor"
            disabled={isQuickStarting}
            className="bg-slate-800 border-slate-600 text-slate-200 focus:border-indigo-500"
          />
        </div>
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="quickStartDesc">Brief Description</Label>
          <Input
            id="quickStartDesc"
            value={quickStartDesc}
            onChange={(e) => onQuickStartDescChange(e.target.value)}
            placeholder="e.g., Extracts all text content from a PDF file"
            disabled={isQuickStarting}
            className="bg-slate-800 border-slate-600 text-slate-200 focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="quickStartInputs">Suggest Inputs (one per line)</Label>
            <Textarea
              id="quickStartInputs"
              value={quickStartInputs}
              onChange={(e) => onQuickStartInputsChange(e.target.value)}
              placeholder="e.g., pdfFilePath\npageNumber (optional)"
              rows={3}
              disabled={isQuickStarting}
              className="bg-slate-800 border-slate-600 text-slate-200 focus:border-indigo-500"
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="quickStartOutputs">Suggest Outputs (one per line)</Label>
            <Textarea
              id="quickStartOutputs"
              value={quickStartOutputs}
              onChange={(e) => onQuickStartOutputsChange(e.target.value)}
              placeholder="e.g., extractedText (string)\nerrorIfExists (boolean)"
              rows={3}
              disabled={isQuickStarting}
              className="bg-slate-800 border-slate-600 text-slate-200 focus:border-indigo-500"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2">
        <Button
          onClick={onQuickStart}
          disabled={isQuickStarting || !quickStartName || !quickStartDesc || !quickStartInputs || !quickStartOutputs}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isQuickStarting ? 'Generating Structure...' : 'Generate Tool Structure'}
        </Button>
        {quickStartError && (
          <div className="text-red-600 border border-red-500 p-3 rounded whitespace-pre-wrap w-full">
            <strong className="font-semibold">Quick Start Error:</strong>
            <pre className="mt-1 text-sm">{quickStartError}</pre>
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 