"use server";

import { db } from "./db";
import {
  AgentComponentProps,
  HookExample,
  ModelArgs,
  ModelProviderEnum,
  ModelProviderSelectName,
  ResearchSong,
  WordPlay,
} from "./types";
import { GeneralPurpose } from "@prisma/client";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { LineLyricType } from "@/components/songeditor/lyric/line";

import { BlockarizeText } from "@/src/app/api/blockarize";
import { PINECONE_storeData, PINECONE_search } from "@/src/app/api/pinecone";
import { generateNameFromPrompt } from "@/src/app/api/name-prompt";
import {
  FORMAT_generateFormattedPrompt,
  PROMPTTOOLS_nameAndFormatPrompt,
} from "@/src/app/api/format-prompt";
import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { UTILS_getTodayDateString } from "./utils";
import { DYNAMIC_MODEL_NAMES } from "@/src/app/api/model/dynamic-model-names";

export const SERVER_getLotsOfDilemmas = async () => {
  // const allDilemmas: SummaryTemplate[] = await db.summaryTemplates.findMany({
  //   where: {
  //     name: {
  //       contains: " ",
  //     },
  //   },
  //   select: {
  //     name: true,
  //   },
  // });
  return ""
};

export async function SERVER_isSongInDatabase(title: string, artist: string) {
  const song = await db.researchSong.findFirst({
    where: {
      title,
      artist,
    },
    select: {
      title: true,
      artist: true,
    },
  });
  if (song) {
    if (song.artist == artist) {
      return true;
    }
    return false;
  } else {
    return false;
  }
}

