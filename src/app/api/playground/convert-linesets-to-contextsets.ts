"use server";

import { AISessionState} from "@/src/lib/types";

import { APP_FROZEN_getAll, APP_FROZEN_getById } from "@/src/lib/app-frozen";
import { db } from "@/src/lib/db";
import { LineLyricType } from "@/components/songeditor/lyric/line";


export async function testStoreContextSetsToDb(){
  const test = await db.contextContainerProps.create({
    data: {
      setName: "test",
      text: "test",
      lines: JSON.stringify([]),
    },
  });
  console.log("test", test);
}
export async function convertLinesetsToContextSets(userId: string) {
  const frozenStates = await APP_FROZEN_getAll(userId);
  const lineSets = frozenStates.map(async (state: any) => {
    const _frozenState = await APP_FROZEN_getById(state.id);

    if (_frozenState) {
    const _state = JSON.parse(_frozenState.localState);
    const _lineSets: { lineSetName: string; text: string; lines: LineLyricType[]; isDisabled: boolean; hiddenFromAgents: string[] }[] = _state.lineSets || [];

    

    const _storedSet = await db.contextSet.create({
      data: {
        teamName: (_state as AISessionState).currentAgents.name,
        userId: userId,
        sets: {
          createMany: {
            data: _lineSets.map((set) => ({
              setName: set.lineSetName,
              text: set.text,
              lines: JSON.stringify(set.lines),
              isDisabled: set.isDisabled,
              hiddenFromAgents: set.hiddenFromAgents,
              userId: userId,
            })),
          },
        },
      },
    });
    // {
    //     lineSetName: "Gmail Cleanup Requirements",
    //     text: "To clean junk files from the inbox, the following requirements are needed: 1. Authorization to access the Gmail account. 2. Search criteria to identify junk or old messages (e.g., age, sender, keywords). 3. Action to take on identified emails (e.g., delete, move to trash, archive, label).",
    //     lines: [
    //     ],
    //     isDisabled: false,
    //   }
    }
  });
  console.log("lineSets", lineSets);
  return lineSets;
}