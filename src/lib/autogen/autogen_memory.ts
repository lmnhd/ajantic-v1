import { AUTOGEN_MEMORY_storeProcessNotesToMemory, MEMORY_store } from "@/src/lib/agent-memory/store-retrieve"
import { MODEL_getModel_ai } from "@/src/app/api/chat/analysis"
import { ModelProviderEnum } from "@/src/lib/types"
import { MODEL_getModelArgsByName, UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils"
import { generateText } from "ai"
// export const _storeProcessNotesToMemory = async (processToAutomate: string, modifications: string[], userId: string) => {
//     const processNotes = await generateText({
//         model: await MODEL_getModel_ai(UTILS_getModelArgsByName(UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name).modelName, ModelProviderEnum.ANTHROPIC),
//         prompt: PROMPT_AUTOGEN_MEMORY_processNotes(processToAutomate, modifications),
//     })

//     await AUTOGEN_MEMORY_storeProcessNotesToMemory(processToAutomate, processNotes.text.split("\n"), userId, {modifications: modifications})
// }

// const PROMPT_AUTOGEN_MEMORY_processNotes = (processToAutomate: string, modifications: string[]) => {
//     return `
//     You are a helpful assistant that stores process notes for future auto-gen creations.
//     You are given a process to automate and a list of modifications.
//     You are to store the process notes for future auto-gen creations.
//     `
// }

