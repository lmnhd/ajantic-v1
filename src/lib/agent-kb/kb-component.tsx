import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { File, Globe, Link, Trash2, Upload, Loader2, Sparkles, Maximize2 } from "lucide-react";
import {
  KnowledgeBaseEntry,
  KnowledgeBaseProps,
  KnowledgeBaseState,
} from "./types";
import KBFolderUpload from "./kb-folder-upload";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/src/lib/logger";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn, UTILS_getGenericData } from "@/src/lib/utils";
import { useFullscreen } from "../useFullscreen";


// Loading overlay component that displays during async operations
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-md">
      <div className="flex flex-col items-center gap-2 text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
        <div className="flex items-center">
          <span>{message}</span>
          <span className="animate-pulse">.</span>
          <span className="animate-pulse animation-delay-200">.</span>
          <span className="animate-pulse animation-delay-400">.</span>
        </div>
      </div>
    </div>
  );
}

// Add this helper function at the top of the file
function groupEntriesByGroupId(entries: KnowledgeBaseEntry[]) {
  return entries.reduce((groups, entry) => {
    const groupId = entry.metadata.groupId;
    if (groupId) {
      // Only proceed if groupId exists
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(entry);
    }
    return groups;
  }, {} as Record<string, KnowledgeBaseEntry[]>);
}

// Add this helper function at the top of the file
function getDisplayName(
  urlString: string,
  isMainGroup: boolean = false,
  metadata?: any
): string {
  if (!urlString) return "Unknown Source";

  // Handle Perplexity entries
  if (metadata?.implementation === 'perplexity') {
    return metadata.title || "Untitled Research";
  }

  try {
    if (isMainGroup) {
      return urlString;
    }
    const url = new URL(urlString);
    return url.pathname || url.hostname;
  } catch (e) {
    return urlString.split("/").pop() || urlString;
  }
}

// Add this helper at the top with other helpers
function getUniqueDocuments(entries: KnowledgeBaseEntry[]) {
  const documentMap = new Map<string, KnowledgeBaseEntry>();

  entries.forEach((entry) => {
    const documentId = entry.metadata.documentId;
    if (!documentId) return;

    // If we haven't seen this document yet, or if this is the first chunk (chunkIndex === 0)
    if (!documentMap.has(documentId) || entry.metadata.chunkIndex === 0) {
      documentMap.set(documentId, entry);
    }
  });

  return Array.from(documentMap.values());
}

