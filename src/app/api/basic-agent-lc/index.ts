import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { AgentFoundationalPromptProps, ModelArgs, AgentComponentProps, ContextContainerProps } from "@/src/lib/types";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatCohere } from "@langchain/cohere";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MODEL_getModel_lc } from "../chat/analysis";


export function aiManipulateSetsTest(
  action: "add" | "delete" | "disabled",
  setName: string,
  contextSets: ContextContainerProps[],
  isDisabled?: boolean
): string {
  try {
    switch (action) {
      case "add":
        console.log("contextSets before add", contextSets);
        contextSets.push({
          setName: setName,
          text: "",
          lines: [],
          isDisabled: isDisabled ?? false,
        });
        break;
      case "delete":
        contextSets = contextSets.splice(
          contextSets.findIndex((s) => s.setName === setName),
          1
        );
        console.log("contextSets after delete", contextSets);
        break;
      case "disabled":
        const lineSet = contextSets.find((s) => s.setName === setName);
        if (lineSet) {
          lineSet.isDisabled = isDisabled ?? false;
        }
        break;
    }
    return "success";
  } catch (error) {
    return "failed";
  }
}
export function aiManipulateLinesTest(
  action: "update" | "clear",
  setName: string,
  newText: string,
  //lineType: "line" | "text",
  contextSets: ContextContainerProps[]
): string {
  try {
    let set: ContextContainerProps | undefined;
    switch (action) {
      //update the text in a set
      case "update":
        set = contextSets.find((s) => s.setName === setName);
        if (set) {
          set.text = newText;
        }
        break;
      case "clear":
        //clear the text from a set
        set = contextSets.find((s) => s.setName === setName);
        if (set) {
          set.text = "";
        }
        break;
    }
    return "success";
  } catch (error) {
    return "failed";
  }
}

export const langChainBasicAgent = async (
  contextSets: ContextContainerProps[],
  modelNames: ModelArgs[],
  streaming: boolean,
  agentFoundationalPromptProps: AgentFoundationalPromptProps
) => {
  const llm:
    | ChatMistralAI
    | ChatOpenAI
    | ChatCohere
    | ChatAnthropic
    | ChatGoogleGenerativeAI = await MODEL_getModel_lc(
    modelNames[0].modelName,
    modelNames[0].provider,
    modelNames[0].temperature,
    streaming || false
  );

  const magicTool = tool(
    async ({ input }: { input: number }) => {
      return `${input + 2}`;
    },
    {
      name: "magic_function",
      description: "Applies a magic function to an input.",
      schema: z.object({
        input: z.number(),
      }),
    }
  );
  function aiManipulateSets(
    action: "add" | "delete" | "disabled",
    setName: string,
    isDisabled?: boolean
  ) {
    switch (action) {
      case "add":
        contextSets.push({
          setName: setName,
          text: "",
          lines: [],
          isDisabled: false,
        });
        break;
      case "delete":
        contextSets = contextSets.filter((s) => s.setName !== setName);

        break;
      case "disabled":
        const lineSet = contextSets.find((s) => s.setName === setName);
        if (lineSet) {
          lineSet.isDisabled = isDisabled ?? false;
        }
        break;
    }
  }
  function aiManipulateLines(
    action: "update" | "clear",
    setName: string,
    newText: string
    //lineType: "line" | "text",
    //contextSets: ContextContainerProps[]
  ) {
    let set: ContextContainerProps | undefined;
    switch (action) {
      //update the text in a set
      case "update":
        set = contextSets.find((s) => s.setName === setName);
        if (set) {
          set.text += newText + "\n";
        } else {
          // create a new set
          contextSets.push({
            setName: setName,
            text: newText + "\n",
            lines: [],
            isDisabled: false,
          });
        }
        break;
      case "clear":
        //clear the text from a set
        set = contextSets.find((s) => s.setName === setName);
        if (set) {
          set.text = "";
        }
        break;
    }
  }

  const lines_tool = tool(
    async ({
      action,
      setName,
      newText,
    }: {
      action: "update" | "clear";
      setName: string;
      newText?: string;
    }) => {
      aiManipulateLines(action, setName, newText || "");
    },
    {
      name: "lines_tool",
      description:
        "update or clear the text in a line set by entering the function call, set name, and new text. This will replace any existing text in the line.",
      schema: z.object({
        action: z.enum(["update", "clear"]),
        setName: z.string(),
        newText: z.string().optional(),
        contextSets: z.array(
          z.object({
            setName: z.string(),
            text: z.string(),
            lines: z.array(z.string()),
            isDisabled: z.boolean(),
          })
        ),
      }),
    }
  );

  const sets_tool = tool(
    async ({
      action,
      setName,
      newText,
    }: {
      action: "add" | "delete" | "disabled";
      setName: string;
      newText?: string;
    }) => {
      aiManipulateSets(action, setName, false);
    },
    {
      name: "sets_tool",
      description:
        "add, delete, or disable a set by entering the function call and set name.",
      schema: z.object({
        action: z.enum(["add", "delete", "disabled"]),

        setName: z.string(),
        newText: z.string().optional(),
      }),
    }
  );

  const tools = [lines_tool, sets_tool];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      'You are a helpful assistant.'
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  // console.log("prompt", await prompt.invoke({
  //   chat_history: [],
  //   input: "",
  // }));

  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
    streamRunnable: streaming,
  });

  // return;

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });
  //return
  return agentExecutor;
};

// const { text: answer } = await generateText({
//   model: openai('gpt-4o-2024-08-06', { structuredOutputs: true }),
//   tools: {
//     calculate: tool({
//       description:
//         'A tool for evaluating mathematical expressions. ' +
//         'Example expressions: ' +
//         "'1.2 * (2 + 4.5)', '12.7 cm to inch', 'sin(45 deg) ^ 2'.",
//       parameters: z.object({ expression: z.string() }),
//       execute: async ({ expression }) => mathjs.evaluate(expression),
//     }),
//   },
//   maxSteps: 10,
//   system:
//     'You are solving math problems. ' +
//     'Reason step by step. ' +
//     'Use the calculator when necessary. ' +
//     'When you give the final answer, ' +
//     'provide an explanation for how you arrived at it.',
//   prompt:
//     'A taxi driver earns $9461 per 1-hour of work. ' +
//     'If he works 12 hours a day and in 1 hour ' +
//     'he uses 12 liters of petrol with a price  of $134 for 1 liter. ' +
//     'How much money does he earn in one day?',
// });

// console.log(`ANSWER: ${answer}`);

// export const channelAgent = async (
//   contextSets: ContextContainerProps[],
//   modelNames: ModelArgs[],
//   streaming: boolean,
//   agentFoundationalPromptProps: AgentFoundationalPromptProps
// ) => {

// }
