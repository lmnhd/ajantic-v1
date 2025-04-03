// //import { sendMessageTest } from "@/app/aicontext";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { useActions } from "ai/rsc";
// import React, { useCallback, useState } from "react";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@/components/ui/collapsible";

// import { FunctionName, LineLyricType, ProcessLyricProps } from "@/src/lib/types";
// import { set } from "zod";

// import {
//   ArrowBigDown,
//   ArrowBigUp,
//   BotIcon,
//   BoxIcon,
//   CogIcon,
//   EditIcon,
//   GemIcon,
//   LineChartIcon,
//   MenuIcon,
//   Mic2,
//   MinusIcon,
//   PenIcon,
//   PencilIcon,
//   PinIcon,
//   PlusIcon,
//   Volume1Icon,
//   ZapIcon,
// } from "lucide-react";
// import { Label } from "@/components/ui/label";
// import FunctionPanel from "./functionpanel";
// import { AIState } from "@/src/lib/aicontext";
// import {
//   AISessionState,
//   AppState,
//   GlobalMessages,
//   ProcessType,
// } from "@/src/lib/types";
// import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
// // import {
// //   updateReferenceWordPlayBlocks,
// //   UpdateReferenceWordPlayBlocksProps,
// // } from "@/app/(main)/dashboard/editoractions/wordplays";
// import {
//   __initAIState,
//   clearLinesFromBlock,
//   copySong,
//   createNewBlock,
//   createNewLine,
//   insertBlockToList,
//   reAlignLineNumbers,
//   removeBlockFromList,
//   shiftBlock,
// } from "@/src/lib/lyric-helpers";
// import { group } from "console";
// import VoicePanel from "@/src/lib/voices/components/lyric-container/voice-panel";
// import VoicePanelContainer from "./voicepanel/voicepanelcontainer";
// import { setGlobal } from "next/dist/trace";
// import { touchStartEvent } from "@tsparticles/engine";
// import { BlockLyricType } from "./block";
// import LineOptions from "./line/line-options-component";
// import TextStream from "@/components/global/text-stream";
// import { BackgroundGradientAnimation } from "@/components/ui/background-animation";
// import { UTILS_getRandomRGBColorString, UTILS_startLoading } from "@/src/lib/utils";
// import { BackgroundGradientAnimationNOBG } from "@/components/ui/background-animation-nobg";
// import {
//   __storeHistoryFromClient,
//   handleProcessLineOrGroup,
// } from "@/src/lib/server-actions";

// //import { currentFunction } from "@/app/(main)/dashboard/functions";

// // export type LineLyricType = {
// //   text: string;
// //   blockNum: number;
// //   blockLength: number;
// //   lineNum: number;
// //   type: "label" | "line";
// //   addSingleLineToWPReferences?: (lineNum: number) => void;
// //   handleGroupSelection?: (
// //     lineNum: number,
// //     blockNum: number,
// //     selected: boolean
// //   ) => void;
// //   isSelected?: boolean;
// //   addGroupLinesToReference?: () => void;
// //   groupSelected?: boolean;
// //   selectedLines?: { blockNum: number; lineNum: number }[];
// //   containerEditMode?: "edit" | "reference";
// // };

// export async function __updateStreamData({
//   appState,
//   result,
//   setAppState,
//   setGlobalMessages,
//   storeHistoryFromClient,
// }: {
//   appState: AppState;
//   setAppState: any;
//   result: { _streamData: any; globalMessages: GlobalMessages };
//   setGlobalMessages: any;
//   storeHistoryFromClient?: any;
// }) {
//   console.log("result: ", appState, result);

