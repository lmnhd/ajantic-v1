import React, { useState } from "react";
import BlockLyric, { BlockLyricType } from "./block";
import { __updateStreamData } from "./line";
import { AISessionState, LineNumbersProps } from "@/src/lib/types";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import {
  updateReferenceWordPlayBlocks,
  UpdateReferenceWordPlayBlocksProps,
} from "@/app/(main)/dashboard/editoractions/wordplays";
import SongTitlePopover from "./songtitlepopover";
import { __storeHistoryFromClient } from "@/src/lib/server-actions";
import { handleProcessLineOrGroup } from "@/src/lib/server-actions";

export type LyricContainerProps = {
  text: BlockLyricType[];
  songName: string;
  mode: "edit" | "reference";
};

export default function LyricContainer({
  text,
  songName,
  mode,
}: LyricContainerProps) {
  const { setGlobalMessages, appState, globalMessages } = useGlobalStore();

  const addSingleLineToWPReferences = async (
    block: number,
    line: number,
    nameOfBlock: string
  ) => {
    const state: AISessionState = JSON.parse(
      await updateReferenceWordPlayBlocks({
        lineNumbers: [{ blockNum: block, lineNum: line }],
        lineOrBlock: "line",
        nameOfBlock,
        state: globalMessages.currentState,
      } as UpdateReferenceWordPlayBlocksProps)
    );
    console.log("state: ", state);
    setGlobalMessages({
      ...globalMessages,
      currentState: {
        ...globalMessages.currentState,
        referenceWordPlayBlocks: state.referenceWordPlayBlocks,
      },
    });
  };
  const handleGroupLineSelected = (
    lineNum: number,
    block: number,
    selected: boolean,
    mode: "edit" | "reference"
  ) => {
    console.log(
      "handleGroupSelection called on lyric-container: ",
      block,
      lineNum,
      selected
    );
    console.log(
      "mode: ",
      mode,
      "Block: ",
      block,
      "line: ",
      lineNum,
      "selected: ",
      selected
    );

    setGlobalMessages({
      ...globalMessages,
      currentState: { ...globalMessages.currentState, curBlockNum: block },
    });
    let _lines = [...globalMessages.currentState.groupLines];
    let lineFound = false;
    for (const line of _lines) {
      // editmode only allow selecting lines within the same block
      if (mode === "edit") {
        _lines = _lines.filter((l) => l.blockNum == block);
      }

      if (line.blockNum === block && line.lineNum === lineNum) {
        // remove line
        console.log("lines length before splice: ", _lines.length);
        _lines.splice(_lines.indexOf(line), 1);
        console.log("lines length after splice: ", _lines.length);
        lineFound = true;

        continue;
      }
    }
    if (lineFound) {
      const _state = globalMessages.currentState;
      console.log("__updateAIState: ", _state);
      setGlobalMessages({
        ...globalMessages,
        currentState: _state
      });
      //return;
    } else {
      _lines.push({ lineNum: lineNum, blockNum: block });
      const _state = {
        ...globalMessages.currentState,
        groupLines: _lines,
        curBlockNum: block,
      };
      console.log("__updateAIState: ", _state);
      setGlobalMessages({
        ...globalMessages,
        currentState: _state,
      });
    }

    console.log("selectedLines: ", globalMessages.currentState.groupLines);
  };

  async function handleAddBlockToReference(blockNum: number) {
    const state: AISessionState = JSON.parse(
      await updateReferenceWordPlayBlocks({
        lineNumbers: [{ blockNum: blockNum, lineNum: 0 }],
        lineOrBlock: "block",
        nameOfBlock: "",
        state: globalMessages.currentState,
      } as UpdateReferenceWordPlayBlocksProps)
    );
    console.log("state: ", state);
    const _state = state;
    console.log("__updateAIState: ", _state);
    setGlobalMessages({ ...globalMessages, currentState: _state });
  }

  return (
    <div>
      {/* <h2>{globalMessages.currentState.songName.replace(titleRegEx,'')}</h2> */}
      <SongTitlePopover
        songName={songName}
        handleProcessLineOrGroup={handleProcessLineOrGroup}
        __updateStreamData={__updateStreamData}
        __storeHistoryFromClient={__storeHistoryFromClient}
      />

      <div className="flex flex-col w-full p-2">
        {text &&
          text.map((block, index) => (
            <BlockLyric
              editMode={mode}
              blockNum={index}
              key={index}
              text={block.text}
              length={block.length}
              name={block.name}
              customFunctions={appState.customFunctions}
              addSingleLineToWPReferences={async (index, line) => {
                const response = await addSingleLineToWPReferences(
                  index,
                  line,
                  `${songName}`
                );
              }}
              handleAddBlockToReference={handleAddBlockToReference}
              handleGroupSelection={(block, lineNum, selected) => {
                handleGroupLineSelected(block, lineNum, selected, mode);
              }}
              addGroupLinesToReference={async () => {
                console.log(
                  "addGroupLinesToReference called on lyric-container: ",
                  globalMessages.currentState.groupLines
                );
                const response = await updateReferenceWordPlayBlocks({
                  lineNumbers: globalMessages.currentState.groupLines.map(
                    (line) => {
                      return {
                        blockNum: line.blockNum,
                        lineNum: line.lineNum,
                      } as LineNumbersProps;
                    }
                  ),
                  lineOrBlock: "line",
                  nameOfBlock: `${songName}`,
                  state: globalMessages.currentState,
                });
                const newState: AISessionState = JSON.parse(response);
                setGlobalMessages({
                  ...globalMessages,
                  currentState: { ...newState, groupLines: [] },
                });

                console.log("Group of lines added to reference...", newState);
              }}
              groupSelected={globalMessages.currentState.groupLines.length > 2}
              selectedLines={globalMessages.currentState.groupLines}
            />
          ))}
      </div>
    </div>
  );
}
//await updateReferenceWordPlayBlocks({[block, line}])
