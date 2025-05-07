"use client"; // Required for useState, useEffect, event handlers

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface CredentialInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialName: string | null; // The name identifier (e.g., "OPENAI_API_KEY")
  serviceName?: string | null; // Optional service name for context
  onSaveSuccess: () => void; // Callback to trigger retry after successful save
}

export function CredentialInputModal({
  isOpen,
  onClose,
  credentialName,
  serviceName,
  onSaveSuccess,
}: CredentialInputModalProps) {
  const [credentialValue, setCredentialValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Clear input when modal opens or credentialName changes
  useEffect(() => {
    if (isOpen) {
      setCredentialValue('');
      setIsSaving(false);
    }
  }, [isOpen, credentialName]);

  const handleSave = async () => {
    if (!credentialName || !credentialValue.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter the credential value.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Calls the API endpoint we created earlier
      const response = await fetch('/api/custom-tool-credentials/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialName: credentialName,
          credentialValue: credentialValue,
          serviceName: serviceName || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to save credential (HTTP ${response.status})`);
      }

      toast({
        title: "Success!",
        description: `Credential "${credentialName}" saved securely.`,
        variant: "default", // Use "default" or potentially a "success" variant
      });
      onSaveSuccess(); // Trigger the retry/continuation callback
      onClose(); // Close the modal

    } catch (error) {
      console.error("Error saving credential:", error);
      toast({
        title: "Error Saving Credential",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Enter key press in the input field
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isSaving) {
      handleSave();
    }
  };

  // Render null if not open or no credentialName is provided
  if (!isOpen || !credentialName) {
      return null;
  }

  return (
    // The Dialog component handles overlay and positioning
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-600 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-indigo-300">Input Required Credential</DialogTitle>
          <DialogDescription className="text-slate-400">
            The agent needs the credential <code className="bg-slate-900 text-amber-300 px-1 rounded">{credentialName}</code> to proceed.
            It will be stored securely and encrypted.
            {serviceName && ` This is likely for the ${serviceName} service.`}
          </DialogDescription>
        </DialogHeader>
        {/* Form elements styled according to design system via shadcn base */}
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="credential-name" className="text-right col-span-1 text-slate-300">
              Name
            </Label>
            <Input
              id="credential-name"
              value={credentialName}
              disabled
              className="col-span-3 bg-slate-700 border-slate-600 text-slate-400" // Explicit styling example
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="credential-value" className="text-right col-span-1 text-slate-300">
              Value
            </Label>
            <Input
              id="credential-value"
              type="password" // Mask input
              value={credentialValue}
              onChange={(e) => setCredentialValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter the credential value"
              className="col-span-3 bg-slate-700 border-slate-600 focus:border-indigo-500" // Style according to design system
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
             <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}
               className="border-slate-600 text-slate-300 hover:bg-slate-700">
               Cancel
             </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isSaving ? 'Saving...' : 'Save Credential'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
