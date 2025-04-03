"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { AgentComponentProps, AISessionState } from "@/src/lib/types";
import { useAnalysisStore } from "@/src/lib/store/analysis-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Edit, Save, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export interface TeamConfigProps {
  onSave?: () => void;
  onReset?: () => void;
}

/**
 * TeamConfig - Component for managing team configuration settings
 * Now uses useAnalysisStore as the source of truth for the current team.
 */
export function TeamConfig({ onSave, onReset }: TeamConfigProps) {
  const { localState: sessionState, updateLocalState } = useAnalysisStore();
  const router = useRouter();
  
  const [teamName, setTeamName] = useState("");
  const [teamObjective, setTeamObjective] = useState("");
  
  useEffect(() => {
    if (sessionState?.currentAgents) {
      setTeamName(sessionState.currentAgents.name || "");
      setTeamObjective(sessionState.currentAgents.objectives || "");
    } else {
      setTeamName("Loading...");
      setTeamObjective("Loading...");
    }
  }, [sessionState?.currentAgents?.name, sessionState?.currentAgents?.objectives]);
  
  const handleSaveTeam = useCallback(() => {
    if (!sessionState?.currentAgents) {
      console.error("Cannot save team: sessionState or currentAgents is missing");
      toast({
        title: "Error Saving",
        description: "Cannot save team configuration at the moment.",
        variant: "destructive",
      });
      return;
    }
    
    const updatedAnalysisState: AISessionState = {
      ...sessionState,
      currentAgents: {
        ...sessionState.currentAgents,
        name: teamName,
        objectives: teamObjective,
      }
    };
    
    updateLocalState(updatedAnalysisState);
    
    if (onSave) {
      onSave();
    }
    
    toast({
      title: "Team Configuration Saved",
      description: `Team '${teamName}' updated.`,
    });
  }, [sessionState, teamName, teamObjective, updateLocalState, onSave, toast]);
  
  const handleResetTeam = useCallback(() => {
    if (sessionState?.currentAgents) {
      setTeamName(sessionState.currentAgents.name || "");
      setTeamObjective(sessionState.currentAgents.objectives || "");
    }
    
    if (onReset) {
      onReset();
    }
    
    toast({
      title: "Reset",
      description: "Changes discarded.",
    });
  }, [sessionState?.currentAgents, onReset, toast]);

  const teamAgents = sessionState?.currentAgents?.agents || [];

  if (!sessionState?.currentAgents) {
      return <div>Loading Team Configuration...</div>; 
  }

  return (
    <div className="p-4 bg-card rounded-lg shadow-sm space-y-4">
      <h2 className="text-xl font-semibold">Team Configuration</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="teamName" className="block text-sm font-medium mb-1">
            Team Name
          </label>
          <Input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </div>
        
        <div>
          <label htmlFor="teamObjective" className="block text-sm font-medium mb-1">
            Team Objective
          </label>
          <textarea
            id="teamObjective"
            value={teamObjective}
            onChange={(e) => setTeamObjective(e.target.value)}
            className="w-full p-2 border rounded-md h-24 bg-background text-foreground"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={handleResetTeam}>
          Reset
        </Button>
        <Button onClick={handleSaveTeam}>
          Save Team
        </Button>
      </div>
    </div>
  );
} 