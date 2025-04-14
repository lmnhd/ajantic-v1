import { Button } from "@/components/ui/button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentComponentProps, OrchestrationType } from "@/src/lib/types";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";
import { mapOrchestrationTypes } from "@/src/lib/orchestration/adapter";
import { DragHandleDots2Icon } from "@radix-ui/react-icons";
import { cn } from "@/src/lib/utils";
import { BotIcon } from "lucide-react";

interface OrchestrationControlsProps {
  orchestrationMode: OrchestrationType;
  setOrchestrationMode: (mode: OrchestrationType) => void;
  agentOrder: "sequential" | "seq-reverse" | "random";
  setAgentOrder: (order: "sequential" | "seq-reverse" | "random") => void;
  rounds: number;
  setRounds: (rounds: number) => void;
  maxRounds: number;
  setMaxRounds: (maxRounds: number) => void;
  customAgentSet: string[];
  setOrRemoveCustomAgent: (agent: string) => void;
  reOrderCustomAgent: (changeAgent: string, toTheIndexOfAgent: string) => void;
  allAgents: AgentComponentProps[];
  agentActive: boolean;
}

/**
 * Component for controlling orchestration settings
 */
export function OrchestrationControls({
  orchestrationMode,
  setOrchestrationMode,
  agentOrder,
  setAgentOrder,
  rounds,
  setRounds,
  maxRounds,
  setMaxRounds,
  customAgentSet,
  setOrRemoveCustomAgent,
  reOrderCustomAgent,
  allAgents,
  agentActive
}: OrchestrationControlsProps) {
  
  // Get equivalent new type for display purposes
  const orchestrationType2 = mapOrchestrationTypes(orchestrationMode, agentOrder);
  
  // Cycle through modes
  const handleCycleMode = () => {
    const modes: OrchestrationType[] = [
      "agent-orchestrator", 
      "wf-sequential-1", 
      "wf-sequential-2", 
      "wf-sequential-3"
    ];
    const currentIndex = modes.indexOf(orchestrationMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setOrchestrationMode(modes[nextIndex]);
  };

  if (agentActive) {
    return null; // Don't show controls when agents are active
  }
  
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 text-xs border-b border-gray-700">
      {/* Mode selector with improved display */}
      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="xs" onClick={handleCycleMode}>
                {getOrchestrationTypeLabel(orchestrationType2)}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{getOrchestrationTypeDescription(orchestrationType2)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {/* Only show order selector for sequential workflows */}
      {orchestrationMode === "wf-sequential-1" && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={() => 
                  setAgentOrder(agentOrder === 'sequential' ? 'seq-reverse' : 
                              agentOrder === 'seq-reverse' ? 'random' : 'sequential')
                }
              >
                {agentOrder === 'sequential' ? 'Forward' : 
                agentOrder === 'seq-reverse' ? 'Reverse' : 'Random'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Agent processing order</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Show rounds for all workflow types except direct agent */}
      {orchestrationMode !== "agent-orchestrator" && (
        <div className="flex items-center gap-1 rounded bg-gray-700/50 px-1">
          <Button 
            variant="ghost" 
            size="xs" 
            className="p-0 h-4 w-4" 
            onClick={() => setRounds(Math.max(0, rounds - 1))}
          >-</Button>
          <span className="w-3 text-center">{rounds === 0 ? "∞" : rounds}</span>
          <Button 
            variant="ghost" 
            size="xs" 
            className="p-0 h-4 w-4" 
            onClick={() => setRounds(rounds + 1)}
          >+</Button>
        </div>
      )}
      
      {/* Show max rounds for infinite rounds */}
      {orchestrationMode !== "agent-orchestrator" && rounds === 0 && (
        <div className="flex items-center gap-1 rounded bg-gray-700/50 px-1">
          <span className="text-gray-400 mr-1">Max:</span>
          <Button 
            variant="ghost" 
            size="xs" 
            className="p-0 h-4 w-4" 
            onClick={() => setMaxRounds(Math.max(1, maxRounds - 1))}
          >-</Button>
          <span className="w-4 text-center">{maxRounds}</span>
          <Button 
            variant="ghost" 
            size="xs" 
            className="p-0 h-4 w-4" 
            onClick={() => setMaxRounds(maxRounds + 1)}
          >+</Button>
        </div>
      )}
      
      {/* Agent selector popover */}
      {orchestrationMode !== "agent-orchestrator" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs" className="text-gray-400 hover:text-gray-300">
              <BotIcon className="w-3 h-3 mr-1" />
              {customAgentSet.length === 0 ? "All" : customAgentSet.length}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 bg-gray-800 border-gray-700 p-2">
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              <p className="text-xs text-gray-400 mb-1">Select agents for orchestration:</p>
              {(() => {
                // Agents selected and ordered by customAgentSet
                const selectedAgents = customAgentSet
                  .map(name => allAgents.find(agent => agent.name === name && !agent.disabled && agent.type !== "manager"))
                  .filter(agent => agent !== undefined) as AgentComponentProps[];

                // Agents available but not selected
                const unselectedAgents = allAgents.filter(
                  agent => !agent.disabled && agent.type !== "manager" && !customAgentSet.includes(agent.name)
                );

                // Combine the lists: selected first, then unselected
                const orderedAgents = [...selectedAgents, ...unselectedAgents];

                return orderedAgents.map((agent) => {
                  const isSelected = customAgentSet.includes(agent.name);
                  return (
                    <div
                      key={agent.name}
                      draggable={isSelected}
                      className={cn(
                        "flex items-center gap-2 p-1 rounded cursor-pointer text-xs",
                        "hover:bg-gray-700/50 transition-colors",
                        isSelected ? "text-green-400 cursor-move" : "text-gray-300",
                      )}
                      onClick={() => setOrRemoveCustomAgent(agent.name)}
                      onDragStart={(e) => { 
                        if (isSelected) { 
                          e.dataTransfer.setData("agent", agent.name); 
                          e.currentTarget.classList.add('opacity-50'); 
                        } else { 
                          e.preventDefault(); 
                        }
                      }}
                      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
                      onDragOver={(e) => { 
                        if (isSelected) { 
                          e.preventDefault(); 
                          e.currentTarget.classList.add('bg-gray-700/30'); 
                        }
                      }}
                      onDragLeave={(e) => e.currentTarget.classList.remove('bg-gray-700/30')}
                      onDrop={(e) => {
                        if (!isSelected) return;
                        e.preventDefault();
                        e.currentTarget.classList.remove('bg-gray-700/30');
                        const draggedAgent = e.dataTransfer.getData("agent");
                        if (draggedAgent && draggedAgent !== agent.name) {
                          reOrderCustomAgent(draggedAgent, agent.name);
                        }
                      }}
                    >
                      {isSelected && <DragHandleDots2Icon className="w-3 h-3 flex-shrink-0" />}
                      {!isSelected && <div className="w-3 h-3 flex-shrink-0"></div>}
                      <span className="flex-grow truncate">{agent.name}</span>
                      <Checkbox checked={isSelected} className="w-3 h-3 flex-shrink-0" />
                    </div>
                  );
                });
              })()}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/**
 * Get a user-friendly label for the orchestration type
 */
function getOrchestrationTypeLabel(type: OrchestrationType2): string {
  switch(type) {
    case OrchestrationType2.DIRECT_AGENT_INTERACTION:
      return "Direct Agent";
    case OrchestrationType2.SEQUENTIAL_WORKFLOW:
      return "Sequential Flow";
    case OrchestrationType2.REVERSE_WORKFLOW:
      return "Reverse Flow";
    case OrchestrationType2.RANDOM_WORKFLOW:
      return "Random Flow";
    case OrchestrationType2.LLM_ROUTED_WORKFLOW:
      return "LLM Routed";
    case OrchestrationType2.MANAGER_DIRECTED_WORKFLOW:
      return "Manager Directed";
    default:
      return "Unknown";
  }
}

/**
 * Get a description for the orchestration type
 */
function getOrchestrationTypeDescription(type: OrchestrationType2): string {
  switch(type) {
    case OrchestrationType2.DIRECT_AGENT_INTERACTION:
      return "Direct interaction with a single agent. Best for simple tasks or questions.";
    case OrchestrationType2.SEQUENTIAL_WORKFLOW:
      return "Agents take turns in forward order. Good for step-by-step processes.";
    case OrchestrationType2.REVERSE_WORKFLOW:
      return "Agents take turns in reverse order. Useful when specialists should review first.";
    case OrchestrationType2.RANDOM_WORKFLOW:
      return "Agents take turns in random order. Good for creative brainstorming.";
    case OrchestrationType2.LLM_ROUTED_WORKFLOW:
      return "An LLM analyzes each message and decides which agent should respond next.";
    case OrchestrationType2.MANAGER_DIRECTED_WORKFLOW:
      return "A Manager agent explicitly directs tasks to specific agents based on their expertise.";
    default:
      return "Select an orchestration mode";
  }
} 