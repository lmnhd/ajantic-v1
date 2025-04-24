// Team Component - Manages automated agent team creation and workflow processes
import {
  AISessionState,
  ContextContainerProps,
  ContextSet,
  OrchestrationType,
  Team,
} from "@/src/lib/types";
import { useAnalysisStore } from "@/src/lib/store/analysis-store";
import { AutoGenTeam, AutoGenWorkflowProps } from "@/src/lib/autogen/autogen";
import { useEffect, useState } from "react";
import AutoGenWorkflowComponent from "./auto_gen_wf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextIcon, Save, FolderOpen } from "lucide-react";
import { testObj2, testObj3 } from "@/src/lib/teams/lib/test-xml";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_getGeneralPurposeDataSingle,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server-actions";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";
import { GeneralPurpose } from "@prisma/client";
import { SERVER_getGeneralPurposeDataSingleById } from "@/src/lib/server";
import { useUser } from "@clerk/nextjs";

const saveWorkflowToDatabase = async (
  name: string,
  workflowData: AutoGenTeam,
  userId: string
) => {
  try {
    console.log("Saving workflow:", name, workflowData);
    const dbName = DYNAMIC_NAMES.namespace_generic(userId, "AUTOGEN_WORKFLOWS");
    await SERVER_storeGeneralPurposeData(
      JSON.stringify(workflowData),
      name,
      "",
      "",
      dbName,
      true
    );
    return { id: Date.now().toString(), name, data: workflowData };
  } catch (error) {
    console.error("Error saving workflow:", error);
    throw error;
  }
};

const fetchSavedWorkflows = async (userId: string) => {
  try {
    const dbName = DYNAMIC_NAMES.namespace_generic(userId, "AUTOGEN_WORKFLOWS");
    const data: GeneralPurpose[] = await SERVER_getGeneralPurposeDataMany(
      dbName
    );
    return data.map((item) => ({ id: item.id, name: item.meta1 }));
  } catch (error) {
    console.error("Error fetching workflows:", error);
    throw error;
  }
};

const fetchWorkflowById = async (id: string) => {
  try {
    const data: GeneralPurpose = (await SERVER_getGeneralPurposeDataSingleById(
      Number(id)
    )) as GeneralPurpose;
    return JSON.parse(data.content);
  } catch (error) {
    console.error("Error fetching workflow by id:", error);
    throw error;
  }
};

  // Default process description for testing email automation
  export const defaultProcess = `
AI-Automated ClickBank Affiliate Marketing Workflow:

Product Research Agent:

Sub-task: Explore ClickBank Marketplace to identify potential products.

Sub-task: Gather product details (description, commission, initial/future earnings).

Sub-task: Apply filters to narrow down options (e.g., new offers, gravity score).

Keyword Analysis Agent:

Sub-task: Feed candidate product names into a keyword tool.

Sub-task: Analyze search volume and competition for related keywords.

Sub-task: Filter keywords and identify a profitable selection.

Content Creation Agent:

Sub-task: Use AI to generate various forms of content:

Image/Info Graphic: Generate Pinterest pins using AI.

Social Media: Create short videos to increase engagement with potential affiliate traffic

Blog Posts

Freebies: Make a guide. Download checklist

Sub-task: Ensure the article content is written to trigger certain SEO keywords.

Landing Page Agent:

Sub-task: Select a high-gravity landing page with proven lead potential.

Sub-task: Edit the page, by adding engaging text.

Sub-task: Embed the link so affiliate cash can be deposited.

Content Distribution Agent:

Sub-task: Post content to social media and website.

Sub-task: Monitor news sites with Google Alerts/RSS Feed for topical hooks.

Sub-task: Use a "secret RSS Feed" based on trends to drive content engagement.

Tracking and Optimization Agent:

Sub-task: Track traffic volume from social media engagements.

Sub-task: Monitor conversion rates from landing page to sales.

Sub-task: Record and report the results of the marketing campaign.

<br>
**Key Considerations:**


Deliberate Work: Each step should contribute directly to the overall goal of earning money.

Short, Easy AI Content: Create bite-sized content snippets optimized for social sharing.

Sideways Content: Relate content to the core product indirectly to attract a wider audience.

Constant Testing: Analyze data and continuously adjust keywords, content, and distribution strategies for optimal performance.
`;

   export const defaultProcessSimple = `Simple workflow to test the system. Design a simple automated process that searches for a specific product on a website and then emails the user with the results. Keep the steps under 5 and create only 1 new agent with no knowledgebase.`;

