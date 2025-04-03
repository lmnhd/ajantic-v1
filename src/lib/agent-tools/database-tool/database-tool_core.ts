"use server";


import { logger } from "@/src/lib/logger";
import { 
  SERVER_storeGeneralPurposeData, 
  SERVER_getGeneralPurposeDataSingle, 
  SERVER_getGeneralPurposeDataMany,
  SERVER_deleteGeneralPurposeData
} from "@/src/lib/server";

import { GeneralPurpose } from "@prisma/client";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";
import { UTILS_jsonToXmlString } from "@/src/lib/teams/lib/teams-utils";
import { db } from "@/src/lib/db";
import { Prisma } from "@prisma/client";




/**
 * Creates a set of database tools for agents to safely store and retrieve data
 * using the GeneralPurpose table in the database.
 */


// Placeholder for Tool type - replace with actual type from your schema
interface Tool {
    id: number;
    name: string;
    description: string;
    parameters: Prisma.JsonValue;
    executeFunction: string; // Placeholder for the function body or identifier
    agentName: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

// AGENT_TOOLS_EMULATOR version for the database tools
export const AGENT_TOOLS_EMULATOR_database = async (
  userId: string,
  agentName: string
) => {
  return [
    {
      name: "DB_storeData",
      description: "Store data in the database",
      parameters: [
        {
          name: "key",
          type: "string",
          description: "A unique identifier for this data entry",
        },
        {
          name: "data",
          type: "string",
          description: "The data to store (will be stringified if needed)",
        },
        {
          name: "namespace",
          type: "string",
          description: "Optional custom namespace to organize data",
        },
        {
          name: "metadata1",
          type: "string",
          description: "Optional metadata field 1",
        },
        {
          name: "metadata2",
          type: "string",
          description: "Optional metadata field 2",
        },
        {
          name: "allowMultiple",
          type: "boolean",
          description: "If true, allows multiple entries with the same key",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_storeData", parameters);
        return JSON.stringify({
          success: true,
          message: `Data stored successfully with key: ${parameters.key}`
        });
      },
    },
    {
      name: "DB_getData",
      description: "Retrieve data from the database by key",
      parameters: [
        {
          name: "key",
          type: "string",
          description: "The unique identifier for the data entry",
        },
        {
          name: "namespace",
          type: "string",
          description: "Optional custom namespace",
        },
        {
          name: "metadata1",
          type: "string",
          description: "Optional metadata field 1 to filter by",
        },
        {
          name: "metadata2",
          type: "string",
          description: "Optional metadata field 2 to filter by",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_getData", parameters);
        return JSON.stringify({
          success: true,
          data: { sample: "data" },
          metadata: {
            meta1: "sample meta1",
            meta2: "sample meta2",
            userId: userId, // Include userId in response
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      },
    },
    {
      name: "DB_queryData",
      description: "Query multiple data entries from the database",
      parameters: [
        {
          name: "namespace",
          type: "string",
          description: "Namespace to query",
        },
        {
          name: "metadata1",
          type: "string",
          description: "Optional metadata field 1 to filter by",
        },
        {
          name: "metadata2",
          type: "string",
          description: "Optional metadata field 2 to filter by",
        },
        {
          name: "limit",
          type: "number",
          description: "Maximum number of results to return",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_queryData", parameters);
        return JSON.stringify({
          success: true,
          results: [
            {
              key: "sample1",
              data: { sample: "data1" },
              metadata: {
                meta1: "sample meta1",
                meta2: "sample meta2",
                userId: userId, // Include userId in metadata
                createdAt: new Date(),
                updatedAt: new Date(),
                id: 1
              }
            }
          ],
          count: 1
        });
      },
    },
    {
      name: "DB_deleteData",
      description: "Delete data from the database by ID",
      parameters: [
        {
          name: "id",
          type: "number",
          description: "The ID of the data entry to delete",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_deleteData", parameters);
        return JSON.stringify({
          success: true,
          message: `Data with ID ${parameters.id} deleted successfully`
        });
      },
    },
    {
      name: "DB_createTable",
      description: "Create a virtual table schema in the database",
      parameters: [
        {
          name: "tableName",
          type: "string",
          description: "The name of the virtual table to create",
        },
        {
          name: "schema",
          type: "string",
          description: "JSON schema definition for the virtual table",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_createTable", parameters);
        return JSON.stringify({
          success: true,
          message: `Virtual table schema "${parameters.tableName}" created successfully`
        });
      },
    },
    {
      name: "DB_insertRow",
      description: "Insert a row into a virtual table",
      parameters: [
        {
          name: "tableName",
          type: "string",
          description: "The name of the virtual table",
        },
        {
          name: "data",
          type: "string",
          description: "The data to insert (should match the table schema)",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_insertRow", parameters);
        return JSON.stringify({
          success: true,
          message: `Row inserted successfully into "${parameters.tableName}"`,
          rowId: `row_${Date.now()}`
        });
      },
    },
    {
      name: "DB_queryTable",
      description: "Query rows from a virtual table",
      parameters: [
        {
          name: "tableName",
          type: "string",
          description: "The name of the virtual table",
        },
        {
          name: "limit",
          type: "number",
          description: "Maximum number of results to return",
        },
      ],
      execute: async (parameters: Record<string, any>) => {
        console.log("AGENT_FUNCTION: DB_queryTable", parameters);
        return JSON.stringify({
          success: true,
          tableName: parameters.tableName,
          rows: [
            {
              rowId: "sample_row_1",
              data: { sample: "data" },
              userId: userId, // Include userId in rows
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          count: 1
        });
      },
    },
  ];
};

export const AGENT_TOOLS_HELPER_getTableKeys = async (agentName: string, userId: string, tableName: string) => {
  const results = await db.generalPurpose.findMany({
      where: {
        meta3: userId,
        name: {
          startsWith: tableName
        }
      }
    })
    return results
}
// get all the keys from the database for this agent
export const AGENT_TOOLS_HELPER_getAgentDatabaseKeys = async (agentName: string, userId: string) => {
  try {
      const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
      const tableNamespace = dbTool.generateNamespace();
      // get all the keys from the database for this agent
      const results: GeneralPurpose[] = await db.generalPurpose.findMany({
        where: {
          meta3: userId,
          name: {
            startsWith: tableNamespace
          }
        }
      })
      // Use Set to ensure unique keys
      const uniqueKeys = new Set(results.map(result => result.name.split(":")[1]));
      return Array.from(uniqueKeys).join(", ")
  } catch (error) {
      logger.error("Error getting agent database keys", {
          error: (error as Error).message
      })
      return `Error getting agent database keys: ${(error as Error).message}`
  }
}

// get all database keys based on groupIdentifier
export const AGENT_TOOLS_HELPER_getAgentDatabaseKeysByGroupIdentifier = async (agentName: string, userId: string, groupIdentifier: string) => {
  try {
      const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
      const tableNamespace = dbTool.generateNamespace();
      const results: GeneralPurpose[] = await db.generalPurpose.findMany({
        where: {
          meta3: userId,
          meta1: groupIdentifier
        }
      })
      return results.map(result => result.name.split(":")[1]).join(", ")
  } catch (error) {
      logger.error("Error getting agent database keys by identifier", {
          error: (error as Error).message
      })
  }
}

// get all database keys based on itemIdentifier
export const AGENT_TOOLS_HELPER_getAgentDatabaseItemsByGroupIdentifier = async (agentName: string, userId: string, groupIdentifier: string) => {
  try {
      const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
      const tableNamespace = dbTool.generateNamespace();
      const results: GeneralPurpose[] = await db.generalPurpose.findMany({
        where: {
          name: {
            startsWith: tableNamespace
          },
          meta3: userId,
          meta1: `GRP:${groupIdentifier}`
        }
      })
      return results.map(result => result.name.split(":")[1]).join(", ")
  } catch (error) {
      logger.error("Error getting agent database items by group identifier", {
          error: (error as Error).message
      })
  }
}

// get all groupIdentifiers
export const AGENT_TOOLS_HELPER_getAgentDatabaseGroupIdentifiers = async (agentName: string, userId: string) => {
  const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
  const tableNamespace = dbTool.generateNamespace();
  const results = await db.generalPurpose.findMany({
    where: {
      meta3: userId,
      meta1: {
          contains: "GRP:"
      }
    },
    select: {
      meta1: true
    }
    
  })
  if(results.length === 0) {
    return "---"
  } else {
    return results.filter(result => result.meta1 !== null && result.meta1 !== "").map(result => result.meta1.split(":")[1]).join(", ")
  }
}

// get all tablenames
export const AGENT_TOOLS_HELPER_getAgentDatabaseTableNames = async (agentName: string, userId: string) => {
  const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
  const tableNamespace = dbTool.generateNamespace();
  const results: GeneralPurpose[] = await db.generalPurpose.findMany({
    where: {
      meta3: userId,
      name: {
        startsWith: tableNamespace
      }
    }
  })
  return results.map(result => result.name.split(":")[0]).join(", ")
}

export const retrieveAgentCustomTable = async (tableName: string, userId: string, limit: number) => {
  const results = await db.generalPurpose.findMany({
    where: {
      meta1: {
        equals: tableName
      },
      meta3: userId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  })
  return results
}

export const checkIfTableExists = async (tableName: string, userId: string) => {
  const results = await db.generalPurpose.findFirst({
    where: {
      meta1: {
        equals: tableName
      },
      meta3: userId
    }
  })
  return results ? true : false
}


// All in one function to get all keys, tablenames and groupIdentifiers   
export const AGENT_TOOLS_HELPER_getAgentDatabaseAll = async (agentName: string, userId: string) => {
  const keys = await AGENT_TOOLS_HELPER_getAgentDatabaseKeys(agentName, userId)
  const groupIdentifiers = await AGENT_TOOLS_HELPER_getAgentDatabaseGroupIdentifiers(agentName, userId)
  const tablenames = await AGENT_TOOLS_HELPER_getAgentDatabaseTableNames(agentName, userId)

  return `
  <AGENT_DATABASE_INFORMATION>
      Your database items: ${await UTILS_jsonToXmlString({ DataKeys:keys, GroupIdentifiers:groupIdentifiers, TableNames:tablenames })}
  </AGENT_DATABASE_INFORMATION>`
}

// --- Moved Helper ---
export const TOOLFUNCTION_agentDatabase = async (userId: string, agentName: string) => {
  return {
    generateNamespace: (customNamespace?: string) => {
      const baseNamespace = `${agentName}_${customNamespace}` || `${agentName}`;
      // Ensure DYNAMIC_NAMES is accessible or reimplement namespace generation
      return DYNAMIC_NAMES.namespace_generic(userId, baseNamespace);
    },
    stringifyResponse: (response: any): string => {
      // Ensure consistent stringification, handle potential circular refs if necessary
      try {
        return JSON.stringify(response);
      } catch (e) {
        logger.error("Failed to stringify DB response", { error: e });
        return JSON.stringify({ success: false, error: "Failed to stringify response" });
      }
    }
  }
}

// --- CORE Logic Functions --- 

export const CORE_storeData = async (
    userId: string, 
    agentName: string, 
    params: { key: string; data: string; groupIdentifier?: string; itemIdentifier?: string; allowMultiple?: boolean }
): Promise<{ success: boolean; message?: string; error?: string; key: string; namespace: string; groupIdentifier?: string; itemIdentifier?: string }> => {
    const { key, data, groupIdentifier, itemIdentifier, allowMultiple } = params;
    const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
    const dbNamespace = dbTool.generateNamespace();
    const meta1 = groupIdentifier ? `GRP:${groupIdentifier}` : "";
    const meta2 = itemIdentifier ? `ITM:${itemIdentifier}` : "";
    const multiples = allowMultiple || false;

    logger.tool("CORE: Storing data in database", {
        agent: agentName,
        namespace: dbNamespace,
        key
    });

    try {
        await SERVER_storeGeneralPurposeData(
            data,
            meta1,
            meta2,
            userId, // Store userId in meta3
            `${dbNamespace}:${key}`,
            multiples
        );
        logger.tool("CORE: Database Storage Complete", { namespace: dbNamespace, key, success: true });
        return {
            success: true,
            message: `Data stored successfully with key: ${key} in namespace: ${dbNamespace}`,
            key, 
            namespace: dbNamespace, 
            groupIdentifier, 
            itemIdentifier
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown storage error";
        logger.error("CORE: Database Storage Error", { namespace: dbNamespace, key, error: errorMsg });
        return { success: false, error: `Failed to store data: ${errorMsg}`, key, namespace: dbNamespace };
    }
};

export const CORE_getData = async (
    userId: string, 
    agentName: string, 
    params: { key: string; groupIdentifier?: string; itemIdentifier?: string }
): Promise<{ success: boolean; data?: any; metadata?: any; error?: string; key: string; namespace: string }> => {
    const { key, groupIdentifier, itemIdentifier } = params;
    const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
    const dbNamespace = dbTool.generateNamespace();
    const meta1 = groupIdentifier ? `GRP:${groupIdentifier}` : "";
    const meta2 = itemIdentifier ? `ITM:${itemIdentifier}` : "";

    logger.tool("CORE: Retrieving data from database", {
        agent: agentName,
        namespace: dbNamespace,
        key
    });

    try {
        const result = await SERVER_getGeneralPurposeDataSingle(
            `${dbNamespace}:${key}`,
            meta1,
            meta2,
            userId // Use userId as meta3
        );

        if (!result || result.id === 0) {
            logger.tool("CORE: Database Retrieval - Not Found", { namespace: dbNamespace, key });
            return { success: false, error: `No data found with key: ${key} in namespace: ${dbNamespace}`, key, namespace: dbNamespace };
        }

        logger.tool("CORE: Database Retrieval Complete", { namespace: dbNamespace, key, success: true });
        
        let parsedContent;
        try { 
            parsedContent = JSON.parse(result.content); 
        } catch { 
            parsedContent = result.content; 
        }

        return {
            success: true,
            data: parsedContent,
            metadata: {
                groupIdentifier: result.meta1?.startsWith('GRP:') ? result.meta1.substring(4) : result.meta1,
                itemIdentifier: result.meta2?.startsWith('ITM:') ? result.meta2.substring(4) : result.meta2,
                userId: result.meta3,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                id: result.id // Include ID if needed for deletion
            },
            key, 
            namespace: dbNamespace
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown retrieval error";
        logger.error("CORE: Database Retrieval Error", { namespace: dbNamespace, key, error: errorMsg });
        return { success: false, error: `Failed to retrieve data: ${errorMsg}`, key, namespace: dbNamespace };
    }
};

export const CORE_queryData = async (
    userId: string, 
    agentName: string, 
    params: { namespace?: string; metadata1?: string; metadata2?: string; limit?: number }
): Promise<{ success: boolean; results?: any[]; count?: number; error?: string }> => {
    const { namespace, metadata1, metadata2, limit } = params;
    const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
    const dbNamespace = dbTool.generateNamespace(namespace);
    const meta1 = metadata1 ? `GRP:${metadata1}` : "";
    const meta2 = metadata2 ? `ITM:${metadata2}` : "";
    const resultLimit = limit || 10;

    logger.tool("CORE: Querying database", {
        agent: agentName,
        namespace: dbNamespace,
        filter: { metadata1: meta1, metadata2: meta2 },
        limit: resultLimit
    });

    try {
        const results = await SERVER_getGeneralPurposeDataMany(
            dbNamespace,
            meta1,
            meta2,
            userId, // Use userId as meta3 for querying
            resultLimit
        );
        logger.tool("CORE: Database Query Complete", { namespace: dbNamespace, resultsCount: results.length, success: true });

        const processedResults = results.map(item => {
            const key = item.name.startsWith(`${dbNamespace}:`) ? item.name.substring(dbNamespace.length + 1) : item.name;
            let data;
            try { data = JSON.parse(item.content); } catch { data = item.content; }
            return {
                key,
                data,
                metadata: {
                    groupIdentifier: item.meta1?.startsWith('GRP:') ? item.meta1.substring(4) : item.meta1,
                    itemIdentifier: item.meta2?.startsWith('ITM:') ? item.meta2.substring(4) : item.meta2,
                    userId: item.meta3,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    id: item.id
                }
            };
        });

        return { success: true, results: processedResults, count: processedResults.length };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown query error";
        logger.error("CORE: Database Query Error", { namespace: dbNamespace, error: errorMsg });
        return { success: false, error: `Failed to query data: ${errorMsg}` };
    }
};

export const CORE_deleteData = async (
    userId: string, 
    agentName: string, 
    params: { key: string; groupIdentifier?: string; itemIdentifier?: string }
): Promise<{ success: boolean; message?: string; error?: string }> => {
    const { key, groupIdentifier, itemIdentifier } = params;
    const dbTool = await TOOLFUNCTION_agentDatabase(userId, agentName);
    const dbNamespace = dbTool.generateNamespace();
    const meta1 = groupIdentifier ? `GRP:${groupIdentifier}` : "";
    const meta2 = itemIdentifier ? `ITM:${itemIdentifier}` : "";

    logger.tool("CORE: Deleting data from database", {
        agent: agentName,
        namespace: dbNamespace,
        key
    });

    try {
        // First, find the record to get its ID
        const record = await SERVER_getGeneralPurposeDataSingle(
            `${dbNamespace}:${key}`,
            meta1,
            meta2,
            userId
        );

        if (!record || record.id === 0) {
            logger.tool("CORE: Database Delete - Not Found", { namespace: dbNamespace, key });
            return { success: false, error: `No data found with key: ${key} to delete.` };
        }

        // Then delete by ID
        await SERVER_deleteGeneralPurposeData(record.id);
        logger.tool("CORE: Database Delete Complete", { namespace: dbNamespace, key, id: record.id, success: true });
        return { success: true, message: `Data with key ${key} (ID: ${record.id}) deleted successfully.` };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown delete error";
        logger.error("CORE: Database Delete Error", { namespace: dbNamespace, key, error: errorMsg });
        return { success: false, error: `Failed to delete data: ${errorMsg}` };
    }
};

// --- CORE Table Functions ---

const sanitizeIdentifier = (name: string): string => {
    // Remove or replace characters unsafe for SQL identifiers
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
};

const getFullTableName = (userId: string, agentName: string, tableName: string): string => {
    // Create a unique, sanitized table name
    return `agent_${sanitizeIdentifier(userId)}_${sanitizeIdentifier(agentName)}_${sanitizeIdentifier(tableName)}`;
};

const mapTypeToSql = (type: string): string => {
    switch(type.toLowerCase()) {
        case 'string': return 'TEXT';
        case 'number': return 'REAL'; // Use REAL for broader number compatibility (includes integers and floats)
        case 'integer': return 'INTEGER';
        case 'boolean': return 'INTEGER'; // Store booleans as 0 or 1
        case 'date': return 'TEXT'; // Store dates as ISO strings
        case 'object':
        case 'array': return 'TEXT'; // Store JSON as text
        default: return 'TEXT';
    }
}

export const CORE_createTable = async (
    userId: string, 
    agentName: string, 
    params: { tableName: string; schema: { name: string; type: string; isPrimaryKey?: boolean; isUnique?: boolean }[] }
): Promise<{ success: boolean; message?: string; error?: string; tableName: string }> => {
    const { tableName, schema } = params;
    const fullTableName = getFullTableName(userId, agentName, tableName);

    logger.tool("CORE: Creating virtual table", { agent: agentName, tableName: fullTableName });

    try {
        const tableExists = await checkIfTableExists(fullTableName, userId); // Pass userId if needed by check
        if (tableExists) {
            logger.warn("CORE: Table already exists", { tableName: fullTableName });
            return { success: false, error: `Table "${tableName}" already exists.`, tableName };
        }

        if (!schema || schema.length === 0) {
            return { success: false, error: "Schema must contain at least one field.", tableName };
        }

        const fieldDefinitions = schema.map(field => {
            const sqlName = sanitizeIdentifier(field.name);
            const sqlType = mapTypeToSql(field.type);
            let constraints = '';
            if (field.isPrimaryKey) constraints += ' PRIMARY KEY';
            if (field.isUnique) constraints += ' UNIQUE';
            // Add NOT NULL constraint if desired, maybe based on a field property?
            // constraints += ' NOT NULL'; 
            return `${sqlName} ${sqlType}${constraints}`;
        }).join(', ');

        const createTableSql = `CREATE TABLE "${fullTableName}" (${fieldDefinitions});`;
        
        await db.$executeRawUnsafe(createTableSql);

        // Optionally, store schema metadata in GeneralPurpose table for later retrieval?

        logger.tool("CORE: Virtual Table Created Successfully", { tableName: fullTableName, success: true });
        return { success: true, message: `Table "${tableName}" created successfully.`, tableName };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown table creation error";
        logger.error("CORE: Virtual Table Creation Error", { tableName: fullTableName, error: errorMsg });
        return { success: false, error: `Failed to create table: ${errorMsg}`, tableName };
    }
};

export const CORE_insertRecord = async (
    userId: string, 
    agentName: string, 
    params: { tableName: string; data: Record<string, any> }
): Promise<{ success: boolean; message?: string; error?: string; rowId?: number | string }> => {
    const { tableName, data } = params;
    const fullTableName = getFullTableName(userId, agentName, tableName);

    logger.tool("CORE: Inserting record into virtual table", { agent: agentName, tableName: fullTableName });

    try {
        const columns = Object.keys(data).map(sanitizeIdentifier);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(data).map(val => 
            typeof val === 'object' ? JSON.stringify(val) : 
            typeof val === 'boolean' ? (val ? 1 : 0) : val
        );

        const insertSql = `INSERT INTO \"${fullTableName}\" (${columns.map(c => `\"${c}\"`).join(', ')}) VALUES (${placeholders}) RETURNING rowid;`; 
        
        // Use queryRaw to get the rowid back, adjust if using non-SQLite DB
        const result = await db.$queryRawUnsafe<Array<{ rowid: number }>>(insertSql, ...values);

        const rowId = result?.[0]?.rowid;

        logger.tool("CORE: Record Inserted Successfully", { tableName: fullTableName, rowId, success: true });
        return { success: true, message: `Record inserted successfully into ${tableName}.`, rowId };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown record insertion error";
        logger.error("CORE: Record Insertion Error", { tableName: fullTableName, error: errorMsg });
        return { success: false, error: `Failed to insert record: ${errorMsg}` };
    }
};

export const CORE_getRecord = async (
    userId: string, 
    agentName: string, 
    params: { tableName: string; whereClause: string; limit?: number }
): Promise<{ success: boolean; results?: any[]; count?: number; error?: string }> => {
    const { tableName, whereClause, limit = 10 } = params;
    const fullTableName = getFullTableName(userId, agentName, tableName);

    logger.tool("CORE: Getting records from virtual table", { agent: agentName, tableName: fullTableName, where: whereClause, limit });

    try {
        // Basic sanitization/validation of whereClause is CRUCIAL here to prevent SQL injection
        // This is a simplified example and likely insufficient for production
        if (!whereClause || whereClause.match(/;|--|\*\/|\/\*/)) { 
             throw new Error("Invalid characters in where clause.");
        }
        // More robust validation/parsing is needed here.
        // Consider allowing only simple key=value pairs or using a query builder.

        const selectSql = `SELECT * FROM "${fullTableName}" WHERE ${whereClause} LIMIT ${limit};`; 
        
        const results = await db.$queryRawUnsafe<any[]>(selectSql);

        // Attempt to parse JSON fields (assuming TEXT columns store JSON)
        const processedResults = results.map(row => {
            const newRow = { ...row };
            for (const key in newRow) {
                if (typeof newRow[key] === 'string') {
                    try {
                        const parsed = JSON.parse(newRow[key]);
                        // Only replace if it's an object or array (not just a stringified primitive)
                        if (typeof parsed === 'object' && parsed !== null) {
                            newRow[key] = parsed;
                        }
                    } catch { /* Ignore if not valid JSON */ }
                }
                // Convert INTEGER booleans back
                 if (typeof newRow[key] === 'number' && (newRow[key] === 0 || newRow[key] === 1)) {
                     // This is ambiguous, need schema info to know if it *was* a boolean
                     // For simplicity, leave as number for now
                 }
            }
            return newRow;
        });

        logger.tool("CORE: Records Retrieved Successfully", { tableName: fullTableName, count: processedResults.length, success: true });
        return { success: true, results: processedResults, count: processedResults.length };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown record retrieval error";
        logger.error("CORE: Record Retrieval Error", { tableName: fullTableName, where: whereClause, error: errorMsg });
        return { success: false, error: `Failed to retrieve records: ${errorMsg}` };
    }
};

export const CORE_updateRecord = async (
    userId: string, 
    agentName: string, 
    params: { tableName: string; data: Record<string, any>; whereClause: string; }
): Promise<{ success: boolean; message?: string; error?: string; changes?: number }> => {
    const { tableName, data, whereClause } = params;
    const fullTableName = getFullTableName(userId, agentName, tableName);

    logger.tool("CORE: Updating record(s) in virtual table", { agent: agentName, tableName: fullTableName, where: whereClause });

    try {
        if (!whereClause || whereClause.match(/;|--|\*\/|\/\*/)) { 
             throw new Error("Invalid characters in where clause.");
        }
        // CRUCIAL: Add more robust validation/parsing for whereClause
        
        const columns = Object.keys(data).map(sanitizeIdentifier);
        const setClauses = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
        const values = Object.values(data).map(val => 
            typeof val === 'object' ? JSON.stringify(val) : 
            typeof val === 'boolean' ? (val ? 1 : 0) : val
        );

        const updateSql = `UPDATE "${fullTableName}" SET ${setClauses} WHERE ${whereClause};`;

        // $executeRawUnsafe returns the number of affected rows
        const changes = await db.$executeRawUnsafe(updateSql, ...values);

        logger.tool("CORE: Record Update Successful", { tableName: fullTableName, changes, success: true });
        return { success: true, message: `${changes} record(s) updated successfully in ${tableName}.`, changes };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown record update error";
        logger.error("CORE: Record Update Error", { tableName: fullTableName, where: whereClause, error: errorMsg });
        return { success: false, error: `Failed to update record(s): ${errorMsg}` };
    }
};

export const CORE_deleteRecord = async (
    userId: string, 
    agentName: string, 
    params: { tableName: string; whereClause: string; }
): Promise<{ success: boolean; message?: string; error?: string; changes?: number }> => {
    const { tableName, whereClause } = params;
    const fullTableName = getFullTableName(userId, agentName, tableName);

    logger.tool("CORE: Deleting record(s) from virtual table", { agent: agentName, tableName: fullTableName, where: whereClause });

    try {
        if (!whereClause || whereClause.match(/;|--|\*\/|\/\*/)) { 
             throw new Error("Invalid characters in where clause.");
        }
        // CRUCIAL: Add more robust validation/parsing for whereClause

        const deleteSql = `DELETE FROM "${fullTableName}" WHERE ${whereClause};`;

        const changes = await db.$executeRawUnsafe(deleteSql);

        logger.tool("CORE: Record Deletion Successful", { tableName: fullTableName, changes, success: true });
        return { success: true, message: `${changes} record(s) deleted successfully from ${tableName}.`, changes };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown record deletion error";
        logger.error("CORE: Record Deletion Error", { tableName: fullTableName, where: whereClause, error: errorMsg });
        return { success: false, error: `Failed to delete record(s): ${errorMsg}` };
    }
};

export const CORE_listTables = async(
    userId: string,
    agentName: string
): Promise<{ success: boolean; tables?: string[]; error?: string }> => {
    logger.tool("CORE: Listing virtual tables", { agent: agentName, userId });
    try {
        // Use Prisma introspection or query information schema
        // Example for SQLite:
        const results = await db.$queryRawUnsafe<Array<{ name: string }>>(
            `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?;`,
            `agent_${sanitizeIdentifier(userId)}_${sanitizeIdentifier(agentName)}_%`
        );
        const tables = results.map(row => row.name.split('_').slice(3).join('_')); // Extract original name
        logger.tool("CORE: List Tables Successful", { count: tables.length, success: true });
        return { success: true, tables };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown list tables error";
        logger.error("CORE: List Tables Error", { error: errorMsg });
        return { success: false, error: `Failed to list tables: ${errorMsg}` };
    }
};

export const CORE_getTableSchema = async(
    userId: string,
    agentName: string,
    params: { tableName: string }
): Promise<{ success: boolean; schema?: any; error?: string }> => {
    const { tableName } = params;
    const fullTableName = getFullTableName(userId, agentName, tableName);
    logger.tool("CORE: Getting virtual table schema", { agent: agentName, tableName: fullTableName });
    try {
        // Example for SQLite:
        const results = await db.$queryRawUnsafe<Array<{ name: string; type: string; pk: number }>>(
            `PRAGMA table_info("${fullTableName}");`
        );
        if (results.length === 0) {
            return { success: false, error: `Table "${tableName}" not found.` };
        }
        // Convert SQLite types back to simpler types if needed
        const schema = results.map(col => ({ 
            name: col.name, 
            type: col.type, // Maybe map back: TEXT -> string, REAL -> number, INTEGER -> integer/boolean?
            isPrimaryKey: col.pk > 0 
        }));
        logger.tool("CORE: Get Table Schema Successful", { tableName: fullTableName, success: true });
        return { success: true, schema };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown get schema error";
        logger.error("CORE: Get Table Schema Error", { tableName: fullTableName, error: errorMsg });
        return { success: false, error: `Failed to get schema for table ${tableName}: ${errorMsg}` };
    }
};