// TODO: Add auto build knowledge base using perplexity
// TODO: Create "Iteration" process for prompts and more (ex. send the current prompt, linesets, and message history to a model to refine the prompt)
// TODO: Add character generator for writers and such who need unique character -
// TODO:character section inspired by
export default function KnowledgeBaseComponent({
  agentName,
  userId,
  onKnowledgeBaseUpdate,
  setHasKnowledgeBase,
  isEnabled,
  autoKBArgs,
 
  localState,
  toggleFullScreen,
}: KnowledgeBaseProps) {
  const [state, setState] = useState<KnowledgeBaseState>({
    entries: [],
    isEnabled: isEnabled || false,
    crawlAllLinks: false,
    crawlDepth: 2,
    loadingStates: {
      isUploadingFile: false,
      isProcessingUrl: false,
      isFetchingEntries: false,
      isDeleting: false,
      isClearing: false,
      isAutoCreating: false
    },
  });
  const [currentAgentName, setCurrentAgentName] = useState(agentName);
  const [loadEntriesLocked, setLoadEntriesLocked] = useState(false)
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kbId = useMemo(
    () => `agent-kb-${userId}-${agentName}`,
    [userId, agentName]
  );
  const [firstLoad, setFirstLoad] = useState(true);
  // Add state for tracking expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );



  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const loadEntries = useCallback(async () => {
    if (state.loadingStates.isFetchingEntries || loadEntriesLocked) return;
    console.log("Loading entries for ", agentName, " kbId = ", kbId);

    const _entries = UTILS_getGenericData(kbId, {
      history: [],
      currentState: localState,
    });
   if (_entries){
      setState((prev) => ({
        ...prev,
        entries: _entries,
      }));
      setLoadEntriesLocked(true);
      return;
    }

    setLoadEntriesLocked(true);

    setState((prev) => ({
      ...prev,
      loadingStates: { ...prev.loadingStates, isFetchingEntries: true },
    }));
    try {
      console.log("Fetching Entries for ", kbId);
      const _entries = await fetch(`/api/kb-entries/${kbId}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      const entries = await _entries.json();
      console.log("Loaded entries:", entries);
      setState((prev) => ({
        ...prev,
        entries,
        loadingStates: { ...prev.loadingStates, isFetchingEntries: false },
      }));

      if (entries.length > 0) {
        setHasKnowledgeBase?.(true);
      }
    } catch (error) {
      console.error("Error loading entries:", error);
      setState((prev) => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, isFetchingEntries: false },
      }));
    }
  }, [kbId, setHasKnowledgeBase, loadEntriesLocked]);

  useEffect(() => {
    if (agentName !== currentAgentName || firstLoad) {
      console.log("Agent name changed to ", agentName);
      setFirstLoad(false)
      setCurrentAgentName(agentName);
      setLoadEntriesLocked(false);
      loadEntries();
    }
  }, [agentName, currentAgentName, loadEntries]);

  const handleKnowledgeBaseUpdate = useCallback(
    (checked: boolean) => {
      setState((prev) => ({ ...prev, isEnabled: checked }));
      setHasKnowledgeBase?.(checked);
      if (checked) {
        setLoadEntriesLocked(false);
        loadEntries();
      }
    },
    [loadEntries, setHasKnowledgeBase, setLoadEntriesLocked]
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      // Early return if no files selected
      if (!event.target.files || event.target.files.length === 0) {
        console.log("No file selected");
        return;
      }

      const file = event.target.files[0];
      if (!agentName || !userId) {
        console.log("Missing agentName or userId");
        resetFileInput();
        return;
      }

      // Log file details for debugging
      console.log("File selected:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const fileType = file.type;
      // Check for both MIME types and file extensions
      const isPDF =
        fileType === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const isTXT =
        fileType === "text/plain" || file.name.toLowerCase().endsWith(".txt");

      if (!isPDF && !isTXT) {
        toast({
          title: "Error",
          description: "Only PDF and text files are supported",
          variant: "destructive",
        });
        resetFileInput();
        return;
      }

      setState((prev) => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, isUploadingFile: true },
      }));

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", userId);
        formData.append("agentName", agentName);
        formData.append("namespace", `agent-kb-${userId}-${agentName}`);

        console.log("Uploading file...");
        const response = await fetch("/api/kb", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        console.log("Upload response:", data);

        if (!response.ok) {
          throw new Error(data.error || "Failed to upload file");
        }

        toast({
          title: "Success",
          description: `File ${file.name} added to knowledge base for ${agentName}`,
        });
        onKnowledgeBaseUpdate?.();
        setHasKnowledgeBase?.(true);
        setLoadEntriesLocked(false);
        loadEntries();
      } catch (error) {
        console.error("Error processing file:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to process file",
          variant: "destructive",
        });
      } finally {
        setState((prev) => ({
          ...prev,
          loadingStates: { ...prev.loadingStates, isUploadingFile: false },
        }));
        resetFileInput();
      }
    },
    [agentName, userId, toast, loadEntries, resetFileInput]
  );

  const handleLinkAdd = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const url = formData.get("url") as string;
      if (!url) return;

      setState((prev) => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, isProcessingUrl: true },
      }));

      try {
        // Choose endpoint based on crawl option
        const endpoint = state.crawlAllLinks ? "/api/kb-site" : "/api/kb";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            userId,
            agentName,
            namespace: kbId,
            type: "url",
            maxPages: state.crawlAllLinks ? 20 : 1,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to add link");
        }

        toast({
          title: "Success",
          description: `Link added to knowledge base for ${agentName}`,
        });
        onKnowledgeBaseUpdate?.();
        setHasKnowledgeBase?.(true);
        setLoadEntriesLocked(false);
        await loadEntries();
        (event.target as HTMLFormElement).reset();
      } catch (error) {
        console.error("Error adding link:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to add link content",
          variant: "destructive",
        });
      } finally {
        setState((prev) => ({
          ...prev,
          loadingStates: { ...prev.loadingStates, isProcessingUrl: false },
        }));
      }
    },
    [
      agentName,
      userId,
      toast,
      loadEntries,
      onKnowledgeBaseUpdate,
      kbId,
      state.crawlAllLinks,
    ]
  );

  const handleDeleteEntry = useCallback(
    async (
      id: string, 
      isGroup: boolean = false, 
      groupId?: string, 
      documentId?: string,
      silent: boolean = false
    ) => {
      if (state.loadingStates.isDeleting) return;

      setState((prev) => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, isDeleting: true },
      }));

      try {
        const response = await fetch(`/api/kb-entries/${kbId}/${id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isGroup, groupId, documentId }),
        });

        if (!response.ok) throw new Error("Failed to delete entry");

        // Refresh entries after deletion
        setLoadEntriesLocked(false);
        await loadEntries();
        
        if (!silent) {
          toast({
            title: "Success",
            description: "Entry deleted successfully",
          });
        }
      } catch (error) {
        console.error("Error deleting entry:", error);
        if (!silent) {
          toast({
            title: "Error",
            description: "Failed to delete entry",
            variant: "destructive",
          });
        }
      } finally {
        setState((prev) => ({
          ...prev,
          loadingStates: { ...prev.loadingStates, isDeleting: false },
        }));
      }
    },
    [kbId, loadEntries, state.loadingStates.isDeleting, toast, setLoadEntriesLocked]
  );

  const handleClear = useCallback(async () => {
    if (
      !confirm(`Are you sure you want to clear ${agentName}&apos;s knowledge base?`)
    )
      return;

    setState((prev) => ({
      ...prev,
      loadingStates: { ...prev.loadingStates, isClearing: true },
    }));
    try {
      const allInNameSpace = true;
      const namespace = `agent-kb-${userId}-${agentName}`;
      const ids = [""];
      const success = await fetch(`/api/kb`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vectorId: ids, namespace, allInNameSpace }),
      });
      if (success) {
        toast({
          title: "Success",
          description: `Knowledge base cleared for ${agentName}`,
        });
        onKnowledgeBaseUpdate?.();
        setHasKnowledgeBase?.(false);
        setState((prev) => ({ ...prev, entries: [] }));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear knowledge base",
        variant: "destructive",
      });
    } finally {
      setState((prev) => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, isClearing: false },
      }));
    }
  }, [agentName, userId, setHasKnowledgeBase, setLoadEntriesLocked]);

  const handleAutoCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      logger.log("Starting auto-create knowledge base process");
      
      // Set agent active at start
      autoKBArgs?.setAgentActive?.(true);

      // Check for existing Perplexity entries
      const perplexityEntries = state.entries.filter(
        entry => entry.metadata.implementation === 'perplexity'
      );

      if (perplexityEntries.length > 0) {
        const confirmReplace = window.confirm(
          "Existing auto-generated knowledge base detected. Creating a new one will replace the old entries. Do you want to continue?"
        );
        if (!confirmReplace) {
          logger.debug("User cancelled auto-create");
          autoKBArgs?.setAgentActive?.(false);  // Reset active state if cancelled
          return;
        }
        // ... deletion logic ...
      }

      const formData = new FormData(event.currentTarget);
      const responsibilities = formData.get("responsibilities") as string;
      let responsibilitiesArray: string[] = [];
      
      // Only process responsibilities if they were entered
      if (responsibilities?.trim()) {
        responsibilitiesArray = responsibilities
          .split('\n')
          .map(r => r.trim())
          .filter(Boolean);
        logger.debug("Parsed responsibilities:", responsibilitiesArray);
      } else {
        logger.debug("No responsibilities provided, checking autoKBArgs");
      }

      // Validate that we have either responsibilities or autoKBArgs
      if (responsibilitiesArray.length === 0 && 
          !autoKBArgs?.agentTitle && 
          !autoKBArgs?.agentRole && 
          !autoKBArgs?.teamObjectives) {
        const message = "Please provide either responsibilities or agent details (title, role, or objectives)";
        logger.debug("Validation failed:", {message});
        window.alert(message);
        toast({
          title: "Missing Information",
          description: message,
          variant: "destructive",
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        loadingStates: { ...prev.loadingStates, isAutoCreating: true },
      }));

      try {
        logger.tool("Sending auto-create request to API", {
          agentName,
          userId,
          responsibilitiesCount: responsibilitiesArray.length,
          hasAgentTitle: !!autoKBArgs?.agentTitle,
          hasAgentRole: !!autoKBArgs?.agentRole,
          hasTeamObjectives: !!autoKBArgs?.teamObjectives
        });

        const response = await fetch("/api/kb-auto-create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentName,
            userId,
            responsibilities: responsibilitiesArray,
            agentTitle: autoKBArgs?.agentTitle || "",
            agentRole: autoKBArgs?.agentRole || "",
            teamObjectives: autoKBArgs?.teamObjectives || ""
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          logger.debug("Auto-create API error response:", error);
          throw new Error(error.message || "Failed to auto-create knowledge base");
        }

        const result = await response.json();
        logger.debug("Auto-create API success response:", result);

        toast({
          title: "Success",
          description: `Knowledge base auto-created for ${agentName}`,
        });
        onKnowledgeBaseUpdate?.();
        setHasKnowledgeBase?.(true);
        await loadEntries();
        (event.target as HTMLFormElement).reset();
        
        logger.log("Successfully completed auto-create knowledge base process");
      } catch (error) {
        logger.debug("Error in auto-create process:", {error});
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to auto-create knowledge base",
          variant: "destructive",
        });
      } finally {
        setState((prev) => ({
          ...prev,
          loadingStates: { ...prev.loadingStates, isAutoCreating: false },
        }));
      }
    },
    [agentName, userId, toast, loadEntries, onKnowledgeBaseUpdate, setHasKnowledgeBase, autoKBArgs]
  );

  return (
    <div className="flex flex-col min-w-[300px] gap-4 relative p-4 bg-gradient-to-t from-violet-500/70 to-indigo-500/30 rounded-sm border-t border-b border-indigo-300" >
      {/* Main toggle for enabling/disabling the knowledge base */}
      <div
      className={cn("flex items-center justify-between")}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            checked={state.isEnabled}
            onCheckedChange={(checked) =>
              handleKnowledgeBaseUpdate(checked as boolean)
            }
            id="kb-checkbox"
          />
          <label htmlFor="kb-checkbox" className="text-lg font-semibold">Enable Knowledge Base</label>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={toggleFullScreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {state.isEnabled && (
        <div className="flex flex-col gap-4 relative">
          <Accordion type="single" collapsible className="w-full">
          {/* Upload Section */}
            <AccordionItem value="upload">
              <AccordionTrigger className="text-md font-semibold">Upload Files</AccordionTrigger>
              <AccordionContent>
            <div className="flex flex-col gap-4">
              {/* Single File Upload */}
              <div className="relative">
                {state.loadingStates.isUploadingFile && (
                  <LoadingOverlay message="Uploading file" />
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.txt"
                    className="hidden"
                    aria-label="Upload file"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Single File
                  </Button>
                </div>
              </div>

              {/* Folder/Multiple Files Upload */}
              <KBFolderUpload 
                agentName={agentName}
                userId={userId}
                onUploadComplete={() => {
                  onKnowledgeBaseUpdate?.();
                  loadEntries();
                }}
              />
            </div>
              </AccordionContent>
            </AccordionItem>

          {/* URL Input Section */}
            <AccordionItem value="web">
              <AccordionTrigger className="text-md font-semibold">Add Web Content</AccordionTrigger>
              <AccordionContent>
            <div className="relative">
              {state.loadingStates.isProcessingUrl && (
                <LoadingOverlay message="Processing URL" />
              )}
                  <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={state.crawlAllLinks}
                    onCheckedChange={(checked) =>
                      setState((prev) => ({
                        ...prev,
                        crawlAllLinks: checked as boolean,
                      }))
                    }
                        id="crawl-checkbox"
                  />
                  <label
                        htmlFor="crawl-checkbox"
                        className="text-sm text-muted-foreground"
                  >
                        Crawl all links on page
                  </label>
                </div>
                <form onSubmit={handleLinkAdd} className="flex gap-2">
                  <Input
                    name="url"
                    type="url"
                    placeholder="Enter URL to add"
                    aria-label="URL input"
                  />
                  <Button type="submit">
                    <Link className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </form>
              </div>
            </div>
              </AccordionContent>
            </AccordionItem>

            {/* Auto-Create Knowledge Base Section */}
            <AccordionItem value="auto-create">
              <AccordionTrigger className="text-md font-semibold">Auto-Create Knowledge Base</AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  {state.loadingStates.isAutoCreating && (
                    <LoadingOverlay message="Auto-creating knowledge base..." />
                  )}
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                      Automatically generate a knowledge base using AI research based on the agent&apos;s responsibilities.
                    </p>
                    <form onSubmit={handleAutoCreate} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label htmlFor="responsibilities" className="text-sm font-medium">
                          Agent Responsibilities (Optional)
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Enter responsibilities one per line, or leave blank to auto-generate based on agent role.
                        </p>
                        <Textarea
                          id="responsibilities"
                          name="responsibilities"
                          placeholder="Enter agent&apos;s responsibilities (optional, one per line)"
                          className="min-h-[100px]"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Auto-Create Knowledge Base
                      </Button>
                    </form>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Knowledge Base Content */}
          {state.entries.length > 0 ? (
          <Card className="p-4 bg-gradient-to-r from-black/90 to-indigo-600/70 rounded-sm border-t border-b border-indigo-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold">Knowledge Base Content</h3>
              <Button onClick={handleClear} variant="destructive" size="sm">
                Clear All
              </Button>
            </div>
            
            <div className="relative">
              {state.loadingStates.isFetchingEntries && (
                <LoadingOverlay message="Fetching entries" />
              )}
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                {/* Ungrouped Entries */}
                {getUniqueDocuments(
                  state.entries.filter((entry) => !entry.metadata.groupId)
                ).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Individual Files</h4>
                    {getUniqueDocuments(
                      state.entries.filter((entry) => !entry.metadata.groupId)
                    ).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-4 py-2 px-2 bg-black/30 border-b hover:bg-black/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {entry.metadata.type === "file" ? (
                            <File className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {getDisplayName(entry.metadata.source, false, entry.metadata)}
                            </span>
                            {entry.metadata.totalChunks && entry.metadata.totalChunks > 1 && (
                              <span className="text-xs text-muted-foreground">
                                {entry.metadata.totalChunks} chunks
                              </span>
                            )}
                          </div>
                          {entry.metadata.grade && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              entry.metadata.grade === 'A' ? 'bg-green-500' :
                              entry.metadata.grade === 'B' ? 'bg-blue-500' :
                              entry.metadata.grade === 'C' ? 'bg-yellow-500' :
                              entry.metadata.grade === 'D' ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}>
                              Grade: {entry.metadata.grade}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            handleDeleteEntry(
                              entry.id,
                              false,
                              undefined,
                              entry.metadata.documentId
                            )
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grouped Entries */}
                {Object.entries(
                  groupEntriesByGroupId(
                    state.entries.filter((entry) => entry.metadata.groupId)
                  )
                ).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Website Content</h4>
                    {Object.entries(
                      groupEntriesByGroupId(
                        state.entries.filter((entry) => entry.metadata.groupId)
                      )
                    ).map(([groupId, entries]) => (
                      <div key={groupId} className="mb-4 border rounded-md p-2 hover:bg-black/20 transition-colors">
                        <div className="w-full gap-4 flex items-center justify-between mb-2">
                          <button
                            onClick={() =>
                              setExpandedGroups((prev) => ({
                                ...prev,
                                [groupId]: !prev[groupId],
                              }))
                            }
                            className="flex items-center gap-2 text-sm font-medium"
                          >
                            <span className="transform transition-transform duration-200">
                              {expandedGroups[groupId] ? "▼" : "▶"}
                            </span>
                            <span>{entries[0].metadata.groupId}</span>
                            <span className="text-gray-400">
                              ({entries.length} pages)
                            </span>
                            {entries[0].metadata.grade && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                entries[0].metadata.grade === 'A' ? 'bg-green-500' :
                                entries[0].metadata.grade === 'B' ? 'bg-blue-500' :
                                entries[0].metadata.grade === 'C' ? 'bg-yellow-500' :
                                entries[0].metadata.grade === 'D' ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}>
                                Grade: {entries[0].metadata.grade}
                              </span>
                            )}
                          </button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteEntry(groupId, true, groupId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {expandedGroups[groupId] && (
                          <div className="pl-6 space-y-2">
                            {entries.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between py-2 hover:bg-black/20 transition-colors rounded px-2"
                              >
                                <div className="flex items-center gap-2">
                                  {entry.metadata.type === "file" ? (
                                    <File className="w-4 h-4" />
                                  ) : (
                                    <Globe className="w-4 h-4" />
                                  )}
                                  <span className="text-sm">
                                    {entry.metadata.type === "file"
                                      ? getDisplayName(entry.metadata.source, false, entry.metadata)
                                      : (() => {
                                          try {
                                            return new URL(entry.metadata.source)
                                              .pathname;
                                          } catch (e) {
                                            return entry.metadata.source;
                                          }
                                        })()}
                                  </span>
                                  {entry.metadata.grade && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      entry.metadata.grade === 'A' ? 'bg-green-500' :
                                      entry.metadata.grade === 'B' ? 'bg-blue-500' :
                                      entry.metadata.grade === 'C' ? 'bg-yellow-500' :
                                      entry.metadata.grade === 'D' ? 'bg-orange-500' :
                                      'bg-red-500'
                                    }`}>
                                      Grade: {entry.metadata.grade}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteEntry(entry.id, false)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </Card>
          ) : (
            <Card className="p-4 bg-gradient-to-r from-black/90 to-indigo-600/70 rounded-sm border-t border-b border-indigo-300">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No entries in knowledge base yet. Add content using the options above.
                </p>
              </div>
            </Card>
          )}

          {/* Global loading overlay for clearing knowledge base */}
          {state.loadingStates.isClearing && (
            <LoadingOverlay message="Clearing knowledge base" />
          )}
        </div>
      )}
    </div>
  );
}
