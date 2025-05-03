import { LineLyricType } from "./types";
import {
  AgentComponentProps,
  AgentVoiceProviderEnum,
  AISessionState,
  AppState,
  ContextContainerProps,
  GlobalMessages,
  ModelArgs,
  ModelProviderEnum,
  UpdateSongProps,
  UpdateStateProps,
} from "./types";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { MistralModelNames } from "@/src/app/api/model/mistral";
import { CohereModelNames } from "@/src/app/api/model/cohere";
import { GoogleGenerativeAIModelNames } from "@/src/app/api/model/google";

export async function getLineAfter(aiState: AISessionState) {
  if (aiState.currentSong[aiState.curBlockNum].text.length < 3) {
    return "";
  }
  return aiState.curBlockNum < aiState.currentSong.length - 1
    ? aiState.currentSong[aiState.curBlockNum].text[aiState.curLineNum + 1]
        ?.text || aiState.currentSong[aiState.curBlockNum].text[1].text
    : aiState.curLineNum < aiState.currentSong[aiState.curBlockNum].length - 2
    ? aiState.currentSong[0].text[aiState.curLineNum + 1].text
    : "Outro...";
}

export async function getLineBefore(aiState: AISessionState) {
  if (aiState.currentSong[aiState.curBlockNum].text.length < 2) {
    return "";
  }
  return aiState.curLineNum == 1 && aiState.curBlockNum > 0
    ? aiState.currentSong[aiState.curBlockNum].text[
        aiState.currentSong[aiState.curLineNum].length - 1
      ].text
    : aiState.curBlockNum > 0
    ? aiState.curLineNum > 1
      ? (aiState.currentSong[aiState.curBlockNum].text[aiState.curLineNum - 1]
          .text as string)
      : aiState.currentSong[aiState.curBlockNum].text[
          aiState.currentSong[aiState.curLineNum].length - 1
        ].text
    : aiState.curLineNum > 1
    ? aiState.currentSong[0].text[aiState.curLineNum - 1].text
    : ("Intro..." as string);
}

export function getBlockStringWithLabel(aiState: AISessionState) {
  if (aiState.currentSong[aiState.curBlockNum].text.length < 2) {
    return "";
  }
  return aiState.currentSong[aiState.curBlockNum].text
    .map((t: LineLyricType) => t.content)
    .join("\n");
}
export function getBlockStringNoLabel(aiState: AISessionState) {
  if (aiState.currentSong[aiState.curBlockNum].text.length < 2) {
    return "";
  }
  return aiState.currentSong[aiState.curBlockNum].text
    .filter((lineLyric1, index) => {
      console.log("lineLyric1 index: ", index);
      return index !== 0;
    })
    .map((lineLyric, index) => lineLyric.text)
    .join("\n") as string;
}

export function getSongString(aiState: AISessionState) {
  if (aiState.currentSong[aiState.curBlockNum].text.length < 2) {
    return "";
  }
  return aiState.currentSong
    .map((block) => block.text.map((line) => line.text).join("\n"))
    .join("\n\n");
}

export function createNewLine(
  blockNum: number,
  lineNum: number,
  text: string,
  type: "label" | "line"
) {
  return {
    blockNum,
    lineNum,
    text,
    type,
    content: text,
    id: `${blockNum}-${lineNum}`,
  } as LineLyricType;
}

export function createNewBlock(
  blockNum: number,
  blockName: string,
  text: LineLyricType[]
) {
  return {
    blockNum,
    name: blockName,
    text,
  } as BlockLyricType;
}

export function removeLineFromBlock(
  block: BlockLyricType,
  lineNum: number
): BlockLyricType {
  console.log("lyric-helpers-RemoveLineFromBlock Called: ", block, lineNum);
  return {
    ...block,
    length: block.text.length - 1,
    text: block.text
      .filter((line, index) => index !== lineNum)
      .map((line, index) => {
        return {
          ...line,
          lineNum: index,
        };
      }),
  };
}
export function removeBlockFromList(
  song: BlockLyricType[],
  blockNum: number
): BlockLyricType[] {
  return song
    .filter((block, i) => i !== blockNum)
    .map((block, index) => {
      return {
        ...block,
        blockNum: index + 1,
      };
    });
}

