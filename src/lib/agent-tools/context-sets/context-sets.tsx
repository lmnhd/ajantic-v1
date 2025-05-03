import {
  AGENT_TOOLS_EMULATOR,
  ContextContainerProps,
  ModelProviderEnum,
} from "@/src/lib/types";
import { generateText, tool } from "ai";
import { MODEL_getModel_ai } from "../../vercelAI-model-switcher";
import { z } from "zod";
import { TextChatLogProps } from "../../text-chat-log";
import { logger } from "@/src/lib/logger";
import { AgentComponentProps } from "@/src/lib/types";
export const TOOLFUNCTION_CONTEXT_SETS = (
  sets: ContextContainerProps[],
  functionToRun: "addSet" | "deleteSet" | "editSet" | "clearText",
  currentAgent: AgentComponentProps,
  nameOfSetToEditOrDelete?: string,
  newText?: string,
  newSetName?: string,
  visibleToAgents?: string[],
  allAgents?: string[]
) => {
  logger.tool("Context Sets Operation Started", {
    action: "CONTEXT_SETS_OPERATION",
    operation: functionToRun,
    targetSet: nameOfSetToEditOrDelete,
    hasNewText: !!newText,
    hasNewName: !!newSetName,
    currentSetsCount: sets.length,
  });

  if(!visibleToAgents || visibleToAgents.length === 0) {
    visibleToAgents = [currentAgent.name];
  }

  if (functionToRun === "addSet") {
    if (newText) {
      const setNameAlreadyExists = sets.find(
        (set) =>
          set.setName.trim().toLowerCase() ===
          newSetName?.trim().toLowerCase()
      );

      if (setNameAlreadyExists) {
        logger.tool("Updating existing set", {
          action: "SET_UPDATE",
          setName: newSetName,
          oldText: setNameAlreadyExists.text?.substring(0, 50) + "...",
          newTextLength: newText.length,
          totalSets: sets.length,
          hiddenFromAgents: TOOLFUNCTION_CONTEXT_SETS_hiddenFromAgents(visibleToAgents || [], allAgents || []),
        });
        setNameAlreadyExists.text = newText;
      } else {
        logger.tool("Adding new set", {
          action: "SET_CREATE",
          setName: newSetName || `Set ${sets.length + 1}`,
          textLength: newText.length,
          totalSets: sets.length + 1,
        });
        sets.push({
          setName: newSetName || `Set ${sets.length + 1}`,
          text: newText,
          lines: [],
          isDisabled: false,
          hiddenFromAgents: TOOLFUNCTION_CONTEXT_SETS_hiddenFromAgents(visibleToAgents || [], allAgents || []),
        });
      }
    }
  }

  if (functionToRun === "deleteSet") {
    const indexToDelete = sets.findIndex(
      (set) =>
        set.setName.trim().toLowerCase() ===
        (nameOfSetToEditOrDelete || "").trim().toLowerCase()
    );

    if (indexToDelete !== -1) {
      logger.tool("Deleting set", {
        action: "SET_DELETE",
        setName: sets[indexToDelete].setName,
        setIndex: indexToDelete,
        totalSetsBeforeDelete: sets.length,
      });
      sets.splice(indexToDelete, 1);
    } else {
      logger.tool("Delete operation failed", {
        action: "SET_DELETE_FAILED",
        requestedSet: nameOfSetToEditOrDelete,
        reason: "Set not found",
      });
    }
  }

  if (functionToRun === "editSet") {
    if (nameOfSetToEditOrDelete !== undefined) {
      const setToEdit = sets.find(
        (set) => set.setName === nameOfSetToEditOrDelete
      );

      if (setToEdit) {
        logger.tool("Editing set", {
          action: "SET_EDIT",
          originalName: setToEdit.setName,
          newName: newSetName,
          hasTextUpdate: !!newText,
          originalTextLength: setToEdit.text?.length,
          newTextLength: newText?.length,
        });

        if (newText !== undefined) {
          setToEdit.text = newText;
        }
        if (newSetName !== undefined) {
          setToEdit.setName = newSetName;
        }
        setToEdit.hiddenFromAgents = TOOLFUNCTION_CONTEXT_SETS_hiddenFromAgents(visibleToAgents || [], allAgents || []);
      } else {
        logger.tool("Edit operation failed", {
          action: "SET_EDIT_FAILED",
          requestedSet: nameOfSetToEditOrDelete,
          reason: "Set not found",
        });
      }
    }
  }

  if (functionToRun === "clearText") {
    if (nameOfSetToEditOrDelete !== undefined) {
      const setToClear = sets.find(
        (set) => set.setName === nameOfSetToEditOrDelete
      );

      if (setToClear) {
        logger.tool("Clearing set text", {
          action: "SET_CLEAR",
          setName: setToClear.setName,
          originalTextLength: setToClear.text?.length,
        });
        setToClear.text = "";
      } else {
        logger.tool("Clear operation failed", {
          action: "SET_CLEAR_FAILED",
          requestedSet: nameOfSetToEditOrDelete,
          reason: "Set not found",
        });
      }
    }
  }

  logger.tool("Context Sets Operation Complete", {
    action: "OPERATION_COMPLETE",
    function: functionToRun,
    finalSetsCount: sets.length,
    setNames: sets.map((s) => s.setName),
  });

  return sets;
};

