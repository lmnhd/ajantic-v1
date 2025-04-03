"use client";

import React, { useCallback, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface KBFolderUploadProps {
  agentName: string;
  userId: string;
  onUploadComplete?: () => void;
}

interface LoadingState {
  isUploading: boolean;
  currentFile: string;
  progress: {
    uploaded: number;
    total: number;
  };
}

export default function KBFolderUpload({ agentName, userId, onUploadComplete }: KBFolderUploadProps) {
  const [loading, setLoading] = useState<LoadingState>({
    isUploading: false,
    currentFile: '',
    progress: {
      uploaded: 0,
      total: 0
    }
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      console.log("No files selected");
      return;
    }

    const files = Array.from(event.target.files);
    
    // Validate all files are either .txt or .pdf
    const invalidFiles = files.filter(file => {
      const fileType = file.type;
      const isPDF = fileType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isTXT = fileType === "text/plain" || file.name.toLowerCase().endsWith(".txt");
      return !isPDF && !isTXT;
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid Files",
        description: `Some files are not supported. Only PDF and text files are allowed.`,
        variant: "destructive",
      });
      resetFileInput();
      return;
    }

    setLoading(prev => ({
      ...prev,
      isUploading: true,
      progress: {
        uploaded: 0,
        total: files.length
      }
    }));

    try {
      for (const file of files) {
        setLoading(prev => ({
          ...prev,
          currentFile: file.name
        }));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", userId);
        formData.append("agentName", agentName);
        formData.append("namespace", `agent-kb-${userId}-${agentName}`);

        const response = await fetch("/api/kb", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }

        setLoading(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            uploaded: prev.progress.uploaded + 1
          }
        }));

        toast({
          title: "Success",
          description: `File ${file.name} added to knowledge base`,
        });
      }

      onUploadComplete?.();
    } catch (error) {
      console.error("Error processing files:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process files",
        variant: "destructive",
      });
    } finally {
      setLoading({
        isUploading: false,
        currentFile: '',
        progress: {
          uploaded: 0,
          total: 0
        }
      });
      resetFileInput();
    }
  }, [agentName, userId, onUploadComplete]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-gradient-to-t from-violet-500/70 to-indigo-500/30 rounded-sm border-t border-b border-indigo-300">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bulk File Upload</h3>
        {loading.isUploading && (
          <div className="flex items-center gap-2 text-sm text-gray-200">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              Uploading {loading.currentFile} ({loading.progress.uploaded}/{loading.progress.total})
            </span>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.txt"
          multiple
          className="hidden"
          aria-label="Upload files"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2"
          disabled={loading.isUploading}
        >
          <Upload className="w-4 h-4" />
          Upload Files
        </Button>
      </div>

      <div className="text-sm text-gray-300">
        Only .txt and .pdf files are supported
      </div>
    </div>
  );
}