export const SERVER_capitalizeFirstLetter = async (string: string) => {
  return string
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export async function SERVER_IsDevelopment() {
  return process.env.NODE_ENV === "development";
}
export async function SERVER_easyGetResearchSongs(
  artist: string,
  count: number
) {
  console.log("SERVER_easyGetResearchSongs: ", artist);
  const songListArr: ResearchSong[] = [];
  const existingSongs = await db.researchSong.findMany({
    where: {
      artist: {
        equals: artist,
      },
    },
    select: {
      title: true,
      artist: true,
      lyrics: true,
      summary: true,
      chorus: true,
      img: true,
      wordplays: true,
    },
    take: count,
  });
  // console.log("existingSongs: ", existingSongs[0]);
  // return existingSongs;

  if (existingSongs && existingSongs.length > 0) {
    console.log(
      `Found ${existingSongs.length} existing songs for ${artist} in database...`
    );
    // Load all wordplays
    for (const song of existingSongs) {
      const wpArray: WordPlay[] = [];
      let newSong: ResearchSong = {
        title: song.title,
        artist: song.artist,
        lyrics: song.lyrics,
        summary: song.summary,
        chorus: song.chorus,
        img: song.img,
        wordplays: [],
      };
      for (const wp of song.wordplays) {
        wpArray.push(
          (await db.wordplay.findUnique({
            where: {
              id: wp,
            },
            select: {
              id: true,
              name: true,
              description: true,
              example: true,
            },
          })) as WordPlay
        );
      }
      newSong.wordplays = wpArray;
      songListArr.push(newSong);
    }
  }
  return songListArr;
}
export async function SERVER_easyGetResearchSongSingle(
  artist: string,
  title: string
) {
  const song = await db.researchSong.findFirst({
    where: {
      title,
      artist: await SERVER_capitalizeFirstLetter(artist),
    },
    select: {
      title: true,
      artist: true,
      lyrics: true,
      summary: true,
      chorus: true,
      img: true,
      wordplays: true,
    },
  });
  if (song) {
    const wpArray: WordPlay[] = [];
    for (const wp of song.wordplays) {
      wpArray.push(
        (await db.wordplay.findUnique({
          where: {
            id: wp,
          },
          select: {
            id: true,
            name: true,
            description: true,
            example: true,
          },
        })) as WordPlay
      );
    }
    const newSong: ResearchSong = {
      title: song.title,
      artist: song.artist,
      lyrics: song.lyrics,
      summary: song.summary,
      chorus: song.chorus,
      img: song.img,
      wordplays: wpArray,
    };
    return newSong;
  }
}

export async function SERVER_getMySongs(artist: string) {
  let mySongs: any[] = [];
  try {
    mySongs = await db.aILyrics.findMany({
      where: {
        artist: {
          equals: artist,
        },
      },
      select: {
        title: true,
        artist: true,
        lyrics: true,
        inspirations: true,
        userId: true,
        blockarized: true,
        id: true,
      },
    });
    for (const song of mySongs) {
      if (!song.blockarized) {
        const _: any = await BlockarizeText(song.lyrics, []);
        song.blockarized = _!;
        await db.aILyrics.update({
          where: {
            id: song.id,
          },
          data: {
            blockarized: _!,
          },
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
  return mySongs;
}

export async function SERVER_storeGeneralPurposeData(
  content: string,
  meta1: string,
  meta2: string,
  meta3: string,
  name: string,
  multiples?: boolean
) {
  try {
    // check if backup exists
    const query = await db.generalPurpose.findFirst({
      where: {
        name: name,
      },
      select: {
        content: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        id: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (query && !multiples) {
      await db.generalPurpose.update({
        where: {
          id: query.id,
        },
        data: {
          content:
            typeof content === "string" ? content : JSON.stringify(content),
          meta1: meta1,
          meta2: meta2,
          meta3: meta3,
        },
      });
    } else {
      await db.generalPurpose.create({
        data: {
          name: name,
          content:
            typeof content === "string" ? content : JSON.stringify(content),
          meta1: meta1,
          meta2: meta2,
          meta3: meta3,
        },
      });
    }
  } catch (error) {
    console.log(error);
  }
}
export async function SERVER_getGeneralPurposeDataSingle(
  name: string,
  meta1?: string,
  meta2?: string,
  meta3?: string
) {
  let result: GeneralPurpose | undefined = {
    content: "",
    meta1: "",
    meta2: "",
    meta3: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "",
    id: 0,
  };
  try {
    const params =
      meta1 && meta2 && meta3
        ? {
            name: name,
            meta1: meta1,
            meta2: meta2,
            meta3: meta3,
          }
        : meta1 && meta2
        ? {
            name: name,
            meta1: meta1,
            meta2: meta2,
          }
        : meta1
        ? {
            name: name,
            meta1: meta1,
          }
        : {
            name: name,
          };
    result = (await db.generalPurpose.findFirst({
      where: params,
      select: {
        content: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        id: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })) as GeneralPurpose;
  } catch (error) {
    console.log(error);
  }
  return result;
}

export async function SERVER_getGeneralPurposeDataSingleById(id: number) {
  const result = await db.generalPurpose.findUnique({
    where: { id: id },
  });
  return result;
}

export async function SERVER_getGeneralPurposeDataMany(
  name: string,
  meta1?: string,
  meta2?: string,
  meta3?: string,
  count?: number
) {
  let result: GeneralPurpose[] = [];
  try {
    const params =
      meta1 && meta2 && meta3
        ? {
            name: name,
            meta1: meta1,
            meta2: meta2,
            meta3: meta3,
          }
        : meta1 && meta2
        ? {
            name: name,
            meta1: meta1,
            meta2: meta2,
          }
        : meta1
        ? {
            name: name,
            meta1: meta1,
          }
        : {
            name: name,
          };
    result = await db.generalPurpose.findMany({
      where: params,
      select: {
        content: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        id: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: count || 10000,
    });
  } catch (error) {
    console.log(error);
  }
  return result;
}

// Get last nth stored general purpose data of a particular name
export async function SERVER_getLastGeneralPurposeDataMany(
  name: string,
  count: number
) {
  let result: GeneralPurpose[] = [];
  try {
    result = await db.generalPurpose.findMany({
      where: {
        name: name,
      },
      select: {
        content: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        id: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: count,
    });
  } catch (error) {
    console.log(error);
  }
  return result;
}
export async function SERVER_getLast5GeneralPurposeDataMany(
  name: string,
  meta1?: string,
  meta2?: string,
  meta3?: string
) {
  let result: GeneralPurpose[] = [];
  try {
    const params =
      meta1 && meta2 && meta3
        ? {
            name: name,
            meta1: meta1,
            meta2: meta2,
            meta3: meta3,
          }
        : meta1 && meta2
        ? {
            name: name,
            meta1: meta1,
            meta2: meta2,
          }
        : meta1
        ? {
            name: name,
            meta1: meta1,
          }
        : {
            name: name,
          };
    result = await db.generalPurpose.findMany({
      where: params,
      select: {
        content: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        id: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  } catch (error) {
    console.log(error);
  }
  return result;
}

export async function SERVER_deleteGeneralPurposeData(id: number) {
  try {
    await db.generalPurpose.delete({
      where: {
        id: id,
      },
    });
  } catch (error) {
    console.log(error);
  }
}

export async function SERVER_generalPurposeDeleteAll(name: string) {
  try {
    await db.generalPurpose.deleteMany({
      where: {
        name: name,
      },
    });
  } catch (error) {
    console.log(error);
  }
}

export async function SERVER_getSeedReference(
  refLyrics: BlockLyricType[],
  refWordplays: BlockLyricType[],
  referenceLineItemCount?: number
) {
  const refLyricsArr: string[] = [];

  // for (const block of refLyrics) {
  //   for (const line of block.text) {
  //     if (line.type == "line") {
  //       refLyricsArr.push(line.text);
  //     }
  //   }
  // }
  for (const block of refWordplays) {
    for (const line of block.text) {
      if (line.type == "line") {
        refLyricsArr.push(line.text);
      }
    }
  }
  if (refLyricsArr.length > 0 && referenceLineItemCount != undefined) {
    return {
      value:
        refLyricsArr[
          referenceLineItemCount > refLyricsArr.length
            ? 0
            : referenceLineItemCount
        ],
      referenceLineItemCount: referenceLineItemCount + 1,
    };
  } else {
    return {
      value: refLyricsArr[Math.floor(Math.random() * refLyricsArr.length)],
      referenceLineItemCount: 0,
    };
  }
}
export async function SERVER_getSeedLine() {
  // Get random line from blockarized text
  try {
    const blockarized = await SERVER_getGeneralPurposeDataMany(
      "BlockarizeResearchObject"
    );
    let random = Math.floor(Math.random() * blockarized.length);
    const blocks: any = JSON.parse(blockarized[random].content);
    random = Math.floor(Math.random() * blocks.length);
    const lines: any[] = blocks[random].text.filter(
      (x: any) => x.type == "line" && x.text.length > 20
    );
    random = Math.floor(Math.random() * lines.length);
    const result = lines[random]
      ? lines[random].text
      : (lines[1].text as string);
    console.log(result);

    return result;
  } catch (error) {
    console.error(error);
    return "";
    // Handle the error here
  }
  //return blocks[random].text.filter((x) => x.lineNum > 0)[Math.floor(Math.random() * blocks[random].text.length)].text;
}

export async function SERVER_getRandomLines(numLines: number) {
  // Get random line from blockarized text
  try {
    const songs = await SERVER_getGeneralPurposeDataMany(
      "BlockarizeResearchObject"
    );
    const result: LineLyricType[] = [];

    for (let i = 0; i < numLines; i++) {
      let random = Math.floor(Math.random() * songs.length);
      const song = JSON.parse(songs[random].content) as BlockLyricType[];
      //console.log("Song: ", song);
      const lines = song
        .map((x) => x.text)
        .flat()
        .filter((x) => x.type == "line" && x.text.length > 20);

      //console.log("Lines after flat/filter: ", lines);

      random = Math.floor(Math.random() * lines.length);
      result.push(lines[random]);
    }
    for (const line of result) {
      console.log("Line: ", line.text);
      // const _checkIfExists = await PINECONE_search(line.text, "RandomLines", {
      //   name: "RandomLines",
      //       description: "Random lines from blockarized songs",
      //       user: "system",
      //       line: line.text
      // }, 1);
      const _checkIfExists = await db.generalPurpose.findFirst({
        where: {
          name: "RandomLines",
          meta2: line.text,
        },
        select: {
          id: true,
        },
      });

      if (!_checkIfExists) {
        console.log("Line does not exist in Pinecone: ");
        await PINECONE_storeData({
          toStore: [line.text],
          metadata: {
            name: "RandomLines",
            description: "Random lines from blockarized songs",
            user: "system",
            line: line.text,
          },
          namespace: "RandomLines",
        });
        console.log("Upserted line to Pinecone: ", line.text);
        try {
          await db.generalPurpose.create({
            data: {
              name: "RandomLines",
              content: line.text,
              meta1: "RandomLines",
              meta2: line.text,
              meta3: "system",
            },
          });
        } catch (error) {
          console.error("Error creating general purpose record:", error);
        }
      } else {
        console.log("Line already exists in Pinecone: ", _checkIfExists);
      }
    }

    return result;
  } catch (error) {
    console.error(error);
    return [];
    // Handle the error here
  }
  //return blocks[random].text.filter((x) => x.lineNum > 0)[Math.floor(Math.random() * blocks[random].text.length)].text;
}

export async function SERVER_getHookExamples(
  numResults: number
): Promise<HookExample[]> {
  console.log("Getting hook examples...");
  // pull random songs from blockarized hits and return an array of HookExample objects
  let songs = await SERVER_getGeneralPurposeDataMany(
    "BlockarizeResearchObject"
  );
  console.log("SERVER_getHookExamples: ", songs.length);
  // shuffle array and splice down to numResults
  songs.sort(() => Math.random() - 0.5);
  //console.log('SERVER_getHookExamples Sorted Randomized Songs: ', songs.splice(0, numResults));

  //return []
  let rnd = Math.floor(Math.random() * songs.length);
  console.log("Random start index: ", rnd, numResults);
  // in case random start doensn't allow room to splice all numResults
  try {
    songs = songs.splice(rnd, numResults);
    console.log(
      "Spliced songs: ",
      songs.map((song) => song.meta2)
    );
  } catch (e) {
    console.log("Error splicing songs for hook examples: ", e);
    console.log("returning items from index 0...");
    songs = songs.splice(0, numResults);
  }
  //console.log("Songs: ", songs);
  const result: HookExample[] = [];

  //let i = 0;
  for (let i = 0; i < songs.length; i++) {
    const song = JSON.parse(songs[i].content) as BlockLyricType[];
    if (!song || song.length < 3) {
      continue;
    }
    const name = songs[i].meta2;
    const snippet = song[0].text
      .concat(song[1].text || [])
      .concat(song[2].text || [])
      .map((line, index) => {
        return line.text;
      })
      .join("\n");
    result.push({ name: name, songBlock: snippet });
  }
  //console.log("Hook Examples: ", result);
  return result;
}

export async function SERVER_checkAutoSaveTimeStampInterval(
  userId: string,
  intervalMinutes: number
) {
  console.log("Checking autosave interval...");
  // First check if last autosave is older than interval in minutes
  const lastAutoSave = await SERVER_getGeneralPurposeDataSingle(
    "AutoSave",
    userId
  );
  if (!lastAutoSave) {
    console.log("Auto saving first time...");
    await SERVER_storeGeneralPurposeData(
      "AutoSave",
      userId,
      "",
      "",
      "AutoSave",
      false
    );

    return true;
  }
  const now = new Date();
  const lastSave = new Date(lastAutoSave.updatedAt);
  const diff = now.getTime() - lastSave.getTime();
  const diffMinutes = Math.floor(diff / 60000);
  console.log("Diff minutes: ", diffMinutes);

  // If older, then autosave and update timestamp
  console.log("Auto Save Diff minutes = ", diffMinutes);
  if (diffMinutes > intervalMinutes) {
    console.log("Auto saving...");
    await SERVER_storeGeneralPurposeData(
      "AutoSave",
      userId,
      "",
      "",
      "AutoSave",
      false
    );

    return true;
  }
  return false;
}

export async function SERVER_saveAsPrompt(
  text: string,
  name: string,
  userId: string
) {
  // Store prompt text in GeneralPurpose table
  console.log("Saving as prompt: ", "name:", name, "text:", text);
  //return
  const dbName = "QuickPrompt-" + userId;

  if (name.startsWith("Auto-Named-Prompt")) {
    console.log("Generating name from prompt: ", text);
    name = await generateNameFromPrompt(text);
    console.log("Auto-Named Prompt: ", name);
  } else {
    console.log("User-Named Prompt: ", name);
  }

  const formattedPrompt = await FORMAT_generateFormattedPrompt(text);

  console.log("Formatted Prompt: ", formattedPrompt);
  await SERVER_storeGeneralPurposeData(
    formattedPrompt,
    name,
    userId,
    "",
    dbName,
    true
  );

  return { name: name, formattedPrompt: formattedPrompt };
}
export async function SERVER_savePromptDirectives(
  text: string,
  userId: string,
  modelArgs?: ModelArgs
) {
  const args: ModelArgs = modelArgs || {
    modelName: AnthropicModelNames["claude-3-haiku-20240307"],
    provider: ModelProviderEnum.ANTHROPIC,
    temperature: 0.5,
  };

  const formattedPrompt = await PROMPTTOOLS_nameAndFormatPrompt(
    text,
    args,
    userId
  );
  console.log("Formatted Prompt: ", formattedPrompt);

  return formattedPrompt;
}

export async function SERVER_getPromptDirectives(userId: string) {
  const dbName = `PromptDirective_${userId}`;
  const directives = await SERVER_getGeneralPurposeDataMany(dbName);
  return directives;
}

export async function SERVER_getQuickPrompts(userId: string) {
  const dbName = "QuickPrompt-" + userId;
  const prompts = await SERVER_getGeneralPurposeDataMany(dbName);
  return prompts;
}
// export async function SERVER_saveAgentState(agentState: any, agentIndex: number, userId: string) {
//   const dbName = `AgentState_${agentIndex}_${userId}`
//   const agentStateString = JSON.stringify(agentState);
//   await SERVER_storeGeneralPurposeData(agentStateString, agentIndex.toString(), userId, "", dbName, true);
// }
// export async function SERVER_getLastAgentState(agentIndex: number, userId: string) {
//   const dbName = `AgentState_${agentIndex}_${userId}`
//   const agentState = await SERVER_getGeneralPurposeDataSingle(dbName);
//   return agentState;
// }

export async function SERVER_getAPIKey(keyName: string) {
  let apiKey = "";
  switch (keyName) {
    case "openai":
      apiKey = process.env.OPENAI_API_KEY || "";
      break;
    case "anthropic":
      apiKey = process.env.ANTHROPIC_API_KEY || "";
      break;
  }
  return apiKey;
}

export const SERVER_getGeneralPurposeDBName = async (
  baseName: string,
  userId: string,
  limitToDay: boolean = false,
  newSave: boolean = false
) => {
  const _dateString = UTILS_getTodayDateString();

  // Store name of last saved message in DB
  let result = baseName + "-" + userId + (limitToDay ? `-${_dateString}` : "");

  if (limitToDay) {
    // get last message name and check if it matches today's date
    const lastSavedName = await _retrieveLastName(baseName, userId);
    if (!newSave) {
      result = lastSavedName || "";
    } else {
      if (lastSavedName !== result) {
        // NEW DAY!
        await _storeLastName(baseName, userId, _dateString);
      }
    }
  }
  return result;
};

const _storeLastName = async (
  baseName: string,
  userId: string,
  dateString: string
) => {
  try {
    const _dbName = "GeneralPurposeLastSaved-" + baseName + "-" + userId;
    const existing = await db.generalPurpose.findFirst({
      where: {
        name: _dbName,
      },
      select: {
        id: true,
        content: true,
      },
    });
    if (existing) {
      await db.generalPurpose.update({
        where: { id: existing.id },
        data: { content: baseName + "-" + userId + "-" + dateString },
      });
    } else {
      await db.generalPurpose.create({
        data: {
          name: _dbName,
          content: baseName + "-" + userId + "-" + dateString,
          meta1: baseName,
          meta2: userId,
          meta3: dateString,
        },
      });
    }
  } catch (error) {
    console.error("Error storing last name:", error);
  }
};
const _retrieveLastName = async (baseName: string, userId: string) => {
  let result = "";
  try {
    const _dbName = "GeneralPurposeLastSaved-" + baseName + "-" + userId;
    const existing = await db.generalPurpose.findFirst({
      where: { name: _dbName },
    });
    result = existing?.content || "";
  } catch (e) {
    console.error("Error retrieving last saved name: ", e);
  }
  return result;
};

export async function SERVER_saveCommonAgentState(
  name: string,
  agentState: AgentComponentProps
) {
  const dbName = `CommonAGENT`;
  const agentStateString = JSON.stringify(agentState);
  await SERVER_storeGeneralPurposeData(
    agentStateString,
    name,
    agentState.title!,
    agentState.roleDescription!,
    dbName,
    true
  );
  return agentStateString + " saved as Common Agent!";
}

export async function SERVER_getCommonAgents() {
  const dbName = `CommonAGENT`;
  const agents = await SERVER_getGeneralPurposeDataMany(dbName);
  return agents;
}

export async function SERVER_getOpenAIModelNames(): Promise<
  ModelProviderSelectName[]
> {
  console.log("SERVER_getOpenAIModelNames...");
  const modelNames = await DYNAMIC_MODEL_NAMES.OpenAI();
  return modelNames;
}

export async function SERVER_listAllModelProvidersAsString(): Promise<string> {
  const modelNames = await DYNAMIC_MODEL_NAMES.All();
  let result = "";
  // Group models by provider name and print each provider once followed by its models
  const modelsByProvider = modelNames.reduce((acc, model) => {
    if (!acc[model.name || ""]) {
      acc[model.name ?? ""] = [];
    }
    acc[model.name ?? ""].push(model.id);
    return acc;
  }, {} as Record<string, string[]>);

  Object.entries(modelsByProvider).forEach(([provider, models]) => {
    result += provider + "\n";
    models.forEach(modelId => {
      result += "  " + modelId + "\n";
    });
  });
  return result;
}

// export async function SERVER_getTeam(id: number) {
//   const team = await db.generalPurpose.findFirst({
//     where: {id: id},
//     select: {
//       content: true
//     },
//   });
//   return team?.content;
// }

// export async function SERVER_getSingleAgent(id: number) {
//   const agent = await db.generalPurpose.findFirst({
//     where: {id: id},
//     select: {
//       content: true
//     },
//   });
//   return agent?.content;
// }

// export async function SERVER_getAllSingleAgents(userId: string) {
//   const agents = await db.generalPurpose.findMany({
//     where: {name: `AgentState-${userId}`, meta1: "one"},
//     select: {
//       id: true,
//       meta2: true,
//     },
//   });
//   return agents.map((agent) => ({id: agent.id, name: agent.meta2, allOrOne: "one"}));
// }

export async function SERVER_getAllSavedAgentStates(userId: string): Promise<{id: number, name: string, allOrOne: "all" | "one"}[]> {
  const agents = await db.generalPurpose.findMany({
    where: {name: `AgentState-${userId}`},
    select: {
      id: true,
      meta1: true,
      meta2: true,
    },
  });
  return agents.map((agent) => ({id: agent.id, name: agent.meta2, allOrOne: agent.meta1 as "all" | "one"}));
}

// export async function SERVER_getSingleAgent(id: number) {
//   const agent = await db.generalPurpose.findFirst({
//     where: { id: id, meta1: "one"},
//     select: {
//       content: true,
//       name: true,
//       meta1: true,
//       meta2: true,
//       meta3: true,
//     },
//   });
//   return agent?.content;
// }

export async function SERVER_getSavedTeam(id: number) {
  const team = await db.generalPurpose.findFirst({
    where: { id: id, meta1: "all"},
    select: {
      content: true,
      name: true,
    },
  });
  return team?.content;
}