export const TOOLFUNCTION_CONTEXT_SETS_hiddenFromAgents = (
  visibleToAgents: string[],
  allAgents: string[]
) => {
  return allAgents.filter((agent) => !visibleToAgents.includes(agent));
};

export const AGENT_TOOLS_contextSets = (
  sets: ContextContainerProps[],
  textChatLogs: TextChatLogProps[],
  currentAgent: AgentComponentProps,
  allAgents: string[]
) => {
  let _functionCalled = false;
  let returnMessage = `Done! The context will reflect the changes on the next run.`;
  return {
    CONTEXT_addNewset: tool({
      description: "Add a new titled set to the context.",
      parameters: z.object({
        text: z.string().describe("The text value of the new set."),
        title: z.string().describe("The title of the new set."),
        visibleToAgents: z
          .array(z.enum(allAgents as [string, ...string[]]))
          .optional()
          .describe("OPTIONAL: The agents that should be able to see the set."),
      }).required({
        text: true,
        title: true,
      }),
      execute: async ({ text, title, visibleToAgents }) => {
        if (_functionCalled) {
          logger.tool("Context Sets Tool - Already Called", {

            operation: "addNewSet",
          });
          return "Already called! - You can stop calling now.";
        }
        _functionCalled = true;
        logger.tool("Context Sets Tool - Adding New Set", {
          title,
          textLength: text.length,
        });
        textChatLogs.push({
          role: "function",
          message: `Adding new context set with title: ${title}`,
          agentName: "CONTEXT_addNewset",
          timestamp: new Date(),
        });
        sets = TOOLFUNCTION_CONTEXT_SETS(
          sets,
          "addSet",
          currentAgent,
          undefined,
          text,
          title,
          visibleToAgents
        );
        return returnMessage;
      },
    }),
    CONTEXT_deleteSet: tool({
      description: "Delete a set from the context.",
      parameters: z.object({
        nameOfSetToDelete: z
          .string()
          .describe("The name of the set to delete."),
      }).required({
        nameOfSetToDelete: true,
      }),

      execute: async ({ nameOfSetToDelete }) => {
        if (_functionCalled) {
          logger.tool("Context Sets Tool - Already Called", {

            operation: "deleteSet",
          });
          return "Already called! - Stop Calling Now!";
        }
        _functionCalled = true;
        logger.tool("Context Sets Tool - Deleting Set", {
          title: nameOfSetToDelete,
        });
        textChatLogs.push({
          role: "function",
          message: `Deleting context set: ${nameOfSetToDelete}`,
          agentName: "CONTEXT_deleteSet",
          timestamp: new Date(),
        });
        sets = TOOLFUNCTION_CONTEXT_SETS(sets, "deleteSet", currentAgent, nameOfSetToDelete);
        return returnMessage;
      },
    }),
    CONTEXT_editSet: tool({
      description: "Edit a set in the context.",
      parameters: z.object({
        nameOfSetToEditOrDelete: z
          .string()
          .describe("The name of the set to edit or delete."),
        newText: z
          .string()
          .describe(
            "The new text value of the set. Required even if only changing the name."
          ),
        newSetName: z
          .string()
          .optional()
          .describe("OPTIONAL: If editing the name, the new name of the set."),
        visibleToAgents: z
          .array(z.enum(allAgents as [string, ...string[]]))
          .optional()
          .describe("OPTIONAL: The agents that should be able to see the set."),
      }).required({
        nameOfSetToEditOrDelete: true,
        newText: true,
        newSetName: true,
      }),
      execute: async ({ nameOfSetToEditOrDelete, newText, newSetName, visibleToAgents }) => {
        if (_functionCalled) {
          logger.tool("Context Sets Tool - Already Called", {
            operation: "editSet",
          });
          return "Already called! - Stop Calling Now!";
        }
        _functionCalled = true;
        logger.tool("Context Sets Tool - Editing Set", {
          title: nameOfSetToEditOrDelete,
          newName: newSetName,
          hasNewText: !!newText,
          textLength: newText?.length,
        });
        textChatLogs.push({
          role: "function",
          message: `Editing context set: ${nameOfSetToEditOrDelete}${
            newSetName ? ` to ${newSetName}` : ""
          }`,
          agentName: "CONTEXT_editSet",
          timestamp: new Date(),
        });
        sets = TOOLFUNCTION_CONTEXT_SETS(
          sets,
          "editSet",
          currentAgent,
          nameOfSetToEditOrDelete,
          newText,
          newSetName,
          visibleToAgents,
          allAgents
        );
        return returnMessage;
      },
    }),
  };
};
