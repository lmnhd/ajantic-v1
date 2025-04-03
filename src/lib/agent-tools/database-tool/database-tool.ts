import { tool } from "ai";
import { z } from "zod";

import { AgentComponentProps, ContextContainerProps } from "@/src/lib/types";
import { 
  CORE_storeData,
  CORE_getData,
  CORE_queryData,
  CORE_deleteData,
  CORE_createTable,
  CORE_insertRecord,
  CORE_getRecord,
  CORE_updateRecord,
  CORE_deleteRecord,
  CORE_listTables,
  CORE_getTableSchema,
  AGENT_TOOLS_HELPER_getAgentDatabaseKeys, 
  AGENT_TOOLS_HELPER_getTableKeys, 
  checkIfTableExists,
  retrieveAgentCustomTable
} from "./database-tool_core";

const CONTEXT_DATABASE_SETNAME = (agentName: string) => {
  return `Database-Records-${agentName}`
}

export const AGENT_TOOLS_database = (contextSets: ContextContainerProps[], userId: string, agentName: string, peerAgents?: AgentComponentProps[]) => {
    return {
      DB_storeData: tool({
        description: `Store data in the database. Creates a new record or updates an existing one if the key already exists.`,
        parameters: z.object({
          key: z.string().describe("A unique identifier for this data entry"),
          data: z.string().describe("The data to store (will be stringified if needed)"),
          groupIdentifier: z.string().optional().describe("Optional tag to group data together"),
          itemIdentifier: z.string().optional().describe("Optional identifier for a single item in the group"),
          allowMultiple: z.boolean().optional().describe("If true, allows multiple entries with the same key"),
        }),
        execute: async (params) => {
          const result = await CORE_storeData(userId, agentName, params);
          if(result.success) {
            contextSets = updateContextDBResults(agentName, contextSets, result.key, result.namespace, result.groupIdentifier, result.itemIdentifier, peerAgents);
          }
          return JSON.stringify(result);
        },
      }),
  
      DB_getData: tool({
        description: `Retrieve data from the database by key.`,
        parameters: z.object({
          key: z.string().describe("The unique identifier for the data entry"),
          groupIdentifier: z.string().optional().describe("The group identifier for the data entry"),
          itemIdentifier: z.string().optional().describe("The item identifier for the data entry"),
        }),
        execute: async (params) => {
          const result = await CORE_getData(userId, agentName, params);
          return JSON.stringify(result);
        },
      }),
  
      DB_queryData: tool({
        description: `Query multiple data entries from the database.`,
        parameters: z.object({
          namespace: z.string().optional().describe("Namespace to query (defaults to agent's namespace)"),
          metadata1: z.string().optional().describe("Optional metadata field 1 (Group Identifier) to filter by"),
          metadata2: z.string().optional().describe("Optional metadata field 2 (Item Identifier) to filter by"),
          limit: z.number().optional().describe("Maximum number of results to return (default: 10)"),
        }),
        execute: async (params) => {
          const coreParams = {
            namespace: params.namespace,
            metadata1: params.metadata1, 
            metadata2: params.metadata2,
            limit: params.limit
          };
          const result = await CORE_queryData(userId, agentName, coreParams);
          return JSON.stringify(result);
        },
      }),
  
      DB_deleteData: tool({
        description: `Delete data from the database by key. Provide group/item identifiers if applicable.`,
        parameters: z.object({
          key: z.string().describe("The unique identifier for the data entry"),
          groupIdentifier: z.string().optional().describe("The group identifier if applicable"),
          itemIdentifier: z.string().optional().describe("The item identifier if applicable"),
        }),
        execute: async (params) => {
          const result = await CORE_deleteData(userId, agentName, params);
          return JSON.stringify(result);
        },
      }),

      DB_listKeys: tool({
        description: "List all keys stored by this agent.",
        parameters: z.object({}),
        execute: async () => {
          const keys = await AGENT_TOOLS_HELPER_getAgentDatabaseKeys(agentName, userId); 
          return JSON.stringify({ success: true, keys });
        }
      }),
      
      DB_createTable: tool({
        description: "Creates a virtual table with a defined schema. Table names are unique per user and agent.",
        parameters: z.object({
          tableName: z.string().describe("The desired name for the table (will be prefixed internally)."),
          schema: z.array(z.object({
            name: z.string().describe("Field name."),
            type: z.enum(["string", "number", "integer", "boolean", "date", "object", "array"]).describe("Field data type."),
            isPrimaryKey: z.boolean().optional().describe("Set to true if this field is the primary key."),
            isUnique: z.boolean().optional().describe("Set to true if this field must have unique values.")
          })).describe("An array defining the table columns (name, type, constraints).")
        }),
        execute: async (params) => {
            const result = await CORE_createTable(userId, agentName, params);
            if (result.success) {
                contextSets = updateContextDBTableResults(agentName, contextSets, result.tableName, undefined, peerAgents);
            }
            return JSON.stringify(result);
        }
      }),

      DB_insertRecord: tool({
        description: "Inserts a new record (row) into a specified virtual table.",
        parameters: z.object({
            tableName: z.string().describe("The name of the table to insert into."),
            data: z.record(z.any()).describe("An object where keys are column names and values are the data to insert.")
        }),
        execute: async (params) => {
            const result = await CORE_insertRecord(userId, agentName, params);
            return JSON.stringify(result);
        }
      }),

      DB_getRecord: tool({
        description: "Retrieves records from a virtual table based on a WHERE clause.",
        parameters: z.object({
            tableName: z.string().describe("The name of the table to query."),
            whereClause: z.string().describe("The SQL WHERE clause to filter records (e.g., \"id = 5\" or \"name = 'John Doe' AND age > 30\"). Use column names defined in the schema. Be careful with syntax."),
            limit: z.number().optional().describe("Maximum number of records to return (default: 10).")
        }),
        execute: async (params) => {
            const result = await CORE_getRecord(userId, agentName, params);
            return JSON.stringify(result);
        }
      }),

      DB_updateRecord: tool({
        description: "Updates existing records in a virtual table based on a WHERE clause.",
        parameters: z.object({
            tableName: z.string().describe("The name of the table to update."),
            data: z.record(z.any()).describe("An object where keys are column names and values are the new data."),
            whereClause: z.string().describe("The SQL WHERE clause to select records to update. Be careful with syntax.")
        }),
        execute: async (params) => {
            const result = await CORE_updateRecord(userId, agentName, params);
            return JSON.stringify(result);
        }
      }),

      DB_deleteRecord: tool({
        description: "Deletes records from a virtual table based on a WHERE clause.",
        parameters: z.object({
            tableName: z.string().describe("The name of the table to delete from."),
            whereClause: z.string().describe("The SQL WHERE clause to select records to delete. Use with caution! Be careful with syntax.")
        }),
        execute: async (params) => {
            const result = await CORE_deleteRecord(userId, agentName, params);
            return JSON.stringify(result);
        }
      }),

      DB_listTables: tool({
        description: "Lists all virtual tables created by this agent for this user.",
        parameters: z.object({}),
        execute: async () => {
            const result = await CORE_listTables(userId, agentName);
            return JSON.stringify(result);
        }
      }),

      DB_getTableSchema: tool({
        description: "Retrieves the schema (column names and types) for a specified virtual table.",
        parameters: z.object({
            tableName: z.string().describe("The name of the table to get the schema for.")
        }),
        execute: async (params) => {
            const result = await CORE_getTableSchema(userId, agentName, params);
            return JSON.stringify(result);
        }
      }),
    };
};