export function clearLinesFromBlock(song: BlockLyricType[], blockNum: number) {
  // retrun new song with empty block
  return song.map((block, index) => {
    if (index === blockNum) {
      return {
        text: [createNewLine(blockNum, 0, block.text[0].text, "label")],
      } as BlockLyricType;
    }
    return block;
  });
}

export function insertBlockToList(
  song: BlockLyricType[],
  textForFirstLine: string,
  insertAfter: number
): BlockLyricType[] {
  return song
    .filter((block, i) => i < insertAfter + 1)
    .concat([
      createNewBlock(insertAfter + 1, `Block${insertAfter + 2}`, [
        createNewLine(insertAfter + 1, 0, `Block${insertAfter + 2}`, "label"),
        createNewLine(insertAfter + 2, 1, textForFirstLine, "line"),
      ]),
    ])
    .concat(
      song
        .filter((block, i) => i >= insertAfter + 1)
        .map((block, index) => {
          return {
            ...block,
            blockNum: index + insertAfter,
          };
        })
    );
}

export function insertBlockToSong(
  song: BlockLyricType[],
  block: BlockLyricType,
  insertAfter: number
) {
  return song
    .filter((block, i) => i < insertAfter + 1)
    .concat([block])
    .concat(
      song
        .filter((block, i) => i >= insertAfter + 1)
        .map((block, index) => {
          return {
            ...block,
            blockNum: index + insertAfter,
          };
        })
    );
}

export function createNewBlockFromValues(
  values: UpdateSongProps,
  blockName: string,
  labelName: string
) {
  return createNewBlock(values.values.length, blockName, [
    {
      content: labelName,
      id: `${0}-${0}`,
      
    },
    ...values.values
      .filter((line, index) => line.text !== "")
      .map((line, index) => {
        return {
          content: line.text,
          id: `${0}-${index + 1}`,
          blockLength: values.values.length,
        } as LineLyricType;
      }),
  ]);
}
export function insertLineToBlock(
  block: BlockLyricType,
  text: string,
  insertionPoint: number
) {
  const linesBeforeInsertion = block.text.filter(
    (line, index) => index < insertionPoint
  );
  const linesAfterInsertion = block.text.filter(
    (line, index) => index >= insertionPoint
  );
  return {
    ...block,
    text: linesBeforeInsertion
      .concat([createNewLine(block.blockNum, insertionPoint, text, "line")])
      .concat(linesAfterInsertion),
  } as BlockLyricType;
}

export function createNewBlockWithLabel(blockNum: number, blockName: string) {
  return {
    blockNum,
    name: blockName,
    text: [createNewLine(blockNum, 0, blockName, "label")],
  } as BlockLyricType;
}

export function shiftBlock(
  upOrDown: "up" | "down",
  song: BlockLyricType[],
  blockNum: number
) {
  const blockToMove = song[blockNum];
  if (upOrDown === "up") {
    if (blockNum === 0) {
      return song;
    }
    const switcher = song[blockNum - 1];
    const update = song;
    update[blockNum] = switcher;
    update[blockNum - 1] = blockToMove;
    return song.map((block, index) => {
      return {
        ...block,
        blockNum: index,
      };
    });
  } else {
    if (blockNum === song.length - 1) {
      return song;
    }
    return song
      .filter((block, i) => i !== blockNum)
      .slice(0, blockNum + 1)
      .concat([blockToMove])
      .concat(song.filter((block, i) => i > blockNum + 1))
      .map((block, index) => {
        return {
          ...block,
          blockNum: index,
        };
      });
  }
}

export function reAlignLineNumbers(block: BlockLyricType) {
  return block.text.map((line, index) => {
    return {
      ...line,
      lineNum: index,
    };
  });
}

export function copySong(song: BlockLyricType[]) {
  return song.map((block) => {
    return {
      ...block,
      text: block.text.map((line) => {
        return {
          ...line,
        };
      }),
    };
  }) as BlockLyricType[];
}

