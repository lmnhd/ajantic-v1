import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActions } from "ai/rsc";
import { useCallback, useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { FunctionName, ProcessLyricProps } from "@/src/lib/types";
import { set } from "zod";

import {
  ArrowBigDown,
  ArrowBigUp,
  BotIcon,
  BoxIcon,
  CogIcon,
  DeleteIcon,
  EditIcon,
  GemIcon,
  LineChartIcon,
  MenuIcon,
  Mic2,
  MinusIcon,
  PenIcon,
  PinIcon,
  PlusIcon,
  Volume1Icon,
  ZapIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import FunctionPanel from "../functionpanel";
import { AIState } from "@/src/lib/aicontext";
import {
  AISessionState,
  AppState,
  GlobalMessages,
  ProcessType,
} from "@/src/lib/types";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { UpdateReferenceWordPlayBlocksProps } from "@/app/(main)/dashboard/editoractions/wordplays";
import {
  __initAIState,
  copySong,
  createNewBlock,
  createNewLine,
  insertBlockToList,
  reAlignLineNumbers,
  removeBlockFromList,
  shiftBlock,
} from "@/src/lib/lyric-helpers";
import { CopyIcon } from "@radix-ui/react-icons";
import {
  LINEACTION_getLineAsides,
  LINEACTION_storeLineAsides,
} from "./line-actions";
import { useToast } from "@/components/ui/use-toast";
import { LineLyricType } from "../line";

export default function LineOptions({
  text,
  blockNum,
  lineNum,
  handleLyricFunctionCall,
  globalMessages,
  __updateClientGlobalMessageHistory,
}: {
  text: string;
  blockNum: number;
  lineNum: number;
  handleLyricFunctionCall: any;
  globalMessages: GlobalMessages;
  __updateClientGlobalMessageHistory: any;
}) {
  const { appState, setAppState } = useGlobalStore();
  const { toast } = useToast();
  // LOAD LINE ASIDES
 

  return (
    <Popover>
      <PopoverTrigger className="bg-pink-400/20 rounded-md px-4 w-full h-full p-1">
        <EditIcon size={24} className="text-blue-500" />
      </PopoverTrigger>
      <PopoverContent className="flex flex-col w-full">
        <p className="text-xs text-center text-white/60 my-4">{text}</p>
        <div className="w-full grid grid-cols-4 items-center justify-center gap-4">
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            //type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              console.log("Follow up line clicked...");
              await handleLyricFunctionCall(
                FunctionName.FOLLOW_UP_LINE,
                "line",
                { rhyme: true }
              );
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <BotIcon size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Follow Up Rhyme</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            //type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              console.log("Follow up line clicked...");
              await handleLyricFunctionCall(
                FunctionName.FOLLOW_UP_LINE,
                "line",
                { rhyme: false }
              );
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <BotIcon size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Follow Up No Rhyme</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            //type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              const _song = copySong(globalMessages.currentState.currentSong);
              let _block = _song[blockNum];
              _block.text = _block.text
                .filter((_line, _index) => {
                  return _index <= lineNum;
                })
                .concat(
                  createNewLine(
                    blockNum,
                    lineNum,
                    _block.text[lineNum].text,
                    "line"
                  )
                )
                .concat(
                  _block.text.filter((_line, _index) => {
                    return _index > lineNum;
                  })
                )
                .map((_line, _index) => {
                  return {
                    ..._line,
                    lineNum: _index,
                  };
                });
              _block.text = _block.text.map((_line, _index) => {
                return {
                  ..._line,
                  lineNum: _index,
                };
              });
              _song[blockNum] = _block;
              console.log("Follow up line clicked1...", _song[blockNum]);
              console.log(
                "Follow up line clicked2...",
                globalMessages.currentState.currentSong[blockNum]
              );
              __updateClientGlobalMessageHistory({
                newState: {
                  ...globalMessages.currentState,
                  currentSong: _song,
                },
              });
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <PlusIcon size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Duplicate</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              const _song = copySong(globalMessages.currentState.currentSong);
              let _block = _song[blockNum];
              _block.text = _block.text
                .filter((_line, _index) => {
                  return _index !== lineNum;
                })
                .map((_line, _index) => {
                  return {
                    ..._line,
                    lineNum: _index,
                  };
                });
              _song[blockNum] = _block;
              __updateClientGlobalMessageHistory({
                newState: {
                  ...globalMessages.currentState,
                  currentSong: _song,
                },
              });
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <MinusIcon size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              if (lineNum == 1) return;
              const _song = copySong(globalMessages.currentState.currentSong);
              let _block = _song[blockNum];
              let _lineToMoveUp = _block.text[lineNum];
              let _lineToSwitch = _block.text[lineNum - 1];
              _song[blockNum].text[lineNum] = _lineToSwitch;
              _song[blockNum].text[lineNum - 1] = _lineToMoveUp;
              _song[blockNum].text = reAlignLineNumbers(_song[blockNum]);
              __updateClientGlobalMessageHistory({
                newState: {
                  ...globalMessages.currentState,
                  currentSong: _song,
                },
              });
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <ArrowBigUp size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move UP</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              const _blockLength =
                globalMessages.currentState.currentSong[blockNum].text.length;
              if (lineNum == _blockLength - 1) return;
              const _song = copySong(globalMessages.currentState.currentSong);
              let _block = _song[blockNum];
              let _lineToMoveDown = _block.text[lineNum];
              let _lineToSwitch = _block.text[lineNum + 1];
              _song[blockNum].text[lineNum] = _lineToSwitch;
              _song[blockNum].text[lineNum + 1] = _lineToMoveDown;
              _song[blockNum].text = reAlignLineNumbers(_song[blockNum]);
              __updateClientGlobalMessageHistory({
                newState: {
                  ...globalMessages.currentState,
                  currentSong: _song,
                },
              });
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <ArrowBigDown size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move DOWN</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              const newLineAsides = [
                ...appState.lineAsides,
                globalMessages.currentState.currentSong[blockNum].text[lineNum],
              ];
              setAppState({
                ...appState,
                lineAsides: newLineAsides,
              });
              await LINEACTION_storeLineAsides({
                lineLyrics: newLineAsides,
                userId: appState.currentUser.id,
              });

              toast({
                title: "Line Asides Stored",
                value: "Line Asides stored successfully",
                type: "foreground",
              });
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <CopyIcon className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Put Aside</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
          <div className="flex items-center justify-center rounded-md border-[1px] p-1">
            <Popover>
              <PopoverTrigger>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      {" "}
                      <GemIcon size={12} className="text-pink-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Insert Aside</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </PopoverTrigger>
              <PopoverContent>
                <ul>
                  {appState.lineAsides && appState.lineAsides.map((lineAside, index) => {
                    return (
                      <li
                        key={index}
                        className="flex justify-between items-center gap-3 text-left text-xs cursor-pointer hover:cursor-pointer "
                      >
                        <p
                        onClick={() => {
                          const _song = copySong(globalMessages.currentState.currentSong);
                          let _block = _song[blockNum];
                          _block.text = _block.text
                            .filter((_line, _index) => {
                              return _index <= lineNum;
                            })
                            .concat(
                              createNewLine(
                                blockNum,
                                lineNum,
                                lineAside.text,
                                "line"
                              )
                            )
                            .concat(
                              _block.text.filter((_line, _index) => {
                                return _index > lineNum;
                              })
                            )
                            .map((_line, _index) => {
                              return {
                                ..._line,
                                lineNum: _index,
                              };
                            });
                          _block.text = _block.text.map((_line, _index) => {
                            return {
                              ..._line,
                              lineNum: _index,
                            };
                          });
                          _song[blockNum] = _block;
                          console.log("Follow up line clicked1...", _song[blockNum]);
                          console.log(
                            "Follow up line clicked2...",
                            globalMessages.currentState.currentSong[blockNum]
                          );
                          __updateClientGlobalMessageHistory({
                            newState: {
                              ...globalMessages.currentState,
                              currentSong: _song,
                            },
                          });
                        }} 
                        className="hover:bg-violet-700 w-56 text-white/60 rounded-md p-2 bg-slate-900 my-4"
                        >
                          {lineAside.text}
                        </p>
                        <DeleteIcon onClick={() => {
                          const newLineAsides = appState.lineAsides.filter(
                            (line, i) => {
                              return i !== index;
                            }
                          );
                          setAppState({
                            ...appState,
                            lineAsides: newLineAsides,
                          });
                          LINEACTION_storeLineAsides({
                            lineLyrics: newLineAsides,
                            userId: appState.currentUser.id,
                          });
                        }} />
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          <div
            className={`text-xs w-14 h-14 bg-black`}
            //disabled={containerEditMode == "edit" ? true : false}
            //type="button"
            //variant="outline"
          ></div>
          <Button
            className={`text-xs`}
            //disabled={containerEditMode == "edit" ? true : false}
            type="button"
            variant="outline"
            onClick={async (e) => {
              e.preventDefault();
              const _blockLength =
                globalMessages.currentState.currentSong[blockNum].text.length;
              if (lineNum == _blockLength - 1) return;
              const _song = copySong(globalMessages.currentState.currentSong);
              let _block = _song[blockNum];
              let _lineToMoveDown = _block.text[lineNum];
              let _lineToSwitch = _block.text[lineNum + 1];
              _song[blockNum].text[lineNum] = _lineToSwitch;
              _song[blockNum].text[lineNum + 1] = _lineToMoveDown;
              _song[blockNum].text = reAlignLineNumbers(_song[blockNum]);
              __updateClientGlobalMessageHistory({
                newState: {
                  ...globalMessages.currentState,
                  currentSong: _song,
                },
              });
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {" "}
                  <ArrowBigDown size={16} className="text-pink-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move DOWN</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
