import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PopoverContent } from "@/components/ui/popover";
import {
  BoxIcon,
  CogIcon,
  Mic2,
  ArrowUpRightFromSquareIcon,
  PiIcon,
  ZapIcon,
  DeleteIcon,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import FunctionButton from "./funcbtn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { rulesArray } from "../rules";
import { useActions } from "ai/rsc";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { __updateAIState } from "@/src/lib/lyric-helpers";
import { deleteCustomFunction } from "@/src/lib/server-actions";

export type FuncProps = {
  name: string;
  displayName: string;
  description: string;

  icon: React.ReactNode;
  color: string;
};
export type RuleProps = {
  name: string;
  displayName: string;
  selected: boolean;
  value: string;
  icon?: React.ReactNode;
  count?: number;
};
export default function FunctionPanel({
  lineContent,
  //customFunctions,
  handleFunctionSelected,
}: {
  lineContent: string;
  //customFunctions: { name: string; value: string }[];
  handleFunctionSelected: any;
}) {
  const { appState, globalMessages, setAppState, setGlobalMessages } =
    useGlobalStore();

  const [customFunctionsOnly, setCustomFunctionsOnly] = React.useState(false);

  const handleRulesSelected = (rule: RuleProps) => {
    rule.selected = !rule.selected;
    console.log("handleRulesSelected: ", rule);
    const onlyOneArray = [
      "CLAMP_keepSameLength",
      "CLAMP_restrictSyllableCount",
      "CLAMP_restrictWordCount",
    ];
    const newRules = globalMessages.currentState.rules.map((r) => {
      if (onlyOneArray.includes(r.name) && r.name !== rule.name) {
        r.selected = false;
      }

      if (r.name === rule.name) {
        r.selected = rule.selected;

        console.log("RULE: ", r);
      }
      return r;
    });
    setGlobalMessages({
      ...globalMessages,
      currentState: { ...globalMessages.currentState, rules: newRules },
    });
  };
  //useEffect(() => {console.log("Function Panel: ",appState)},[])

  const handleCountChanged = (newVal: number, rule: RuleProps) => {
    console.log("handleCountChanged: ", newVal);
    const newRules = globalMessages.currentState.rules.map((r) => {
      if (r.name === rule.name) {
        r.count = newVal;
        console.log("RULE: ", r);
      }
      return r;
    });
    setGlobalMessages({
      ...globalMessages,
      currentState: { ...globalMessages.currentState, rules: newRules },
    });
  };

  return (
    <PopoverContent className="opacity-95 rounded-md h-fit w-[900px] mx-10 shadow-sm space-y-2 shadow-indigo-500/60">
      <Tabs defaultValue="account" className="bg-stone-500/5 h-96 m-2">
        <TabsList>
          {!customFunctionsOnly && (
            <TabsTrigger value="devices">Devices</TabsTrigger>
          )}
          {!customFunctionsOnly && (
            <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
          )}
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        <TabsContent value="devices">
          <p className="font-extralight mx-auto text-center">{lineContent}</p>
          {/* <div className="flex items-center border-b-[1px] mt-2 py-2 border-indigo-500/10">
          <div className="flex flex-col items-center justify-center gap-2">
            <Label className="text-xs mb-2">clamp1</Label>
            <input
              title="clamp1"
              type="checkbox"
              id="checkbox1"
              className="mr-2"
            />
          </div>
        </div> */}
          <div className="flex flex-wrap gap-2 p-2 items-center justify-center  ">
            {appState.wordPlayFunctions.map((func) => {
              return (
                <FunctionButton
                  key={func.name}
                  name={func.name}
                  displayName={func.displayName.replace("wordplay-", "")}
                  description={func.description}
                  handleFunctionSelected={handleFunctionSelected}
                  icon={func.icon}
                  color={func.color}
                />
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="modifiers">
          <p className="font-extralight mx-auto text-center">{lineContent}</p>
          <div className="p-6 flex flex-row flex-wrap items-center justify-around gap-1">
            {globalMessages.currentState.rules.map((rule, index) => {
              return (
                <div
                  key={index}
                  className={`w-36 h-36 p-4 border-[1px] border-violet-500 rounded-md flex flex-col gap-2 items-end justify-end text-right hover:cursor-pointer hover:bg-violet-500/70 ${
                    rule.selected ? "bg-violet-500 text-black " : "bg-slate-900"
                  }`}
                >
                  <div className="w-16 h-15 relative">
                    {rule.selected && (
                      <input
                        title="count"
                        type="number"
                        value={rule.count}
                        className={`w-16 h-16 bg-black ${
                          rule.count! > 0 ? "block" : "hidden"
                        } ${
                          rule.selected ? "text-white font-bold" : "text-black"
                        }`}
                        onChange={(e) =>
                          handleCountChanged(Number(e.target.value), rule)
                        }
                      />
                    )}
                  </div>
                  <div onClick={() => handleRulesSelected(rule)}>
                    {rule.displayName}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="custom">
          <div className="flex w-full p-2 justify-between px-10">
            <p className="font-extralight w-fit text-left ">{lineContent}</p>
            <div className="flex flex-col items-center justify-center gap-2">
              <Label
                className={`text-xs ${
                  customFunctionsOnly && "opacity-15 mb-2"
                }`}
              >
                Custom Only
              </Label>
              <Checkbox
                className="w-8 h-8 text-xl"
                title="custom-only"
                checked={customFunctionsOnly}
                onCheckedChange={(e) => {
                  setCustomFunctionsOnly(!customFunctionsOnly);
                  if (!customFunctionsOnly) {
                    setGlobalMessages({
                      ...globalMessages,
                      currentState: {
                        ...globalMessages.currentState,
                        currentFunction: "CUSTOM",
                        lastFunction:
                          globalMessages.currentState.currentFunction,
                      },
                    });
                  } else {
                    setGlobalMessages({
                      ...globalMessages,
                      currentState: {
                        ...globalMessages.currentState,
                        currentFunction:
                          globalMessages.currentState.lastFunction,
                        lastFunction:
                          globalMessages.currentState.currentFunction,
                      },
                    });
                  }
                }}
              />
            </div>
          </div>
          <div className="p-6 flex flex-row flex-wrap items-center h-48 overflow-y-auto justify-around gap-1">
            {appState.customFunctions &&
              appState.customFunctions.length > 0 &&
              appState.customFunctions.map((func, index) => {
                return (
                  <div
                    key={index}
                    className="flex items-center justify-center w-full"
                  >
                    <div
                      className="w-full h-fit p-4 border-[1px] border-violet-500/30 rounded-md flex flex-col gap-2 items-end justify-end text-right hover:cursor-pointer hover:bg-violet-500/70"
                      onClick={() => {
                        if (
                          globalMessages.currentState.customRequests.includes(
                            appState.customFunctions[index]
                          )
                        )
                          return;
                        setGlobalMessages({
                          ...globalMessages,
                          currentState: {
                            ...globalMessages.currentState,
                            customRequests: [
                              ...globalMessages.currentState.customRequests,
                              appState.customFunctions[index],
                            ],
                          },
                        });

                        // const newStates = [
                        //   ...aIStates,
                        //   {
                        //     ...aIStates[aIStates.length - 1],
                        //     customRequests: [
                        //       ...aIStates[aIStates.length - 1].customRequests,
                        //       func,
                        //     ],
                        //   },
                        // ];
                        // setAIStates(newStates);
                        // setGlobalCustomFunctions([
                        //   ...globalCustomFunctions,
                        //   func,
                        // ]);
                      }}
                    >
                      {func.name}
                    </div>
                    <Button
                      className="w-16 hover:cursor-pointer hover:bg-violet-500/70"
                      onClick={async () => {
                        const newCustomFuncs = appState.customFunctions.filter(
                          (f) => f.name !== func.name
                        );
                        await deleteCustomFunction(func.id || 0);
                        setAppState({
                          ...appState,
                          customFunctions: newCustomFuncs,
                        });
                      }}
                    >
                      <DeleteIcon className="w-6 h-full text-red-500" />
                    </Button>
                  </div>
                );
              })}
          </div>
        </TabsContent>
      </Tabs>
    </PopoverContent>
  );
}
