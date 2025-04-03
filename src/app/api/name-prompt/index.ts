"use server";
import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";

import {
  StringOutputParser,
  BytesOutputParser,
} from "@langchain/core/output_parsers";

import { PromptTemplate } from "@langchain/core/prompts";

import { ModelArgs } from "@/src/lib/types";
import { TOOLFUNCTION_randomWord, TOOLFUNCTION_rymingDictionary, TOOLFUNCTION_synonyms } from "../tools";


export async function generateNameFromPrompt(prompt: string): Promise<string> {
  const model = new OpenAI({
    temperature: 0.7,
    modelName: "gpt-3.5-turbo",
  });

  const namePrompt = PromptTemplate.fromTemplate(
    `Generate a creative and relevant name based on the following prompt.
    The name should be a short, descriptive title that captures the essence of the prompt.
    Here are 2 examples of the final output: 
    <example>
    Title: Pulse of Passion
    </example>
    <example>
    Title: Echoes of Eternity
    </example>
    Prompt: {prompt}`
  );

  console.log("namePrompt", namePrompt);
  //return (await namePrompt.invoke({ prompt })).value;

  const chain = namePrompt.pipe(model).pipe(new StringOutputParser());

  const response = await chain.invoke({ prompt });

  return response.trim();
}

export async function NAMEPROMPT_generateNameForDirectivePrompt(
  text: string,
  modelArgs: ModelArgs
): Promise<string> {
  let rand = "";
  let i = 0;
  while (rand.length < 6 && i < 20) {
    rand = text.split(" ").map((word) => word.toLowerCase())[
      Math.floor(Math.random() * text.split(" ").length)
    ];
  }

  if (!rand) {
    rand = await TOOLFUNCTION_randomWord();
  }

  let rand2 = await TOOLFUNCTION_randomWord();

  console.log("GENERATE_NAME_FOR_DIRECTIVE_PROMPT_rand", rand);
  // return rand;

  let syns = await TOOLFUNCTION_synonyms(rand);

  console.log("GENERATE_NAME_FOR_DIRECTIVE_PROMPT_syns", syns);
  if (!syns || syns == "no_word") {
    syns = rand;
  }
  // return syns;
  let randSyn = rand;
  randSyn =
    syns.split("\n")[Math.floor(Math.random() * syns.split("\n").length)];

  if (!randSyn) {
    randSyn = rand;
  }
  console.log("GENERATE_NAME_FOR_DIRECTIVE_PROMPT_randSyn", randSyn);

  let rymes = await TOOLFUNCTION_rymingDictionary(randSyn);

  console.log("GENERATE_NAME_FOR_DIRECTIVE_PROMPT_rymes", rymes);

  if (!rymes) {
    rymes = randSyn;
  }
  let randRyme =
    rymes.split("\n")[Math.floor(Math.random() * rymes.split("\n").length)];

  if (!randRyme) {
    randRyme = randSyn || rand;
  }
  console.log("GENERATE_NAME_FOR_DIRECTIVE_PROMPT_randRyme", randRyme);

  console.log(
    "GENERATE_NAME_FOR_DIRECTIVE_PROMPT_FINAL-RESULT",
    `${rand} ${randSyn} ${randRyme}`
  );

  const promptName =
    `${rand.trim()}_${rand2.trim()}_${randSyn.trim()}_${randRyme.trim()}-${Date.now()
      .toString()
      .slice(-6)}` as string;

  return promptName;
}
