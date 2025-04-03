"use server";

import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import {
  AgentExecutor,
  AgentFinish,
  AgentStep,
  createOpenAIFunctionsAgent,
  createReactAgent,
  createToolCallingAgent,
} from "langchain/agents";
import { DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import type { FunctionsAgentAction } from "langchain/agents/openai/output_parser";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

import { NextResponse } from "next/server";
import {
  AIMessage,
  BaseMessage,
  FunctionMessage,
  MessageType,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { AITOOL_ryhmingTool, AITOOL_synonymsTool } from "../tools/lc";
import { AISessionState, ContextContainerProps,  ModelArgs } from "@/lib/types";
import { MODEL_getModel_ai, MODEL_getModel_lc } from "../chat/analysis";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatCohere } from "@langchain/cohere";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Message } from "ai";
import { ServerMessage } from "@/lib/types";
import { AGENT_FOUNDATIONAL_PROMPTS2 } from "@/app/(main)/research/analysis/prompts/sets-tool/ai-manipulate-set";

export async function generateAgent(
  system: string,
  modelNames: ModelArgs[],
  user?: string,
  useTools?: boolean,
  streaming?: boolean

  // useLatestLLM?: boolean
): Promise<AgentExecutor> {
  const responseSchema = z.object({
    //response: z.string().describe("for returning response to return to the user"),
    response: z
      .array(z.string())
      .describe(
        "for returning one or more lyrical variations to the user, such as a line of a verse or a list of choices. Only supply a string or an array of strings"
      ),
  });

  // const responseSchema = z.object({
  //   answer: z.string().describe("The final answer to return to the user"),
  //   sources: z
  //     .array(z.string())
  //     .describe(
  //       "List of page chunks that contain answer to the question. Only include a page chunk if it contains relevant information"
  //     ),
  // });

  // const searchTool = new DynamicTool({
  //   name: "web-search-tool",
  //   description: "Tool for getting the latest information from the web",
  //   func: async (searchQuery: string, runManager) => {
  //     const retriever = new TavilySearchAPIRetriever();
  //     const docs = await retriever.invoke(searchQuery, runManager?.getChild());
  //     return docs.map((doc) => doc.pageContent).join("\n-----\n");
  //   },
  // });

  const responseOpenAIFunction = {
    name: "response-tool",
    description: "Return the response to the user",
    parameters: zodToJsonSchema(responseSchema),
  };
  // const model = new ChatOpenAI({
  //   //modelName: "gpt-3.5-turbo",
  //   modelName: useLatestLLM ? "gpt-4o" : "gpt-3.5-turbo",
  //   temperature: 0.7,
  //   streaming: true,
  //   maxTokens: -1,
  //   verbose: true,
  // });
  // const llm = new ChatOpenAI({
  //   model: useTools ? modelNames[0].modelName : "gpt-4o-mini",
  //   temperature: 1,
  //   verbose: true,
  // });

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

  const prompt = user
    ? ChatPromptTemplate.fromMessages([
        ["system", system],
        ["user", user],
        new MessagesPlaceholder("agent_scratchpad"),
      ])
    : ChatPromptTemplate.fromMessages([
        ["system", system],
        new MessagesPlaceholder("agent_scratchpad"),
      ]);
  // const prompt = ChatPromptTemplate.fromMessages([
  //   [
  //     "system",
  //     "You are a helpful assistant. You must always call one of the provided tools.",
  //   ],
  //   ["user", "{input}"],
  //   new MessagesPlaceholder("agent_scratchpad"),
  // ]);

  const structuredOutputParser = (
    message: AIMessage
  ): FunctionsAgentAction | AgentFinish => {
    if (message.content && typeof message.content !== "string") {
      throw new Error("This agent cannot parse non-string model responses.");
    }
    if (message.additional_kwargs.function_call) {
      const { function_call } = message.additional_kwargs;
      try {
        const toolInput = function_call.arguments
          ? JSON.parse(function_call.arguments)
          : {};
        // If the function call name is `response` then we know it's used our final
        // response function and can return an instance of `AgentFinish`
        if (function_call.name === "response-tool") {
          return { returnValues: { ...toolInput }, log: message.content };
        }
        return {
          tool: function_call.name,
          toolInput,
          log: `Invoking "${function_call.name}" with ${
            function_call.arguments ?? "{}"
          }\n${message.content}`,
          messageLog: [message],
        };
      } catch (error) {
        throw new Error(
          `Failed to parse function arguments from chat model response. Text: "${function_call.arguments}". ${error}`
        );
      }
    } else {
      return {
        returnValues: { output: message.content },
        log: message.content,
      };
    }
  };

  const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] =>
    steps.flatMap(({ action, observation }) => {
      if ("messageLog" in action && action.messageLog !== undefined) {
        const log = action.messageLog as BaseMessage[];
        return log.concat(new FunctionMessage(observation, action.tool));
      } else {
        return [new AIMessage(action.log)];
      }
    });
  const llmWithTools = llm.bind({
    functions: [
      //convertToOpenAIFunction(searchTool),
      convertToOpenAIFunction(AITOOL_synonymsTool),
      convertToOpenAIFunction(AITOOL_ryhmingTool),
      //convertToOpenAIFunction(AITOOL_bingSearchTool),

      responseOpenAIFunction,
    ],
  });
  const runnableAgent = RunnableSequence.from<{
    input: string;
    steps: Array<AgentStep>;
  }>([
    {
      input: (i: any) => i.input,
      agent_scratchpad: (i: any) => formatAgentSteps(i.steps),
    },
    prompt,
    llmWithTools,
    structuredOutputParser,
  ]);
  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnableAgent,
    tools: [
      AITOOL_ryhmingTool,
      AITOOL_synonymsTool,
      // AITOOL_bingSearchTool
    ],
  });
  return executor;
  /** Call invoke on the agent */
  // const res = await executor.invoke({
  //   input: "",
  // });
  // console.log({
  //   res,
  // });
}

