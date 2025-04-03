import {
  AI_Agent_Tools,
  AI_Agent_ToolsDescription,
  AGENT_TOOLS_EMULATOR,
} from "@/src/lib/types";
import React, { useState } from "react";
import { cn, UTILS_getAgentToolsDescriptions } from "@/src/lib/utils";

import { Button } from "@/components/ui/button";
import { TabsContent, TabsTrigger, TabsList } from "@radix-ui/react-tabs";
import { Tabs } from "@/components/ui/tabs";
import HorizontalDivider from "@/components/global/horizontal-divider";
import MessageActionBar from "./message-action-bar";

const ToolContainer = ({
  //tool,
  emulator,
  sendTextToSet,
  output,
  setLocalOutput,
}: {
  //tool: CoreTool;
  emulator: AGENT_TOOLS_EMULATOR;
  sendTextToSet: (text: string) => void;
  output: (result: string | number | boolean) => void;
  setLocalOutput: (result: string | number | boolean) => void;
}) => {
  const [localParams, setLocalParams] = useState<Record<string, string>>({});
  return (
    <div className="text-sm flex flex-col items-center bg-slate-800/50 backdrop-blur-md justify-start border-l border-r h-72 w-full px-2 border-pink-500/50 py-4 overflow-y-auto gap-2">
      <div className="font-medium text-xl text-left">{emulator.name}</div>
      <div className="mx-auto text-right ">{emulator.description}</div>
      <HorizontalDivider />
      
      {emulator.parameters.length > 0 && <div className="flex flex-col gap-3 items-center justify-between p-2 bg-black/40">
        <div className="text-lg font-bold w-2/3 text-left">parameters</div>
        {emulator.parameters.map((p) => (
          <div
            key={p.name}
            className="text-sm flex flex-col w-full items-center justify-center gap-3 border-b border-black"
          >
            <div className="text-right w-full">{p.name}</div>
            <div className="text-xs opacity-75 w-full">{p.description}</div>
            {generateInputElement(
              p.type,
              p.name,
              localParams,
              setLocalParams
            )}
          </div>
        ))}
      </div>}

      <Button
        variant="default"
        className="w-1/2 bg-pink-500/20 backdrop-blur-lg my-4"
        onClick={async () => {
          // console.log("MANUAL_FUNCTION_CALL-EmulatorParams: ", emulator.parameters);
          // const params = Object.fromEntries(
          //   emulator.parameters.map((p) => [p.name, ""])
          // );
          console.log("MANUAL_FUNCTION_CALL-Params: ", localParams);
          const result = await emulator.execute(localParams);
          console.log("result", result);
          //setLocalParams({});
          output(result);
          setLocalOutput(result);
        }}
      >
        Execute
      </Button>
    </div>
  );
};

const generateInputElement = (
  type: string,
  name: string,
  localParams: Record<string, string>,
  setLocalParams: (params: Record<string, string>) => void
) => {
  if (type === "string") {
    return (
      <input
        className="bg-indigo-800 text-indigo-300 text-sm w-full"
        placeholder={name}
        type="text"
        value={localParams[name]}
        onChange={(e) =>
          setLocalParams({ ...localParams, [name]: e.target.value })
        }
      />
    );
  } else if (type === "number") {
    return (
      <input
        className="bg-indigo-800 text-indigo-300 text-sm w-full"
        placeholder={name}
        type="number"
        value={localParams[name]}
        onChange={(e) =>
          setLocalParams({ ...localParams, [name]: e.target.value })
        }
      />
    );
  } else if (type === "boolean") {
    return (
      <input
        className="bg-indigo-800 text-indigo-300 "
        placeholder={name}
        type="checkbox"
        checked={localParams[name] === "true"}
        onChange={(e) =>
          setLocalParams({
            ...localParams,
            [name]: e.target.checked ? "true" : "false",
          })
        }
      />
    );
  } else {
    return (
      <input
        className="bg-indigo-800 text-indigo-300 text-sm w-full"
        placeholder={name}
        type="text"
        value={localParams[name]}
        onChange={(e) =>
          setLocalParams({ ...localParams, [name]: e.target.value })
        }
      />
    );
  }
};


export default function ToolTester({
  toolName,
  emulators,
  output,
  sendTextToSet,
}: {
  toolName: string;
  emulators: AGENT_TOOLS_EMULATOR[];
  output: (result: string | number | boolean) => void;
  sendTextToSet: (text: string) => void;
}) {
  const [localOutput, setLocalOutput] = useState<string | number | boolean>(
    "..."
  );
  


  //console.log("MANUAL FUNCTION CALL", emulators);
  return emulators.length > 0 ? (
    <div className="flex flex-col gap-1? items-center justify-center w-full">
      <div className="text-lg font-bold italic text-left w-full bg-pink-600/40 p-1 ">{toolName}</div>
      <Tabs
        defaultValue={emulators[0].name}
        className="w-full md:w-3/4? flex flex-col items-center justify-center"
        //className="w-full p-6 flex items-center justify-center gap-2 my-6 bg-gradient-to-r from-white/0 via-pink-500/40 to-white/0 backdrop-blur-md rounded-2xl"
      >
        <TabsList className="flex flex-wrap bg-pink-500/50 justify-center gap-2 p-2 m-4">
          {emulators.map((emulator) => (
            <TabsTrigger
              className={cn(
                "p-1 border-black rounded-lg text-sm font-light",
                "data-[state=active]:bg-pink-500/50 data-[state=active]:text-white",
                "data-[state=inactive]:bg-black/30 data-[state=inactive]:text-pink-400"
              )}
              key={emulator.name}
              value={emulator.name}
            >
              {emulator.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {emulators.map((emulator) => (
          <TabsContent
            className={cn("w-full")}
            key={emulator.name}
            value={emulator.name}
          >
            <ToolContainer emulator={emulator} sendTextToSet={sendTextToSet} output={output} setLocalOutput={setLocalOutput} />
          </TabsContent>
        ))}
      </Tabs>
      {localOutput !== "..." && (
        <div className="text-sm flex flex-col items-center bg-slate-950/50 backdrop-blur-md justify-start border-l border-t border-r h-72 w-full md:w-3/4? border-pink-500/50 py-4? overflow-y-auto gap-1">
          <div className="font-medium text-md text-left w-full bg-pink-600/40 p-1 ">Output</div>
          {/* <HorizontalDivider /> */}
          <MessageActionBar
            m={{ content: localOutput as string, role: "assistant" }}
            messages={[]}
            setMessages={() => {}}
            agentIndex={0}
            userId={"manual-function-call"}
            promptTextToSet={(text:string) => {sendTextToSet(text)}}
          />
          <div className="mx-auto text-center font-extralight tracking-widest text-slate-500 whitespace-pre-wrap ">{localOutput}</div>
        </div>
      )}
    </div>
  ) : (
    <div>No tools found</div>
  );
}
