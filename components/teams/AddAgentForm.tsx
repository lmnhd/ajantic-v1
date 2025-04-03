"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamStore } from "@/src/lib/store/team-store";
// import { createEmptyAgent } from "@/src/lib/teams/lib/team-utils";
import { AgentComponentProps, AgentTypeEnum, ModelProviderEnum } from "@/src/lib/types";
import { toast } from "../ui/use-toast";


export function createEmptyAgent(teamId?: string): AgentComponentProps {
  return {
    name: "New Agent",
    title: "Untitled Role",
    roleDescription: "",
    type: AgentTypeEnum.AGENT,
    systemPrompt: "",
    tools: [],
    modelArgs: {
      modelName: "gpt-4o",
      temperature: 0.7,
      provider: ModelProviderEnum.OPENAI,
    },
  };
}


export function AddAgentForm({ onClose }: { onClose?: () => void }) {
  const { localState, addAgent } = useTeamStore();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [modelName, setModelName] = useState("gpt-4o");
  const [temperature, setTemperature] = useState("0.7");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !roleDescription.trim()) {
      toast({
        title: "Error",
        description: "Please provide a name and role description",
        variant: "destructive",
      });
      return;
    }
    
    const newAgent = createEmptyAgent(localState?.id);
    newAgent.name = name.trim();
    newAgent.title = title.trim();
    newAgent.roleDescription = roleDescription.trim();
    newAgent.type = AgentTypeEnum.AGENT;
    newAgent.modelArgs = {
      modelName,
      temperature: parseFloat(temperature),
      provider: ModelProviderEnum.OPENAI,
    };
    
    addAgent(newAgent);
    toast({
      title: "Success",
      description: `Added ${name} to the team`,
    });
    
    // Reset form
    setName("");
    setTitle("");
    setRoleDescription("");
    setModelName("gpt-4o");
    setTemperature("0.7");
    
    if (onClose) {
      onClose();
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add New Agent</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              placeholder="e.g., Research Assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Title/Position</Label>
            <Input
              id="title"
              placeholder="e.g., Lead Researcher"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role Description</Label>
            <Textarea
              id="role"
              placeholder="Describe what this agent does in the team..."
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              rows={3}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select 
                value={modelName} 
                onValueChange={setModelName}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Select 
                value={temperature} 
                onValueChange={setTemperature}
              >
                <SelectTrigger id="temperature">
                  <SelectValue placeholder="Select temperature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.0">0.0 - Deterministic</SelectItem>
                  <SelectItem value="0.3">0.3 - Conservative</SelectItem>
                  <SelectItem value="0.5">0.5 - Balanced</SelectItem>
                  <SelectItem value="0.7">0.7 - Creative</SelectItem>
                  <SelectItem value="1.0">1.0 - Very Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-end space-x-2">
          {onClose && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
          )}
          <Button type="submit">Add Agent</Button>
        </CardFooter>
      </form>
    </Card>
  );
} 