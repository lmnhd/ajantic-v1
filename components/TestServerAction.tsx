"use client";

import { useState } from "react";
import { testSimpleServerAction } from "@/src/lib/test-server-action";
import { Button } from "@/components/ui/button";
import { autoRedirectOrchestrator3 } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat/auto-agent-next";
import { ModelProviderEnum } from "@/src/lib/types";
import { ORCHESTRATION_autoModeRedirect, TEST_ORCHESTRATION_autoModelRedirect } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat/auto-redirect";

export default function TestServerAction() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("!!!_Executing testSimpleServerAction...!!!", "Test message " + new Date().toISOString());

      const response = await testSimpleServerAction("Test message " + new Date().toISOString());
      setResult(JSON.stringify(response, null, 2));
      console.log("!!!_testSimpleServerAction result...!!!", JSON.stringify(response, null, 2));

      console.log("!!!_Executing ORCHESTRATION_autoModeRedirect...!!!", "Test message " + new Date().toISOString());

       const response2 = await ORCHESTRATION_autoModeRedirect({
       agentOrder: 'auto',
      
       currentAgent: {
        type: "agent",
        name: "Agent 1",
        roleDescription: "Agent 1 role description",
        title: "Agent 1 title",
        modelArgs: {
          provider: ModelProviderEnum.OPENAI,
          modelName: "gpt-4o-mini",
          temperature: 0.5
        }
       },
       initialMessage: "Test message " + new Date().toISOString(),
       chatMode: 'agent-orchestrator',
       allAgents: [],
       currentCycleStep: 0,
       currentRound: 0,
       currentStepResponseType: 'final-thought',
       isFinalRoundAndStep: false,
       numAgents: 0,
       numRounds: 0,
       teamObjective: ""
      });

      console.log("Checking reslut context for change...", response2.newContext)

      const response3 = await TEST_ORCHESTRATION_autoModelRedirect()

      console.log("!!!TEST_ORCHESTRATION_autoModelRedirect result...!!!", JSON.stringify(response3, null, 2));

    } catch (err) {
      console.error("Server action test failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-md max-w-xl mx-auto my-4">
      <h2 className="text-xl font-bold mb-4">Server Action Test</h2>
      <p className="mb-4">Testing if server actions are working properly with the encryption key.</p>
      
      <Button 
        onClick={handleTest}
        disabled={loading}
        className="mb-4"
      >
        {loading ? "Testing..." : "Test Server Action"}
      </Button>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded mb-4">
          <p className="text-red-800 font-medium">Error:</p>
          <pre className="whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}
      
      {result && (
        <div className="p-3 bg-green-100 border border-green-300 rounded">
          <p className="text-green-800 font-medium">Success:</p>
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
} 