export async function generateAnalysisAgent(
  system: string,
  modelNames: ModelArgs[],
  streaming: boolean,
  messages: ServerMessage[],
  agentName: string
  // manipulateSetsTool: DynamicStructuredTool<any>
  //): Promise<AgentExecutor> {
) {
  const llm:
    | ChatMistralAI
    | ChatOpenAI
    | ChatCohere
    | ChatAnthropic
    | ChatGoogleGenerativeAI = await MODEL_getModel_lc(
    modelNames[0].modelName,
    modelNames[0].provider,
    modelNames[0].temperature,
    streaming
  );

  //messages.push({role: "assistant", content: "Hello, how are you?", currentState: {} as AISessionState, agentName: "test"})

  const testMessages = messages.map(
    (m) =>
      ({
        type: m.role as MessageType,
        content:
          m.role === "user"
            ? m.content
            : `${
                m.agentName !== undefined ? "Agent " + m.agentName + ": " : ""
              }${m.content}`,
      } as unknown as BaseMessage)
  );
  console.log("testMessages", testMessages);
  //return;

  // `${agentName ? agentName + ": " : ""}${m.content}`

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", system],
    ...messages.map(
      (m) =>
        ({
          type: m.role as MessageType,
          content: `${m.agentName ? m.agentName + ": " : ""}${m.content}`,
        } as unknown as BaseMessage)
    ),
    new MessagesPlaceholder("agent_scratchpad"),
    ["user", "{input}"],
  ]);

  //return llm;

  const formatAgentSteps = (steps: AgentStep[]): BaseMessage[] =>
    steps.flatMap(({ action, observation }) => {
      if ("messageLog" in action && action.messageLog !== undefined) {
        const log = action.messageLog as BaseMessage[];
        return log.concat(new FunctionMessage(observation, action.tool));
      } else {
        return [new AIMessage(action.log)];
      }
    });

  const agent = createToolCallingAgent({
    llm,
    tools: [AITOOL_synonymsTool],
    prompt,
    streamRunnable: false,
  });

  const executor = new AgentExecutor({
    agent,
    tools: [AITOOL_synonymsTool],
  });
  // const setsTool = {
  //   name: "manipulate-sets",
  //   description:
  //     "create, edit, or delete a set by entering the function call, set name, and new text. This will replace any existing text in the set.",
  //   parameters: zodToJsonSchema(
  //     z.object({
  //       functionCall: z.enum(["new", "edit", "delete"]),
  //       setName: z.string(),
  //       newText: z.string(),
  //     })
  //   ),
  // };
  // const setsTool = {
  //   name: "manipulate-sets",
  //   description:
  //     "create, edit, or delete a set by entering the function call, set name, and new text. This will replace any existing text in the set.",
  //   parameters: zodToJsonSchema(
  //     z.object({
  //       functionCall: z.enum(["new", "edit", "delete"]),
  //       setName: z.string(),
  //       newText: z.string(),
  //     })
  //   ),
  //   lc_namespace: "namespace",
  //   schema: z.object({
  //     functionCall: z.enum(["new", "edit", "delete"]),
  //     setName: z.string(),
  //     newText: z.string(),
  //   }),
  //   call: async (input: any) => {
  //     // Implementation of the tool's functionality
  //   },
  //   returnDirect: true,
  // };

  // const llmWithTools = llm.bind({
  //   functions: [convertToOpenAIFunction(AITOOL_synonymsTool)],

  // });
  // const runnableAgent = RunnableSequence.from<{
  //   input: string;
  //   steps: Array<AgentStep>;
  // }>([
  //   {
  //     input: (i: any) => i.input,
  //     agent_scratchpad: (i: any) => formatAgentSteps(i.steps),
  //   },
  //   prompt,
  //   llmWithTools,

  //   //manipulateSetsTool
  // ]);

  // const executor = AgentExecutor.fromAgentAndTools({
  //   agent: runnableAgent,
  //   tools: [AITOOL_synonymsTool],

  // });

  return executor;
  /** Call invoke on the agent */
  // const res = await executor.invoke({
  //   input: "",
  // });
  // console.log({
  //   res,
  // });
}

