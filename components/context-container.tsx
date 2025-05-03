"use client";
import { LineLyricType } from "@/src/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/src/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  AtomIcon,
  Disc3Icon,
  PlusIcon,
  Users2Icon,
  Expand,
  Shrink,
  Fullscreen,
  Trash2Icon,
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { AgentComponentProps, ServerMessage } from "@/src/lib/types";
import {
  DynamicFormSchema,
  
} from "@/src/lib/types";
import DynamicForm from "./dynamic-form";

import { useFullscreen } from "../src/lib/useFullscreen";
import { useAnalysisStore } from "../src/lib/store/analysis-store";
import { DynamicFormValueType } from "@/src/lib/post-message-analysis/form-creator-core";

type ThemeColor = 'violet' | 'blue' | 'indigo' | 'purple' | 'slate' | 'gray' | 'zinc' | 'emerald' | 'green' | 'red' | 'yellow' | string;

interface ContextContainerProps {
  lines: LineLyricType[];
  text: string;
  formSchema?: {
    schema: DynamicFormSchema;
    formName: string;
  };
  name: string;
  index: number;
  currentContextItem: number;
  localCurrentContextItem: number;
  setLocalCurrentContextItem: (index: number) => void;
  setCurrentContextItem: (index: number) => void;
  agentNames: string[];
  deleteIndex?: (index: number) => void;
  disabled?: boolean;
  setIsDisabled?: (isDisabled: boolean) => void;
  textInputChanged?: (text: string) => void;
  deleteSet?: (index: number) => void;
  handleDeleteTextFromSet?: (index: number) => void;
  setLabelName?: (name: string) => void;
  fullHeight?: boolean;
  fullScreen?: boolean;
  shift?: (index: number, direction: "up" | "down") => void;
  currentAgentsForVisibility?: AgentComponentProps[];
  thisContainersHiddenAgentNames?: string[];
  toggleHideFromAgents?: (
    agentName: string,
    selectedIndex: number,
    allAgentNames: string[],
    soloInstead?: boolean
  ) => void;
  convertLinesToText?: (index: number) => void;
  deleteSingleLineFromSet?: (setIndex: number, lineIndex: number) => void;
  onFormSubmit?: (values: FormData) => void;
  themeColor?: ThemeColor;
}