//   if (
//     result.globalMessages.currentState.currentFunction ==
//     FunctionName.CLIENT_HISTORY_UPDATE
//   ) {
//     console.log(
//       "CLIENT_HISTORY_UPDATE: ",
//       result.globalMessages.currentState.currentFunction,
//       result.globalMessages.currentState.lastFunction
//     );
//     const _newGlobalMessages = {
//       history: [
//         ...result.globalMessages.history,
//         result.globalMessages.currentState,
//       ],
//       currentState: {
//         ...result.globalMessages.currentState,
//         currentFunction:
//           result.globalMessages.currentState.role == "try_again"
//             ? result.globalMessages.currentState.currentFunction
//             : result.globalMessages.currentState.lastFunction,
//         lastFunction:
//           result.globalMessages.currentState.role == "try_again"
//             ? result.globalMessages.currentState.lastFunction
//             : result.globalMessages.currentState.currentFunction,
//       },
//     };
//     setGlobalMessages(_newGlobalMessages);

//     return {};
//   }

//   //return {}

//   let _state = result.globalMessages.currentState;
//   if (
//     _state.role == "final_response" ||
//     _state.role == "try_again" ||
//     storeHistoryFromClient
//   ) {
//     _state = {
//       ..._state,
//       groupLines: [],
//       //previousData: _state.role == 'try_again' ? _state.previousData : _state.resultData,
//       customRequestModifiers: [],
//       resultData: { data: { mergeMode: false }, options: [] },
//       //currentTryCount: result.globalMessages.currentState.role == 'try_again' ? result.globalMessages.currentState.currentTryCount + 1 : 0,
//       //currentFunction: result.globalMessages.currentState.lastFunction,
//     };
//     const _newGlobalMessages = {
//       ...result.globalMessages,
//       currentState: _state,
//     };
//     console.log("newGlobalMessages: ", _newGlobalMessages);

//     const _open =
//       result.globalMessages.currentState.role == "final_response" ||
//       result.globalMessages.currentState.role == "cancel_function"
//         ? false
//         : true;

//     setAppState({
//       ...appState,
//       _streamData: result._streamData,
//       modalChoices: result.globalMessages.currentState.resultData,
//       dialogOpen: _open,
//       loading: false,
//       loadingText: "",
//     });

//     console.log("_updateStreamData _open: ", _open);

//     if (_state.role == "final_response" || _state.role == "try_again") {
//       setGlobalMessages(_newGlobalMessages);
//       console.log("setGlobalMessages: ", _newGlobalMessages);
//       return;
//     }

//     if (storeHistoryFromClient) {
//       storeHistoryFromClient({
//         globalMessages: _newGlobalMessages,
//         userId: _newGlobalMessages.currentState.userId,
//       });
//     }
//   }
// }

// export default function LineLyric({
//   content,
//   id,
//   metadata,
// }: LineLyricType) {
//   const [editLineTextMode, setEditLineTextMode] = useState(false);
//   const [voicePanelOpen, setVoicePanelOpen] = useState(false);
//   const [tempInputText, setTempInputText] = useState("");
//   const { appState, globalMessages, setAppState, setGlobalMessages } =
//     useGlobalStore();

//   // //const [currentFunc, setCurrentFunc] = useState<string>('')
//   // const handleGroupLinesProcess = async () => {
//   //   const _state = JSON.stringify(globalMessages.currentState);
//   //   const _rules = JSON.stringify(globalMessages.currentState.rules);
//   //   const resultOBJ = await handleProcessLineOrGroup({
//   //     globalMessages: {
//   //       ...globalMessages,
//   //       currentState: {
//   //         ...globalMessages.currentState,
//   //         role: "final_response",
//   //         finalResponse: text,
//   //         groupLines: [],
//   //       },
//   //     },
//   //   });

//     //setOptionVals([...optionVals, ...resultobj.data.resultOptions]);


//     // const newMessages: GlobalMessages = {
//     //   history: globalMessages.history,
//     //   currentState: resultOBJ.
//     // };
//     // setGlobalMessages(newMessages);
//     //setProcessType(resultobj.processType);
//     //await showResults(resultOBJ);
//   };