export async function generateLCAgentBasic(
  system: string,
  modelNames: ModelArgs[],
  contextSets: ContextContainerProps[],
  streaming: boolean,
  messages: ServerMessage[],
  agentName: string
) {
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

  function aiManipulateSets(
    functionCall: "add" | "delete" | "disabled",
    setName: string,
    isDisabled?: boolean
  ) {
    switch (functionCall) {
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
    functionCall: "new" | "edit" | "delete",
    setName: string,
    newText: string,
    lineType: "line" | "text"
  ) {
    if (lineType === "line") {
      const lineSetLength =
        contextSets.find((s) => s.setName === setName)?.lines.length || 0;
      switch (functionCall) {
        case "new":
          contextSets
            .find((s) => s.setName === setName)
            ?.lines.push({
              text: newText,
              type: "line",
              blockNum: lineSetLength || 0,
              blockLength:
                contextSets.find((s) => s.setName === setName)?.lines.length ||
                0,
              lineNum: lineSetLength - 1,
            });
          break;
        case "edit":
          const lineSet = contextSets.find((s) => s.setName === setName);
          if (lineSet) {
            lineSet.lines = lineSet.lines.map((l) =>
              l.text === newText ? { ...l, text: newText } : l
            );
          }
          break;
        default:
          break;
      }
    } else {
      switch (functionCall) {
        case "new":
          contextSets.push({
            setName: setName,
            text: newText,
            lines: [],
            isDisabled: false,
          });
          break;
        case "edit":
          const set = contextSets.find((s) => s.setName === setName);
          if (set) {
            set.text = newText;
          }
          break;
        case "delete":
          contextSets = contextSets.filter((s) => s.setName !== setName);
      }
    }
  }

  // aiManipulateSets("new", "test", "test");

  // return;

  // const magicTool = tool(
  //   async ({ input }: { input: number }) => {
  //     return `${input + 2}`;
  //   },
  //   {
  //     name: "magic_function",
  //     description: "Applies a magic function to an input.",
  //     schema: z.object({
  //       input: z.number(),
  //     }),
  //   }
  // );

  // const sets_tool = tool(
  //   async ({
  //     functionCall,
  //     setName,
  //     newText,
  //   }: {
  //     functionCall: "new" | "edit" | "delete";
  //     setName: string;
  //     newText?: string;
  //   }) => {
  //     aiManipulateSets(functionCall, setName, newText || "");
  //   },
  //   {
  //     name: "sets_tool",
  //     description:
  //       "create, edit, or delete a set by entering the function call, set name, and new text. This will replace any existing text in the set.",
  //     schema: z.object({
  //       functionCall: z.enum(["new", "edit", "delete"]),
  //       setName: z.string(),
  //       newText: z.string().optional(),
  //     }),
  //   }
  // );

  const lines_tool = tool(
    async ({
      functionCall,
      setName,
      newText,
    }: {
      functionCall: "new" | "edit" | "delete";
      setName: string;
      newText?: string;
    }) => {
      aiManipulateLines(functionCall, setName, newText || "", "line");
    },
    {
      name: "lines_tool",
      description:
        "create, edit, or delete a line by entering the function call, set name, and new text. This will replace any existing text in the line.",
      schema: z.object({
        functionCall: z.enum(["new", "edit", "delete"]),
        setName: z.string(),
        newText: z.string().optional(),
      }),
    }
  );

  const sets_tool = tool(
    async ({
      functionCall,
      setName,
      newText,
    }: {
      functionCall: "add" | "delete" | "disabled";
      setName: string;
      newText?: string;
    }) => {
      aiManipulateSets(functionCall, setName, false);
    },
    {
      name: "sets_tool",
      description:
        "add, delete, or disable a set by entering the function call and set name.",
      schema: z.object({
        functionCall: z.enum(["add", "delete", "disabled"]),

        setName: z.string(),
        newText: z.string().optional(),
      }),
    }
  );

  // const text_tool = tool(

  //   async ({
  //     functionCall,
  //     setName,
  //     newText,
  //   }: {
  //     functionCall: "new" | "edit" | "delete";
  //     setName: string;
  //     newText?: string;
  //   }) => {
  //     aiManipulateLines(functionCall, setName, newText || "", "text");
  //   },
  //   {
  //     name: "text_tool",
  //     description:
  //       "create, edit, or delete a text by entering the function call, set name, and new text. This will replace any existing text in the text.",
  //     schema: z.object({
  //       functionCall: z.enum(["new", "edit", "delete"]),
  //       setName: z.string(),
  //       newText: z.string().optional(),
  //     }),
  //   }
  // );

  const tools = [lines_tool, sets_tool];

  const testPrompt =
    AGENT_FOUNDATIONAL_PROMPTS2.PROMPT_ANALYSIS_AI_MANIPULATE_SET(
      system,
      contextSets
    );
  console.log("testPrompt", testPrompt);

  //return;

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      AGENT_FOUNDATIONAL_PROMPTS2.PROMPT_ANALYSIS_AI_MANIPULATE_SET(
        system,
        contextSets
      ),
    ],
    ["placeholder", "{chat_history}"],
    // ...messages.map(
    //   (m) =>
    //     ({
    //       type: m.role as MessageType,
    //       content: `${m.agentName ? m.agentName + ": " : ""}${m.content}`,
    //     } as unknown as BaseMessage)
    // ),
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  //console.log("Prompt Test...", await prompt.invoke({ input: "test" }));

  //return;

  const agent = createToolCallingAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools });
}

export async function generateReactLCAgent() {
  const llm = new ChatAnthropic({
    model: "claude-3-haiku-20240307",
    temperature: 0,
  });

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

  const tools = [magicTool];

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
    //["tools","magic_function"]
  ]);

  const app = await createReactAgent({
    llm,
    tools,
    prompt,
    streamRunnable: false,
  });

  // return new AgentExecutor({ agent: app, tools });

  return app;
}

export async function convertServerMessagesToBaseMessages(
  messages: ServerMessage[]
): Promise<BaseMessage[]> {
  return messages.map(
    (m) =>
      ({
        type: m.role as MessageType,
        content: `${
          m.agentName && m.role === "assistant" ? m.agentName + ": " : ""
        }${m.content}`,
      } as unknown as BaseMessage)
  );
}

// export async function convertBaseMessagesToServerMessages(messages: BaseMessage[]): Promise<ServerMessage[]> {
//   return messages.map(
//     (m) =>
//       ({
//         role: m.lc_kwargs.role as MessageType,
//         content: m.content,
//       } as ServerMessage)

//   );
// }