const updateContextDBResults = (agentName: string, contextSets: ContextContainerProps[], key: string, namespace?: string, groupIdentifier?: string, itemIdentifier?: string, peerAgents?: AgentComponentProps[]) => {
  const setName = CONTEXT_DATABASE_SETNAME(agentName);
  let set = contextSets.find(s => s.setName === setName);
  if (!set) {
    set = { 
      setName,
      lines: [],
      text: "Database keys stored by this agent.",
      hiddenFromAgents: peerAgents?.map(a => a.name) || [],
    };
    contextSets.push(set);
  }
  
  const lineText = `Key: ${key}${namespace ? `, Namespace: ${namespace}`: ''}${groupIdentifier ? `, Group: ${groupIdentifier}`: ''}${itemIdentifier ? `, Item: ${itemIdentifier}`: ''}`;
  if (!set.lines?.some(l => l.content === lineText)) {
    set.lines?.push({ content: lineText, id: new Date().getTime().toString() });
  }
  return contextSets;
}

const updateContextDBTableResults = (agentName: string, contextSets: ContextContainerProps[], tableName: string, namespace?: string, peerAgents?: AgentComponentProps[]) => {
  const setName = CONTEXT_DATABASE_SETNAME(agentName) + "-Tables";
  let set = contextSets.find(s => s.setName === setName);
  if (!set) {
    set = { 
      setName,
      lines: [],
      text: "Database tables created or used by this agent.",
      hiddenFromAgents: peerAgents?.map(a => a.name) || [],
    };
    contextSets.push(set);
  }
  
  const lineText = `Table: ${tableName}${namespace ? `, Namespace: ${namespace}`: ''}`;
  if (!set.lines?.some(l => l.content === lineText)) {
    set.lines?.push({ content: lineText, id: new Date().getTime().toString() });
  }
  return contextSets;
}

export const AGENT_TOOLS_DIRECTIVE_DATABASE = () => {
  return `
  <AGENT_DATABASE_INFORMATION>
  You have access to a persistent database specific to you and the current user.
  
  **General Key-Value Storage:**
  Use DB_storeData, DB_getData, DB_queryData, DB_deleteData, and DB_listKeys for flexible data storage.
  - Keys are unique within your namespace for this user.
  - You can optionally use groupIdentifier and itemIdentifier for better organization.
  
  **Virtual Table Storage:**
  For structured data, you can create virtual tables.
  - Use DB_createTable to define a table with a schema (column names, types).
  - Use DB_insertRecord, DB_getRecord, DB_updateRecord, DB_deleteRecord to interact with rows.
  - Use DB_listTables and DB_getTableSchema to manage tables.
  - Table names are automatically namespaced to you and the user.
  - WHERE clauses use standard SQL syntax (e.g., \"name = 'value' AND count > 10\"). Use column names from the schema. Be precise and careful with WHERE clauses, especially for DELETE and UPDATE.

  Always ensure data being stored or used in queries is properly formatted (e.g., strings quoted in WHERE clauses).
  </AGENT_DATABASE_INFORMATION>
  `;
}; 