//   //containerEditMode == 'reference' &&
//   return (
//     <div
//       //  gradientBackgroundStart="rgba(102, 5, 5, 0.527)"
//       //  gradientBackgroundEnd="rgba(54, 30, 109, 0.144)"
//       //gradientBackgroundStart={UTILS_getRandomRGBColorString(true)}
//       //gradientBackgroundEnd={UTILS_getRandomRGBColorString()}

//       //  firstColor={UTILS_getRandomRGBColorString(false)}
//       //  secondColor={UTILS_getRandomRGBColorString(false)}
//       //  thirdColor={UTILS_getRandomRGBColorString(false)}
//       //  fourthColor={UTILS_getRandomRGBColorString(false)}
//       //  interactive={true}
//       //  bgEnabled={true}
//       className="bg-blend-color-dodge bg-gradient-to-r from-black/10 via-violet-300/20 to-violet-700/60 my-2 rounded-sm"
//     >
//       <div className="bg-black mix-blend-screen">
//         <div className="group group-hover:bg-yellow-200 grid sm:flex items-center justify-start w-full">
//           {/**LINE TEXT INPUT */}
//           {lineNum > 0 && (
//             <input
//               title="group-select"
//               type="checkbox"
//               checked={
//                 globalMessages.currentState.groupLines.filter(
//                   (_line) =>
//                     _line.blockNum == blockNum && _line.lineNum == lineNum
//                 ).length > 0
//               }
//               className="text-xs bg-indigo-800 h-4 w-4 border-[1px] border-pink-400 opacity-50"
//               onChange={(e) => {
//                 console.log("handle group selection clicked: ", e);
//                 if (handleGroupSelection) {
//                   handleGroupSelection(lineNum, blockNum, e.target.checked);
//                 }
//               }}
//             />
//           )}
//           <form
//             className="grid grid-flow-col grid-cols-7 gap-2 p-1 justify-center group-hover:bg-yellow-200/20 w-full"
//             onSubmit={async (e: any) => {
//               e.preventDefault();
//               if (!globalMessages.currentState.currentFunction) return;
//               await handleLyricFunctionCall(
//                 globalMessages.currentState.currentFunction,
//                 "line"
//               );
//             }}
//           >
//             <div className="flex relative items-center p-2? m-2? justify-start col-span-8 space-x-6 text-left min-w-[400px]? sm:w-[400px]? 2xl:w-[670px] gap-6 ">
//               {/* <div className="absolute top-0 left-0 h-full z-50 w-full bg-black"/> */}
//               {editLineTextMode ? (
//                 <Input
//                   value={tempInputText}
//                   onChange={(e) => {
//                     e.preventDefault();
//                     const newText = e.target.value;
//                     setTempInputText(newText);
//                     // setGlobalMessages({
//                     //   ...globalMessages,
//                     //   history: [...globalMessages.history, globalMessages.currentState],
//                     //   currentState: {
//                     //     ...globalMessages.currentState,
//                     //     currentSong: song,
//                     //   },
//                     // });
//                   }}
//                   onDoubleClick={() => {
//                     setEditLineTextMode(false);
//                     let _newSong = globalMessages.currentState.currentSong.map(
//                       (_block, _index) => {
//                         if (_index == blockNum) {
//                           return {
//                             ..._block,
//                             text: _block.text.map((_line, _lineIndex) => {
//                               if (_lineIndex == lineNum) {
//                                 return {
//                                   ..._line,
//                                   text: tempInputText,
//                                 };
//                               }
//                               return _line;
//                             }),
//                           };
//                         }
//                         return _block;
//                       }
//                     );
//                     _newSong[blockNum].text[lineNum].text = tempInputText;
//                     console.log("New Song before text input edit...", _newSong);
//                     console.log(
//                       "Current Song before edits...",
//                       globalMessages.currentState.currentSong
//                     );
//                     __updateClientGlobalMessageHistory({
//                       newState: {
//                         ...globalMessages.currentState,
//                         currentSong: _newSong,
//                       },
//                     });
//                   }}
//                   onFocus={() => setEditLineTextMode(true)}
//                   //onMouseOut={() => setEditLineTextMode(false)}
//                 />
//               ) : (
//                 <p
//                   className={`bg-black/60 bg-dot-white/[0.2] rounded-md z-50 backdrop-blur-lg p-1 text-slate-100? cursor-pointer w-full 3xl:min-w-full tracking-widest hover:bg-blue-600/20 bg-blend-multiply ${
//                     type == "label"
//                       ? "font-extrabold text-2xl italic underline pl-0"
//                       : " font-thin? text-violet-300/70 pl-2"
//                   } ${
//                     voicePanelOpen
//                       ? "text-lime-800 bg-violet-500 font-extrabold text-3xl"
//                       : "text-indigo-200 font-bold"
//                   }`}
//                   //onClick={() => processLineOrGroup({ text, type, processLineOrGroup })}
//                   onDoubleClick={() => {
//                     setTempInputText(text);
//                     setEditLineTextMode(true);
//                   }}
//                 >
//                   <TextStream inputText={text} />
//                   {/* {text} */}
//                 </p>
//               )}
//             </div>
//             {/**DELETE BLOCK */}
//             {lineNum == 0 && containerEditMode == "edit" && (
//               <div
//               //className="flex items-center col-span-2 "
//               >
//                 <Popover>
//                   <PopoverTrigger className="bg-slate-400/20 rounded-md px-4 w-full h-full p-1">
//                     <CogIcon size={18} className="text-red-500" />
//                   </PopoverTrigger>
//                   <PopoverContent className="w-fit flex items-center justify-center gap-4">
//                     <Button
//                       className={`text-xs`}
//                       type="button"
//                       variant="secondary"
//                       //disabled={true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         __updateClientGlobalMessageHistory({
//                           newState: {
//                             ...globalMessages.currentState,
//                             curBlockNum: blockNum,
//                             currentSong: removeBlockFromList(
//                               globalMessages.currentState.currentSong,
//                               blockNum
//                             ),
//                           },
//                         });
//                       }}
//                     >
//                       Delete
//                     </Button>
//                     <Button
//                       className={`text-xs`}
//                       type="button"
//                       variant="secondary"
//                       //disabled={true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         __updateClientGlobalMessageHistory({
//                           newState: {
//                             ...globalMessages.currentState,
//                             curBlockNum: blockNum,
//                             currentSong: clearLinesFromBlock(
//                               globalMessages.currentState.currentSong,
//                               blockNum
//                             ),
//                           },
//                         });
//                       }}
//                     >
//                       Clear lines
//                     </Button>
//                     <Button
//                       className={`text-xs`}
//                       type="button"
//                       variant="secondary"
//                       //disabled={true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         const textForFirstLine = window.prompt(
//                           "Enter text for first line",
//                           "New Line"
//                         );
//                         // setGlobalMessages({
//                         //   ...globalMessages,
//                         const newSong = insertBlockToList(
//                           globalMessages.currentState.currentSong,
//                           textForFirstLine || "New block...",
//                           blockNum
//                         );
//                         console.log("newSong: ", newSong);
//                         __updateClientGlobalMessageHistory({
//                           newState: {
//                             ...globalMessages.currentState,
//                             currentSong: newSong,
//                           },
//                         });
//                       }}
//                     >
//                       Append
//                     </Button>
//                     <Button
//                       className={`text-xs`}
//                       type="button"
//                       variant="secondary"
//                       //disabled={true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         const _newState = {
//                           ...globalMessages.currentState,
//                           currentSong: shiftBlock(
//                             "up",
//                             globalMessages.currentState.currentSong.map(
//                               (_block) => {
//                                 return {
//                                   ..._block,
//                                   text: _block.text.map((_line) => {
//                                     return {
//                                       ..._line,
//                                       lineNum: _line.lineNum + 1,
//                                     };
//                                   }),
//                                 };
//                               }
//                             ) as BlockLyricType[],
//                             blockNum
//                           ),
//                         };
//                         console.log(
//                           "shift up newState: ",
//                           _newState.currentSong
//                         );
//                         console.log(
//                           "shift up globalMessages: ",
//                           globalMessages.currentState.currentSong
//                         );
//                         __updateClientGlobalMessageHistory({
//                           newState: _newState, // Add type assertion here
//                         });
//                       }}
//                     >
//                       shift
//                       <ArrowBigUp size={16} />
//                     </Button>
//                     <Button
//                       className={`text-xs`}
//                       type="button"
//                       variant="secondary"
//                       //disabled={true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         __updateClientGlobalMessageHistory({
//                           newState: {
//                             ...globalMessages.currentState,
//                             currentSong: shiftBlock(
//                               "down",
//                               globalMessages.currentState.currentSong,
//                               blockNum
//                             ),
//                           },
//                         });
//                       }}
//                     >
//                       shift
//                       <ArrowBigDown size={16} />
//                     </Button>
//                   </PopoverContent>
//                 </Popover>
//               </div>
//             )}
//             {/**NEW LINE*/}
//             {lineNum == 0 && (
//               <div
//               //className="flex items-center col-span-2 "
//               >
//                 <Popover>
//                   <PopoverTrigger className="bg-slate-400/20 rounded-md px-4 w-full h-full p-1">
//                     <PenIcon size={18} className="text-yellow-500" />
//                   </PopoverTrigger>
//                   <PopoverContent className="w-fit flex items-center justify-center gap-4">
//                     <div
//                       className={`text-xs bg-black/20 w-full h-full p-4 border-[1px] rounded-sm`}
//                       //type="button"
//                       //variant="secondary"
//                       // disabled={containerEditMode == "edit" ? false : true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         // setGlobalMessages({...globalMessages, currentState: {...globalMessages.currentState, currentFunction: FunctionName.NEW_LINE}})
//                         await handleLyricFunctionCall(
//                           FunctionName.NEW_LINE,
//                           "line"
//                         );
//                       }}
//                     >
//                       <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger>
//                             <BotIcon size={16} className="text-lime-500" />
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>New Line AI</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider>
//                     </div>
//                     <div
//                       className={`text-xs bg-black/20 w-full h-full p-4 border-[1px] rounded-sm`}
//                       //type="button"
//                       //variant="secondary"
//                       //disabled={containerEditMode == "edit" ? false : true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         const oldState = {
//                           ...globalMessages.currentState,
//                         } as AISessionState;
//                         console.log(
//                           "globalMessages.currentState pre song edit: ",
//                           globalMessages.currentState,
//                           oldState
//                         );
//                         //return
//                         const _song = [
//                           ...globalMessages.currentState.currentSong,
//                         ];
//                         const _block = { ..._song[blockNum] } as BlockLyricType;
//                         _block.text = [
//                           ..._block.text,
//                           createNewLine(
//                             blockNum,
//                             blockLength,
//                             "New Line",
//                             "line"
//                           ),
//                         ];
//                         console.log("NewLine Check: ", _block.text);
//                         console.log(
//                           "NewLine Check2: ",
//                           globalMessages.currentState.currentSong[blockNum].text
//                         );
//                         //return
//                         _song[blockNum] = _block;
//                         console.log(
//                           "History Before _updateClientGlobalMessagesHistory: ",
//                           globalMessages.history
//                         );
//                         console.log(
//                           "globalMessages.currentState: ",
//                           globalMessages.currentState
//                         );
//                         console.log("_song: ", _song);
//                         __updateClientGlobalMessageHistory({
//                           newState: {
//                             ...globalMessages.currentState,
//                             currentSong: [..._song],
//                           },
//                         });
//                       }}
//                     >
//                       <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger>
//                             <PenIcon size={16} className="text-lime-500" />
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>New Line</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider>
//                     </div>
//                   </PopoverContent>
//                 </Popover>
//               </div>
//             )}
//             {/**empty*/}
//             {lineNum == 0 && (
//               <Button
//                 className={`w-full h-full`}
//                 type="button"
//                 variant="outline"
//                 disabled={true}
//                 onClick={async (e) => {
//                   e.preventDefault();
//                   await handleLyricFunctionCall(
//                     FunctionName.REVERSE_LYRICS,
//                     "line"
//                   );
//                 }}
//               >
//                 <Mic2 size={24} className="text-lime-500" />
//               </Button>
//             )}
//             {/**WORDPLAY BLOCKS*/}
//             {lineNum == 0 &&
//               globalMessages.currentState.referenceLyricsBlocks.length > 0 &&
//               containerEditMode == "reference" && (
//                 <TooltipProvider>
//                   <Tooltip>
//                     <TooltipTrigger>
//                       <div
//                         className={`text-xs w-20 h-full flex items-center justify-center bg-white/10 rounded-sm  shadow-sm`}
//                         //type="button"
//                         // variant="outline"
//                         //disabled={containerEditMode == "edit" ? false : true}
//                         onClick={async (e) => {
//                           e.preventDefault();
//                           const stateJSON: string =
//                             await updateReferenceWordPlayBlocks({
//                               lineNumbers: [
//                                 {
//                                   blockNum: blockNum,
//                                   lineNum: -1,
//                                 },
//                               ],
//                               lineOrBlock: "block",
//                               nameOfBlock: text,
//                               state: globalMessages.currentState
//                                 ? globalMessages.currentState
//                                 : [],
//                             } as UpdateReferenceWordPlayBlocksProps);
//                           //console.log("store blockNum result: ", res)
//                           const state = JSON.parse(stateJSON) as AISessionState;
//                           __updateClientGlobalMessageHistory({
//                             newState: state,
//                           });
//                           // setGlobalMessages({
//                           //   history: [...globalMessages.history, state],
//                           //   currentState: state,
//                           //   //history: [...globalMessages.history, state],
//                           // });
//                           console.log(
//                             "store blockNum returned state-refWPBlocks: ",
//                             state
//                           );
//                         }}
//                       >
//                         <GemIcon size={24} className="text-lime-500" />
//                       </div>
//                     </TooltipTrigger>
//                     <TooltipContent>
//                       <p>Store Block</p>
//                     </TooltipContent>
//                   </Tooltip>
//                 </TooltipProvider>
//               )}
//             {/** MULTI-LINE */}
//             {lineNum == 0 &&
//               globalMessages.currentState.curBlockNum == blockNum &&
//               groupSelected &&
//               (containerEditMode == "reference" ? (
//                 <div className="w-full h-full">
//                   <Popover>
//                     <PopoverTrigger className="bg-slate-400/20 rounded-md px-4 w-full h-full p-1">
//                       <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger>
//                             {" "}
//                             <MenuIcon size={24} className="text-blue-500" />
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>Add Multi-Lines</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider>
//                     </PopoverTrigger>
//                     <PopoverContent className="w-fit flex items-center justify-center gap-4">
//                       <Button
//                         className={`text-xs `}
//                         type="button"
//                         variant="outline"
//                         onClick={async (e) => {
//                           e.preventDefault();
//                           console.log(
//                             "containerEditMode: ",
//                             containerEditMode,
//                             blockNum
//                           );
//                           if (containerEditMode == "reference") {
//                             if (addGroupLinesToReference) {
//                               console.log("addGroupLinesToReference");
//                               await addGroupLinesToReference();
//                             }
//                           } else {
//                             console.log("Process Group Lines");
//                             await handleLyricFunctionCall(
//                               globalMessages.currentState.currentFunction,
//                               "multiline"
//                             );
//                           }
//                         }}
//                       >
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger>
//                               <BotIcon
//                                 size={16}
//                                 className={`${
//                                   groupSelected
//                                     ? "text-blue-500"
//                                     : "text-blue-800/10"
//                                 }`}
//                               />
//                             </TooltipTrigger>
//                             <TooltipContent>
//                               <p>New Line AI</p>
//                             </TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </Button>
//                       <Button
//                         className={`text-xs `}
//                         type="button"
//                         variant="outline"
//                         onClick={async (e) => {
//                           e.preventDefault();
//                           console.log(
//                             "containerEditMode-DeleteLines: ",
//                             containerEditMode,
//                             blockNum
//                           );
//                           const confirm = window.confirm(
//                             "Delete selected lines?"
//                           );
//                           if (!confirm) return;
//                           // delete selected group lines from song
//                           const song = globalMessages.currentState.currentSong;
//                           const _block = song[blockNum];
//                           const _selectedLines =
//                             globalMessages.currentState.groupLines;
//                           const _newLines = _block.text.filter(
//                             (_line, _index) => {
//                               return !_selectedLines.some(
//                                 (_selectedLine) =>
//                                   _selectedLine.lineNum == _index
//                               );
//                             }
//                           );
//                           _block.text = _newLines;
//                           song[blockNum] = _block;
//                           __updateClientGlobalMessageHistory({
//                             newState: {
//                               ...globalMessages.currentState,
//                               currentSong: song,
//                               groupLines: [],
//                             },
//                           });
//                         }}
//                       >
//                         <ZapIcon
//                           size={16}
//                           className={`${
//                             groupSelected ? "text-blue-500" : "text-blue-800/10"
//                           }`}
//                         />
//                       </Button>
//                     </PopoverContent>
//                   </Popover>
//                 </div>
//               ) : (
//                 <div>
//                   <Popover>
//                     <PopoverTrigger className="p-2 bg-pink-400/10 bg-blend-color-dodge w-16 hover:bg-lime-500 hover:cursor-pointer rounded-md h-full flex items-center justify-center ">
//                       <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger type="button">
//                             <MenuIcon size={28} className="text-pink-500" />
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>Multi-Line Process</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider>
//                     </PopoverTrigger>
//                     <PopoverContent className="w-fit flex items-center justify-center gap-4">
//                       <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger>
//                             <Button
//                               className="p-4"
//                               variant={"outline"}
//                               type="button"
//                               onClick={async (e) => {
//                                 e.preventDefault();
//                                 console.log(
//                                   "containerEditMode: ",
//                                   containerEditMode,
//                                   blockNum
//                                 );
//                                 await handleLyricFunctionCall(
//                                   globalMessages.currentState.currentFunction,
//                                   "multiline"
//                                 );
//                               }}
//                             >
//                               <BotIcon size={24} className="text-pink-500" />
//                             </Button>
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>AI Process Multiple Lines</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider>
//                       <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger>
//                             <Button
//                               className="p-4"
//                               variant={"outline"}
//                               type="button"
//                               onClick={async (e) => {
//                                 e.preventDefault();
//                                 console.log(
//                                   "containerEditMode: ",
//                                   containerEditMode,
//                                   blockNum
//                                 );
//                                 await handleLyricFunctionCall(
//                                   globalMessages.currentState.currentFunction,
//                                   "multiline"
//                                 );
//                               }}
//                             >
//                               <PencilIcon size={24} className="text-pink-500" />
//                             </Button>
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>Edit Multiple Lines</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider>
//                     </PopoverContent>
//                   </Popover>
//                 </div>
//               ))}
//             {/**FUNCTIONS PANEL*/}
//             {lineNum == 0 && containerEditMode == "edit" && blockLength > 1 && (
//               <Popover>
//                 <PopoverTrigger className="p-1 w-16 col-span-3 bg-indigo-700/30 hover:bg-pink-500/60 group-hover:bg-yellow-400">
//                   FUNC
//                 </PopoverTrigger>
//                 <FunctionPanel
//                   lineContent={text}
//                   handleFunctionSelected={(val: string) => {
//                     setGlobalMessages({
//                       ...globalMessages,
//                       currentState: {
//                         ...globalMessages.currentState,
//                         currentFunction: val,
//                       },
//                     });
//                     //handleLyricFunctionCall(val)
//                   }}
//                 />
//               </Popover>
//             )}
//             {containerEditMode == "reference" && lineNum > 0 && (
//               <div className="w-24 opacity-5">.....</div>
//             )}
//             {containerEditMode == "reference" && lineNum > 0 && (
//               <div className="w-24 opacity-5">.....</div>
//             )}
//             {containerEditMode == "reference" && lineNum > 0 && (
//               <div className="w-24 opacity-5">.....</div>
//             )}
//             {/**VOICE PANEL */}
//             {lineNum > 0 && (
//               <div
//               //className="flex items-center col-span-2 "
//               >
//                 <div>
//                   {/* <PopoverTrigger className="bg-slate-400/20 rounded-md px-4 w-full h-full p-1"> */}
//                   {/* </PopoverTrigger> */}
//                   <div className="w-full h-full flex items-center justify-center gap-4 rounded-md">
//                     <div
//                       className={`text-xs? flex items-center justify-center bg-black/20 w-16 h-16 p-2 cursor-pointer hover:bg-violet-500/30 border-[1px] rounded-sm`}
//                       //type="button"
//                       //variant="secondary"
//                       // disabled={containerEditMode == "edit" ? false : true}
//                       onClick={async (e) => {
//                         e.preventDefault();
//                         setVoicePanelOpen(!voicePanelOpen);
//                         // setGlobalMessages({...globalMessages, currentState: {...globalMessages.currentState, currentFunction: FunctionName.NEW_LINE}})
//                         // await handleLyricFunctionCall(
//                         //   FunctionName.NEW_LINE,
//                         //   "line"
//                         // );
//                       }}
//                     >
//                       <Volume1Icon size={28} className="text-yellow-500" />
//                       {/* <TooltipProvider>
//                         <Tooltip>
//                           <TooltipTrigger>
//                             <BotIcon size={16} className="text-lime-500" />
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>VOICE PANEL</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </TooltipProvider> */}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}
//             {/**START FUNCTION BUTTON */}
//             {globalMessages.currentState.currentFunction &&
//               lineNum > 0 &&
//               containerEditMode == "edit" && (
//                 <BackgroundGradientAnimation
//                   bgEnabled={true}
//                   className="flex items-center justify-center bg-blend-color-dodge"
//                 >
//                   <Button
//                     className={`text-xs flex items-center justify-center mix-blend-screen z-50`}
//                     type="button"
//                     variant="outline"
//                     onClick={() => {
//                       console.log(
//                         "globalMessages.currentState.currentFunction: ",
//                         globalMessages.currentState.currentFunction
//                       );
//                       handleLyricFunctionCall(
//                         globalMessages.currentState.currentFunction,
//                         "line"
//                       );
//                     }}
//                   >
//                     <p className="whitespace-break-spaces align-middle">
//                       {globalMessages.currentState.currentFunction
//                         .replaceAll("-", "")
//                         .replaceAll("wordplay", "")
//                         .slice(0, 30)}
//                     </p>
//                   </Button>
//                 </BackgroundGradientAnimation>
//               )}
//             {/**LINE OPTIONS*/}
//             {lineNum > 0 && (
//               <LineOptions
//                 blockNum={blockNum}
//                 lineNum={lineNum}
//                 text={text}
//                 handleLyricFunctionCall={handleLyricFunctionCall}
//                 __updateClientGlobalMessageHistory={
//                   __updateClientGlobalMessageHistory
//                 }
//                 globalMessages={globalMessages}
//               />
//             )}
//           </form>
//         </div>
//       </div>
//       <Collapsible open={voicePanelOpen}>
//         {/* <CollapsibleTrigger>Can I use this in my project?</CollapsibleTrigger> */}
//         <CollapsibleContent>
//           <div className="w-full  bg-blue-300/5">
//             <VoicePanelContainer lineText={text} />
//             {/* <VoicePanel /> */}
//           </div>
//         </CollapsibleContent>
//       </Collapsible>
//     </div>
//   );
// }
// }