export default function ContextContainer({
  lines,
  text = "",
  formSchema,
  name,
  index,
  currentContextItem,
  localCurrentContextItem,
  setCurrentContextItem,
  agentNames,
  setLocalCurrentContextItem,
  deleteIndex,
  disabled,
  setIsDisabled,
  textInputChanged,
  deleteSet,
  handleDeleteTextFromSet,
  setLabelName,
  fullHeight,
  fullScreen,
  shift,
  currentAgentsForVisibility,
  thisContainersHiddenAgentNames,
  toggleHideFromAgents,
  convertLinesToText,
  deleteSingleLineFromSet,
  onFormSubmit,
  themeColor = 'indigo'
}: ContextContainerProps) {
  // console.log("lines", lines);
  // console.log("name", name);
  // console.log("index", index);
  // console.log("currentContextItem", currentContextItem);
  // console.log("currentContextItem", currentContextItem);

  //const [isDisabled, setIsDisabled] = useState(false);

  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();
  const [editText, setEditText] = useState(false);
  const [textValue, setTextValue] = useState(text);

  const labelNameInputRef = useRef<HTMLInputElement>(null);
  const [labelNameValue, setLabelNameValue] = useState(name);
  const [editLabelName, setEditLabelName] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  //const [localFullScreenActive, setLocalFullScreenActive] = useState(false);
  //const [localCurrentContextItem, setLocalCurrentContextItem] = useState(0);

  const isSelected = (_index: number) => {
    //console.log("localCurrentContextItem", localCurrentContextItem);
    //console.log("index", index);
    //console.log("localCurrentContextItem === index", localCurrentContextItem === index);
    //return localCurrentContextItem === index;
    return localCurrentContextItem === index;
    //return false;
  };

  useEffect(() => {
   if(fullScreen){
    toggleFullscreen();
   }
  }, [fullScreen, toggleFullscreen]);

  useEffect(() => {
    console.log("formSchema", formSchema);
  }, [formSchema]);

  useEffect(() => {
    console.log("labelNameValue", labelNameValue);
    if (labelNameValue) {
      setLabelName?.(labelNameValue);
      if (labelNameInputRef.current && editLabelName) {
        labelNameInputRef.current.value = labelNameValue;
      }
    }
  }, [editLabelName, labelNameValue, setLabelName]);

  useEffect(() => {
    if (textInputRef.current) {
      if (index !== currentContextItem) {
        return;
      }
      console.log("setting text", textValue);
      textInputRef.current.value = textValue;
      textInputRef.current.focus();
    }
  }, [textValue, index, currentContextItem]);

  useEffect(() => {
    if (textInputRef.current && editText) {
      console.log("setting text", textValue);
      textInputRef.current.value = textValue;
      //textInputRef.current.focus();
    }
  }, [editText, textValue]);

  useEffect(() => {
    if (textValue !== text) {
      setTextValue(text);
    }
  }, [text]);

  return (
    <div
      className={cn(
        disabled ? "opacity-30" : "",
        "flex-1 w-full",
        "cursor-pointer",
        isFullscreen &&
          "fixed inset-0 !z-[100] bg-black mt-14 mb-15 w-screen h-screen p-4 overflow-y-auto"
      )}
      ref={fullscreenRef}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        // if(index === currentContextItem){return}
        if (editText) {
          return;
        }
        //e.stopPropagation();
        // console.log("SLC-FOCUSED", index);
        // console.log("CURRENTLINESET", currentContextItem);

        //console.log("setting index", index);
        //setIndex(index);
        setLocalCurrentContextItem(index);
        setCurrentContextItem(index);
      }}
      onBlur={(e) => {
        //console.log("SLC-BLURRED", e);
        setEditText(false);
      }}
      // onKeyDown={(e) => {
      //   if (e.key === "Enter") {
      //     setEditText(false);
      //   }
      // }}
      onMouseLeave={() => setEditText(false)}
    >
      {/* <div className="text-3xl text-white">{localCurrentContextItem}</div> */}
      <div className={`flex justify-between rounded-t-xl z[20] bg-${themeColor}-800/10 p-1`}>
        <div className="flex items-center justify-center pl-2 z-[20] gap-2">
          {!text && lines.length === 0 && !formSchema && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  onClick={() => {
                    //if (text && lines.length === 0) return;
                    console.log("adding text");
                    setCurrentContextItem(index);
                    setTextValue("new text");
                    textInputChanged?.("new text");
                    setEditText(true);
                  }}
                >
                  <PlusIcon className={`w-4 h-4 text-${themeColor}-500`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>add text</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {(text || lines.length > 0) && !formSchema && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex items-center justify-center cursor-pointer">
                        <Users2Icon className={`w-4 h-4 text-${themeColor}-500 hover:text-${themeColor}-400 transition-colors`} />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent 
                      className={`w-80 bg-black/90 border border-${themeColor}-500/30 backdrop-blur-lg`}
                      onMouseLeave={(e) => {
                        // Find and click the trigger to close the popover
                        const trigger = document.querySelector('[data-state="open"][role="dialog"]');
                        if (trigger) {
                          (trigger as HTMLElement).click();
                        }
                      }}
                    >
                      <div className="space-y-4">
                        <div className={`border-b border-${themeColor}-500/30 pb-2`}>
                          <h4 className={`font-medium text-${themeColor}-400`}>
                            Agent Visibility
                          </h4>
                          <p className="text-xs text-gray-400">
                            Click to toggle visibility • CTRL+Click to solo
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {currentAgentsForVisibility &&
                          currentAgentsForVisibility.length > 0 ? (
                            currentAgentsForVisibility
                              .filter(
                                (agent: AgentComponentProps) => !agent.disabled
                              )
                              .map((agent: AgentComponentProps, i: number) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "px-3 py-1.5 text-center text-xs font-medium rounded-md transition-all duration-200 cursor-pointer",
                                    !thisContainersHiddenAgentNames?.includes(
                                      agent.name
                                    )
                                      ? `bg-${themeColor}-500/20 text-${themeColor}-300 hover:bg-${themeColor}-500/30 border border-${themeColor}-500/50`
                                      : "bg-gray-800/50 text-gray-500 hover:bg-gray-800/70 border border-gray-700/50"
                                  )}
                                  onClick={(e) => {
                                    toggleHideFromAgents?.(
                                      agent.name,
                                      index,
                                      agentNames,
                                      e.ctrlKey
                                    );
                                  }}
                                >
                                  {agent.name}
                                </div>
                              ))
                          ) : (
                            <div className="text-sm text-gray-500 col-span-3 text-center">
                              No agents assigned
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Agent Visibility</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex w-full h-6 items-end justify-end ">
          <TooltipProvider>
            <div className="flex gap-2 items-center justify-center">
              {/* {text && (
                <Tooltip>
                  <TooltipTrigger
                    onClick={() => {
                      console.log("edit text clicked");
                      setEditText(!editText);
                    }}
                  >
                    <Disc3Icon className="w-4 h-4 text-green-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>edit text</p>
                  </TooltipContent>
                </Tooltip>
              )} */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => {
                      shift?.(index, "up");
                    }}
                    className="cursor-pointer"
                  >
                    <ArrowUp className={`w-4 h-4 text-${themeColor}-500`} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Shift Up</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => {
                      shift?.(index, "down");
                    }}
                    className="cursor-pointer"
                  >
                    <ArrowDown className={`w-4 h-4 text-${themeColor}-500`} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Shift Down</p>
                </TooltipContent>
              </Tooltip>
              {text && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => {
                        handleDeleteTextFromSet?.(index);
                      }}
                      className="cursor-pointer"
                    >
                      <Disc3Icon className={`w-4 h-4 text-${themeColor}-500`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>clear text</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {lines && lines.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => {
                        console.log("convert to text clicked");
                        convertLinesToText?.(index);
                      }}
                      className="cursor-pointer"
                    >
                      <Disc3Icon className={`w-4 h-4 text-${themeColor}-500`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>convert to text</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => {
                      console.log("Atom icon clicked");
                      setIsDisabled?.(!disabled);
                      // Add your logic for the atom icon click here
                    }}
                    className="cursor-pointer"
                  >
                    <Disc3Icon className={`w-4 h-4 text-${themeColor}-500`} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>disable</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={(e) => {
                      if (deleteSet) {
                        console.log("Delete button clicked for set index:", index);
                        if (
                          window.confirm(
                            "Are you sure you want to delete this set?"
                          )
                        ) {
                          console.log("Confirmation accepted, calling deleteSet with index:", index);
                          deleteSet(index);
                        }
                      } else {
                        console.error("deleteSet prop is undefined");
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Trash2Icon className="w-4 h-4 text-red-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>delete</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => {
                      console.log("fullScreen", isFullscreen);
                      //onFullscreenChange?.(!fullScreen);
                      //setLocalFullScreenActive(!localFullScreenActive);
                      toggleFullscreen();
                    }}
                    className="cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Shrink className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <Expand className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullscreen ? "exit fullscreen" : "fullscreen"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
      <div
        //className={cn("w-full")}
        className={cn(
          `shadow-lg min-h-24`,
          "h-5/6 w-full",
          !isFullscreen && fullHeight && "h-fit",
          !isFullscreen && !fullHeight && "h-72",
          `rounded-sm rounded-t-none bg-gradient-to-b from-black/40 to-black/60 backdrop-blur-sm p-2 pt-0 overflow-y-auto hover:bg-${themeColor}-600/10 hover:mix-blend-plus-lighter transition-all duration-100 ease-linear`,
          isSelected(index)
            ? `border-2 border-${themeColor}-600 shadow-lg`
            : "border-[1px] border-gray-300/30"
          //`bg-white/20 `
        )}
      >
        <div
          className={cn(
            `text-xl font-bold rounded-md p-3 px-0 mix-blend-plus-lighter text-${themeColor}-600 bg-black/10 backdrop-blur-sm w-fit? sticky top-0 left-0 cursor-pointer hover:scale-110?`
          )}
          onDoubleClick={() => {
            setEditLabelName(true);
            setTimeout(() => {
              labelNameInputRef.current?.focus();
              labelNameInputRef.current?.select();
            }, 0);
          }}
        >
          {editLabelName ? (
            <input
              ref={labelNameInputRef}
              title="Edit label name"
              className={`text-xl font-bold rounded-md p-3 px-0 mix-blend-plus-lighter text-${themeColor}-600 bg-black/60 backdrop-blur-sm w-fit? sticky top-0 left-0 cursor-pointer hover:scale-110?`}
              defaultValue={labelNameValue}
              onBlur={(e) => {
                setEditLabelName(false);
                setLabelNameValue(e.target.value);
              }}
              onChange={(e) => {
                setLabelNameValue(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setEditLabelName(false);
                  if (labelNameInputRef.current) {
                    setLabelNameValue(labelNameInputRef.current.value);
                  }
                }
              }}
            />
          ) : (
            name || "untitled list"
          )}
        </div>
        <div className={cn("h-4")}></div>
        {!formSchema &&
          lines &&
          lines.length > 0 &&
          lines.map((line: LineLyricType, i: number) => {
            //console.log('line', line)
            return (
              <p
                className={cn(`text-sm text-${themeColor}-200 my-4 cursor-pointer`)}
                key={i}
                onClick={(e) => {
                  console.log(
                    "clicked line - deleting",
                    line.content,
                    index,
                    currentContextItem
                  );
                  e.stopPropagation();
                  deleteSingleLineFromSet?.(index, i);
                }}
              >
                - {line!.content}
              </p>
            );
          })}
        {!formSchema && text && !editText && (
          <p
            className={`text-sm text-${themeColor}-200 whitespace-pre-wrap my-4 cursor-pointer w-full`}
            onClick={(e) => {
              console.log("clicked text", text, index, currentContextItem);
              if (index !== localCurrentContextItem) {
                return;
              }
              e.stopPropagation();
              setCurrentContextItem(index);
              setLocalCurrentContextItem(index);
              setEditText(true);
              //onFullscreenChange?.(true);
              //toggleFullscreen();
              //setLocalFullScreenActive(true);
              setTimeout(() => {
                textInputRef.current?.focus();
                textInputRef.current?.select();
              }, 0);
            }}
          >
            {text}
          </p>
        )}
        {!formSchema && text && editText && (
          <textarea
            ref={textInputRef}
            className={`text-sm text-${themeColor}-200 bg-black rounded-md whitespace-pre-wrap my-4? cursor-pointer h-full w-full`}
            // aria-label="Edit text"
            placeholder="Edit text"
            //value={textValue}
            //defaultValue={textValue}
            // //defaultValue={text}
            // onChange={(e) => {
            //   setTextValue(e.target.value);
            //   //textInputChanged?.(e.target.value);
            // }}
            rows={Math.max(3, Math.ceil(textValue?.length / 50))}
            // aria-multiline="true"
            onBlur={(e) => {
              setTextValue(e.target.value);
              textInputChanged?.(e.target.value);
              //onFullscreenChange?.(false);
              //toggleFullscreen();
            }}
            onMouseLeave={(e) => {
              console.log("leaving text", text);
              setTextValue(textValue);
              textInputChanged?.(textValue);
              //onFullscreenChange?.(false);
              //toggleFullscreen();
            }}
            // onKeyDown={(e) => {
            //   if (e.key === "Enter") {
            //     console.log("enter key pressed", textValue);
            //     textInputChanged?.(textValue);
            //     setEditText(false);
            //   }
            // }}
          />
        )}
        
        {/* Show reset form button when a form exists and text is present */}
        {formSchema && text && (
          <div className="w-full mb-4">
            <div className="flex justify-center mb-4">
              <button
                className={`px-4 py-2 rounded-md bg-${themeColor}-600 text-white text-sm font-medium hover:bg-${themeColor}-500 transition-colors`}
                onClick={() => {
                  if (textInputChanged) {
                    textInputChanged("");
                    setTextValue("");
                  }
                }}
              >
                Reset Form
              </button>
            </div>
            <div className="px-4">
              <p className={`text-sm text-${themeColor}-200 whitespace-pre-wrap my-4 w-full`}>
                {text}
              </p>
            </div>
          </div>
        )}
        
        {/* Only show form when there is no text content */}
        {formSchema && text === "" && (
          <div className="w-full p-4">
            <DynamicForm
              schema={formSchema.schema.map(item => ({
                ...item,
                valueType: item.valueType.toLowerCase() as DynamicFormValueType
              }))}
              onSubmit={(values: any) => {
                // First convert form data to a text string in markup format
                let formData;
                
                // Check if values is FormData or a regular object
                if (values instanceof FormData) {
                  formData = Object.fromEntries(values.entries());
                } else if (typeof values === 'object') {
                  formData = values; // Already an object, use directly
                } else {
                  console.error('Unexpected values type:', typeof values, values);
                  return; // Can't process this data type
                }
                
                let markupText = `# ${formSchema.formName || 'Form Submission'}\n\n`;
                
                // Add each form field in markup format
                Object.entries(formData).forEach(([key, value]) => {
                  // Format the key to be more readable (convert camelCase to Title Case)
                  const formattedKey = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase());
                  
                  markupText += `**${formattedKey}**: ${value}\n\n`;
                });
                
                // Update the text value
                if (textInputChanged) {
                  textInputChanged(markupText);
                  setTextValue(markupText);
                }
                
                // Also call the original onSubmit if provided
                if (onFormSubmit) {
                  onFormSubmit(values);
                } else {
                  console.log("Form submitted:", formData);
                }
                
                // Directly update the agentGlobalChatInput in the store instead of using an event
                useAnalysisStore.setState({ 
                  agentGlobalChatInput: `Information submitted and available in the context titled "${formSchema.formName || name}". Please continue with the next step.` 
                });
              }}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