export default function AutogenComponent({
  automationProcess,
  setAutomationProcess,
  teamName,
  setTeamName,
  teamObjective,
  setTeamObjective,
  workflowModifications,
  setWorkflowModifications,
  modificationText,
  setModificationText,
  autoGenWorkflow,
  setAutoGenWorkflow,
  modificationStore,
  setModificationStore,
  workflowModified,
  setWorkflowModified,
  saveDialogOpen,
  setSaveDialogOpen,
  savedWorkflows,
  setSavedWorkflows,
  workflowName,
  setWorkflowName,
}: {
  automationProcess: string;
  setAutomationProcess: (process: string) => void;
  teamName: string;
  setTeamName: (name: string) => void;
  teamObjective: string;
  setTeamObjective: (objective: string) => void;
  workflowModifications: string[];
  setWorkflowModifications: (modifications: string[]) => void;
  modificationText: string;
  setModificationText: (text: string) => void;
  autoGenWorkflow: AutoGenTeam | null;
  setAutoGenWorkflow: (workflow: AutoGenTeam | null) => void;
  modificationStore: { modifications: string[] }[];
  setModificationStore: (store: { modifications: string[] }[]) => void;
  workflowModified: boolean;
  setWorkflowModified: (modified: boolean) => void;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (open: boolean) => void;
  savedWorkflows: { id: number; name: string }[];
  setSavedWorkflows: (workflows: { id: number; name: string }[]) => void;
  workflowName: string;
  setWorkflowName: (name: string) => void;
}) {
  const { user } = useUser();


  // Access the analysis store for team management functions and agent data
  const { handleTeamAutoGen, localState } = useAnalysisStore();
  const { currentAgents: team } = localState;

  const setTeam = (props: AutoGenWorkflowProps) => {
    console.log("Setting Generated team");
    console.log("!!!_props!!!", props);
    const _contextSets: ContextSet = {
      teamName: props.resultTeam?.name ?? "",
      sets:
        props.resultContext?.map((ctx) => ({
          ...ctx,
          lines: Array.isArray(ctx.lines) ? ctx.lines : [],
          formSchema:
            ctx.formSchema === null || typeof ctx.formSchema === "string"
              ? undefined
              : ctx.formSchema,
        })) ?? [],
    };
    const _newTeam: Team = {
      name: props.resultTeam?.name ?? "",
      objectives: props.resultTeam?.objectives ?? "",
      agents: [
        ...(props.resultTeam?.agents ?? []),
        ...(props.readyMadeAgents.filter(
          (agent) => !props.resultTeam?.agents?.some(a => a.name === agent.name)
        ) ?? []),
      ],
    };
    console.log("!!!_newTeam!!!", _newTeam);
    console.log("!!!_props.readyMadeAgents!!!", props.readyMadeAgents);
    console.log("!!!_props.resultTeam?.agents!!!", props.resultTeam?.agents);
    const _newState = {

      ...localState,
      currentAgents: _newTeam,
      contextSet: _contextSets,
    } as AISessionState;

    console.log("!!!_newState!!!", _newState);
    const _outline: AutoGenTeam = JSON.parse(
      props.outlineObjectString ?? "{}"
    ) as AutoGenTeam;
    
    // Map orchestration type to expected string format
    const mapOrchestrationToAgentOrder = (orchType: string): "sequential" | "seq-reverse" | "random" => {
      if (orchType.includes("SEQUENTIAL")) return "sequential";
      if (orchType.includes("REVERSE")) return "seq-reverse";
      if (orchType.includes("RANDOM")) return "random";
      return "sequential"; // Default fallback
    };
    
    useAnalysisStore.setState({
      agentOrder: mapOrchestrationToAgentOrder(_outline.orchestrationType?.toString() || ""),
      customAgentSet: _outline.agentSequence,
      localState: _newState,
    });
  };

  /**
   * Initiates the AutoGen workflow process
   * Validates input and sends workflow configuration to the backend
   */
  const startAutoGen = async (outlineApproved: boolean = false) => {
    // Validate required inputs before proceeding
    if (automationProcess === "") {
      alert("Please enter a process to automate");
      return;
    }

    // Construct the workflow properties object
    const props: AutoGenWorkflowProps = {
      processToAutomate: automationProcess,
      readyMadeAgents: team.agents,
      outlineObjectString: autoGenWorkflow
        ? JSON.stringify(autoGenWorkflow)
        : undefined,
      modifications: workflowModifications,
      modificationStore: modificationStore,
      outlineApproved: outlineApproved,
    };

    // Submit the workflow to the analysis store for processing
    const result = await handleTeamAutoGen(props);
    console.log(result);

    if (result.error) {
      alert(result.error.message);
    } else {
      const outlineObject = JSON.parse(
        result.outlineObjectString ?? "{}"
      ) as AutoGenTeam;
      setAutoGenWorkflow(outlineObject);
      setWorkflowModifications([]);
      setModificationStore(result.modificationStore ?? []);
      setWorkflowModified(true); // Mark workflow as modified after generation
      
      alert("Team auto-generation successful");
    }
  };

  /**
   * Resets the AutoGen workflow process
   * Clears the current workflow and all modifications
   */
  const resetAutoGen = () => {
    // Show confirmation dialog before resetting
    const isConfirmed = window.confirm(
      "Are you sure you want to reset the workflow? This will clear all your current work and cannot be undone."
    );

    // Only proceed if user confirms
    if (isConfirmed) {
      setAutoGenWorkflow(null);
      setWorkflowModifications([]);
      setModificationText("");
      setWorkflowModified(false); // Reset modification state
    }
  };

  /**
   * Opens the save workflow dialog
   */
  const openSaveDialog = () => {
    if (!autoGenWorkflow) return;
    setWorkflowName(autoGenWorkflow.team_name || "");
    setSaveDialogOpen(true);
  };

  /**
   * Saves the current workflow to the database
   */
  const saveWorkflow = async (userId: string) => {
    if (!autoGenWorkflow || !workflowName.trim()) return;

    try {
      const result = await saveWorkflowToDatabase(
        workflowName,
        autoGenWorkflow,
        userId
      );
      setSaveDialogOpen(false);
      setWorkflowModified(false); // Reset modification state after save
      alert(`Workflow "${workflowName}" saved successfully!`);

      // Refresh the list of saved workflows
      loadSavedWorkflows(userId);
    } catch (error) {
      console.error("Error saving workflow:", error);
      alert("Failed to save workflow. Please try again.");
    }
  };

  /**
   * Loads a saved workflow from the database
   */
  const loadWorkflow = async (id: string) => {
    try {
      const workflow = await fetchWorkflowById(id);
      if (workflow) {
        setAutoGenWorkflow(workflow as AutoGenTeam);
        setWorkflowModifications([]);
        setTeamName(workflow.team_name || "");
        setTeamObjective(workflow.team_objective || "");
        setWorkflowModified(false); // Reset modification state after loading
      }
    } catch (error) {
      console.error("Error loading workflow:", error);
      alert("Failed to load workflow. Please try again.");
    }
  };

  /**
   * Loads the list of saved workflows from the database
   */
  const loadSavedWorkflows = async (userId: string) => {
    try {
      const workflows = await fetchSavedWorkflows(userId);
      setSavedWorkflows(workflows);
    } catch (error) {
      console.error("Error fetching saved workflows:", error);
    }
  };

  useEffect(() => {
    console.log("!!!_autoGenWorkflow!!!", autoGenWorkflow);
    const outlineObject = JSON.parse(
      testObj3.outlineObjectString
    ) as AutoGenTeam;
    setAutoGenWorkflow(outlineObject);
    setTeamName(outlineObject.team_name);
    setTeamObjective(outlineObject.team_objective);

    // Load saved workflows on component mount
    loadSavedWorkflows(user?.id ?? "");
  }, []);

  // Handle workflow modifications
  const handleWorkflowChange = (updatedWorkflow: AutoGenTeam) => {
    setAutoGenWorkflow(updatedWorkflow);
    setWorkflowModified(true); // Mark as modified when workflow is updated
  };

  return (
    <div className="flex flex-col gap-2 ">
      {/* Saved workflows dropdown - Always visible */}
      {savedWorkflows.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-5 w-5 text-gray-400" />
          <Select onValueChange={(value) => loadWorkflow(value)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Load saved workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Saved Workflows</SelectLabel>
                {savedWorkflows.map((workflow) => (
                  <SelectItem
                    key={workflow.id.toString()}
                    value={workflow.id.toString()}
                  >
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Workflow modifications section - Shows when modifications exist */}
      {/* Input field for new modifications */}
      {autoGenWorkflow && (
        <div className="flex flex-row items-center gap-2">
          <Input
            type="text"
            placeholder="Enter a modification"
            value={modificationText}
            onChange={(e) => setModificationText(e.target.value)}
          />

          {/* Button to add a new modification to the list */}
          <Button
            variant="outline"
            onClick={() => {
              if (modificationText.trim()) {
                setWorkflowModifications([
                  ...workflowModifications,
                  modificationText,
                ]);
                setModificationText("");
                setWorkflowModified(true); // Mark as modified when adding modifications
              }
            }}
          >
            Add Modification
          </Button>
        </div>
      )}
      {workflowModifications.length > 0 && (
        <div className="flex flex-col gap-2 m-4 bg-slate-800/70 p-4 rounded-md">
          <h2 className="text-sm text-gray-400 font-extralight">
            Workflow Modifications
          </h2>
          {/* Display all existing modifications */}
          {workflowModifications.map((modification, index) => (
            <div
              key={index}
              className="flex justify-between items-center group"
            >
              <p>
                {index + 1}. {modification}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-transparent"
                onClick={() => {
                  const newModifications = [...workflowModifications];
                  newModifications.splice(index, 1);
                  setWorkflowModifications(newModifications);
                }}
              >
                ✕
              </Button>
            </div>
          ))}

          {/* Modification controls - Only show when workflow is defined */}
          {autoGenWorkflow && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              {/* Button to clear all modifications */}
              <Button
                variant="outline"
                onClick={() => setWorkflowModifications([])}
              >
                Clear Modifications
              </Button>
            </div>
          )}
        </div>
      )}
      {/* Auto-generation action button - Only shows when process description is substantial */}
      {((automationProcess !== "" &&
        automationProcess.length > 30 &&
        !autoGenWorkflow) ||
        (autoGenWorkflow && workflowModifications.length > 0)) && (
        <Button
          className="w-fit mx-auto bg-blue-500 text-white"
          variant="outline"
          onClick={() => startAutoGen(false)}
        >
          {autoGenWorkflow && workflowModifications.length > 0
            ? "Update Workflow"
            : "Start Auto Gen"}
        </Button>
      )}

      {/* Team metadata input section - Only shows when workflow is defined */}
      {false && (
        <div className="flex flex-col gap-2 p-1">
          {/* Team name input field */}
          <div className="flex flex-row items-center gap-2">
            <h1 className="text-sm ">Team Name</h1>
            <Input
              type="text"
              placeholder="Enter a team name"
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>

          {/* Team objective input field */}
          <div className="flex flex-row items-center gap-2">
            <h1 className="text-sm ">Team Objective</h1>
            <Input
              type="text"
              placeholder="Enter a team objective"
              onChange={(e) => setTeamObjective(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Process description textarea - Only shows when no workflow is defined yet */}
      <div className="flex flex-row items-center gap-2 w-full">
        {!autoGenWorkflow && (
          <div className="flex flex-col gap-2 w-full">
            <h1 className="text-sm ">Process to Automate</h1>
            <textarea
              rows={10}
              className="w-full text-black bg-white h-full p-2 border border-gray-300 rounded"
              placeholder="Describe a process to automate"
              value={automationProcess}
              onChange={(e) => setAutomationProcess(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Workflow component - Only shows when a workflow is defined */}
      {autoGenWorkflow && (
        <div className="flex flex-col items-center h-[calc(100vh-10rem)] overflow-y-auto">
          <AutoGenWorkflowComponent
            autoGenWorkflow={autoGenWorkflow}
            setAutoGenWorkflow={handleWorkflowChange}
          />

          {/* Button container for action buttons */}
          <div className="flex flex-row justify-center gap-4 w-full mt-6 p-4 border-t border-gray-700">
            {/* Reset button */}
            <Button
              className="px-6 bg-red-600 hover:bg-red-700 text-white"
              variant="default"
              onClick={resetAutoGen}
            >
              Reset Workflow
            </Button>

            {/* Update button - Only shows when modifications exist */}
            {workflowModifications.length > 0 && (
              <Button
                className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
                variant="default"
                onClick={() => startAutoGen(false)}
              >
                Update Workflow
              </Button>
            )}

            {/* Save button - Disabled when no modifications exist */}
            <Button
              className="px-6 bg-yellow-600 hover:bg-yellow-700 text-white"
              variant="default"
              onClick={openSaveDialog}
            >
              <Save className="h-4 w-4 mr-2" /> Save Workflow
            </Button>

            {/* Build button */}
            <Button
              className="px-6 bg-green-600 hover:bg-green-700 text-white"
              variant="default"
              onClick={() => startAutoGen(true)}
            >
              Build Team
            </Button>
          </div>
        </div>
      )}

      {/* Save Workflow Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Workflow</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="workflow-name"
              className="block text-sm font-medium mb-2"
            >
              Workflow Name
            </label>
            <Input
              id="workflow-name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Enter a name for this workflow"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveWorkflow(user?.id ?? "")}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