export function __newSong(globalMessages: GlobalMessages) {
  return {
    ...globalMessages,
    currentState: {
      ...globalMessages.currentState,
      currentSong: [createNewBlockWithLabel(0, "Intro...")],
    },
  };
}

export function __updateAIState(
  globalMessages: GlobalMessages,
  stateValuesToChange: UpdateStateProps
) {
  //   console.log("__updateAIState-stateValuesToChange: ", stateValuesToChange);
  //   console.log("__updateAIState: ", {
  //     history: [...globalMessages.history, globalMessages.currentState],
  //     currentState: { ...globalMessages.currentState, ...stateValuesToChange },
  //   });
  return {
    //history: [...globalMessages.history, globalMessages.currentState],
    history: globalMessages.history,
    currentState: { ...globalMessages.currentState, ...stateValuesToChange },
  };
}
//TODO: Put this in a better place
export function __initAppState() {
  return {
    top100Songs: [],
    selectedArtists: [],
    _streamData: "",
    currentUser: {},
    customFunctions: [],
    customModifiers: [],
    dialogOpen: false,
    dilemma: "",
    foundAlbums: [],
    foundArtists: [],
    foundHits: [],
    foundSongs: [],
    mySongs: [],
    loading: false,
    modalChoices: [],
    modalOpen: false,
    researchSetLinks: [],
    ui: {},
    wordPlayFunctions: [],
    loadingText: "One Moment...",
    lineAsides: [],
  } as AppState;
}
//TODO: Put this in a better place
export function __initAIState() {
  return {
    history: [],
    currentState: {
      content: "",
      currentFunction: "",
      role: "user",
      processType: "line",
      lastFunction: "",
      currentSong: [],
      curBlockNum: 0,
      curLineNum: 0,
      currentTryCount: 0,
      customRequests: [],
      customRequestModifiers: [],
      finalResponse: "",
      blockString: "",
      currentSeedLine: "",
      newSeeds: false,
      referencewordPlayString: "",
      songString: "",
      groupLines: [],
      contextSet: {sets: [] as ContextContainerProps[], teamName: "Default Team"},
      //lineSets: [],
      currentModels: [
        {
          provider: ModelProviderEnum.OPENAI,
          modelName: "gpt-4o-mini",
          temperature: 0.7,
        },
      ],
      // currentAgents: [
      // {
      //   name: "Kirk",
      //   type: "manager",
      //   title: "Captain",
      //   modelArgs: {

      //     provider: ModelProviderEnum.OPENAI,
      //     modelName: "gpt-4o-mini",
      //     temperature: 0.7,
      //   } ,
      //   systemPrompt: "You are the captain of the starship Enterprise. You are responsible for the safety and well-being of the crew and the ship. You are also responsible for the success of the mission.",
      //   promptDirectives: [],
      //   listSets: [],
      //   messages: [],
      //   roleDescription: "manages the conversation and ensures it stays on track.",
      // } as AgentComponentProps,
      // {
      //   name: "Spock",
      //   type: "analyst",
      //   title: "First Officer",
      //   modelArgs: {
      //     provider: ModelProviderEnum.OPENAI,
      //     modelName: "gpt-4o-mini",
      //     temperature: 0.2,
      //   } ,
      //   systemPrompt: "You are the first officer of the starship Enterprise. You are responsible for the safety and well-being of the crew and the ship. You are also responsible for the success of the mission.",
      //   promptDirectives: [],
      //   listSets: [],
      //   messages: [],
      //   roleDescription: "analyzes the conversation and provides insights.",
      // } as AgentComponentProps,
      // {
      //   name: "Bones",
      //   type: "researcher",
      //   title: "Chief Medical Officer",
      //   modelArgs: {
      //     provider: ModelProviderEnum.MISTRAL,
      //     modelName: MistralModelNames["mistral-medium-latest"],
      //     temperature: 0,
      //   } ,
      //   systemPrompt: "You are the chief medical officer of the starship Enterprise. You are responsible for the safety and well-being of the crew and the ship. You are also responsible for the success of the mission.",
      //   promptDirectives: [],
      //   listSets: [],
      //   messages: [],
      //   roleDescription: "handles all research requests.",
      // } as AgentComponentProps,
      // {
      //   name: "Scotty",
      //   type: "tool-operator",
      //   title: "Chief Engineer",
      //   modelArgs: {
      //     provider: ModelProviderEnum.ANTHROPIC,
      //     modelName: AnthropicModelNames["claude-3-5-sonnet-20240620"],
      //     temperature: 0.5,
      //   } ,
      //   systemPrompt: "You are the chief engineer of the starship Enterprise. You handle any and all technical requests.",
      //   promptDirectives: [],
      //   listSets: [],
      //   messages: [],
      //   roleDescription: "handles any tool requests.",
      // } as AgentComponentProps,
      // ]
      currentAgents: {
        name: "First Team",
        objectives: "We need to get this agentic LLM Framework up and running like NOW!",
        agents: [
          {
            name: "AG1",
            type: "tool-operator",
            title: "assistant developer",
            modelArgs: {
              provider: ModelProviderEnum.OPENAI,
              modelName: "gpt-4o-mini",
              temperature: 0.7,
            },
            systemPrompt:
              "Right now we are testing the agent_tool communication tool. You should be able to access the tool and communicated with your peer agents.",
            promptDirectives: [],
            listSets: [
              {
                setName: "test",
                text: "WELCOMET TO LYRICAL ANALYSIS AGENT FRAMEWORK!",
                lines: [],
                isDisabled: false,
              },
            ],
            messages: [],
            roleDescription: "Assistant AI developer",
            tools: [],
            voice: {
              provider: AgentVoiceProviderEnum.ELEVEN_LABS,
              nameOrVoiceID: "Bella",
            }
          } as AgentComponentProps,
          {
            name: "Candy",
            type: "agent",
            title: "Comedian",
            modelArgs: {
              provider: ModelProviderEnum.OPENAI,
              modelName: "gpt-4o-mini",
              temperature: 0.7,
            },
            systemPrompt:
              "You are an up and coming female comedian who thinks everything is funny.",
            promptDirectives: [],
            listSets: [],
            messages: [],
            roleDescription: "Young Female Comedian",
            tools: [],
            voice: {
              provider: AgentVoiceProviderEnum.ELEVEN_LABS,
              nameOrVoiceID: "Bella",
            }
          } as AgentComponentProps,
          {
            name: "Luke",
            type: "agent",
            title: "assistant developer",
            modelArgs: {
              provider: ModelProviderEnum.OPENAI,
              modelName: "gpt-4o-mini",
              temperature: 0.7,
            },
            systemPrompt:
              `Right now we are testing the agent_tool communication tool. You should be able to access the tool and communicated with your peer agents. The magic word is "TEEPEE"`,
            promptDirectives: [],
            listSets: [],
            messages: [],
            roleDescription: "Assistant AI developer",
            tools: [],
            voice: {
              provider: AgentVoiceProviderEnum.ELEVEN_LABS,
              nameOrVoiceID: "Bella",
            }
          }
        ],
      },

      //contextSets: [],
      lineString: "",
      lineStringAfter: "",
      lineStringBefore: "",
      numOptions: 0,
      previousData: { options: [], data: {} },
      referenceLyricString: "",
      referenceWordPlayString: "",
      resultData: { options: [], data: {} },
      rules: [],
      songId: 0,
      songName: "",
      userId: "",
      useCustomRequests: false,
      referenceLyricsBlocks: [],
      referenceWordPlayBlocks: [],
      genericData: {
        continueLastSession: true,
        INIT_DONE: 0,
        teamObjectives: "We are trying to find a number larger than 6,438",
        autoPromptModel: {
          provider: ModelProviderEnum.ANTHROPIC,
          modelName: AnthropicModelNames["claude-3-5-sonnet-20240620"],
          temperature: 0.5,
          appFrozenState: null
        },
        autoPromptExtraInfo: "",
      },
    } as AISessionState,
  };
}
