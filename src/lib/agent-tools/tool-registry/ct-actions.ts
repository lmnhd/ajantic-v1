"use server";
import { db } from "../../db";
import { logger } from "../../logger";
import { createCustomToolReference } from "./custom-tool-ref";
import { ToolRegistryEntry } from "./ct-types";
import { Prisma } from "@prisma/client";

export async function CUSTOM_TOOL_registerTool(
  userId: string,
  name: string,
  description: string,
  parameters: any[],
  implementation: string | object,
  implementationType: string,
  metadata: { [key: string]: any },
  acceptedStrategyJson?: string | null,
  requiredCredentialNames?: Array<{ name: string; label: string }> | null
): Promise<string> {
  if (!userId) {
    logger.error("registerTool called without userId", { name });
    throw new Error("User ID is required to register a tool");
  }
  if (metadata?.userId && metadata.userId !== userId) {
    logger.warn("Metadata contained a userId different from the direct parameter during tool registration. Using direct parameter.", { name, directUserId: userId, metadataUserId: metadata.userId });
    metadata.userId = userId;
  } else if (!metadata?.userId) {
    metadata = { ...metadata, userId: userId };
  }

  const finalImplementationString = typeof implementation === 'object' 
    ? JSON.stringify(implementation) 
    : implementation;

  try {
    const tool = await db.customTool.create({
      data: {
        userId,
        name,
        description,
        parameters: JSON.stringify(parameters),
        implementation: finalImplementationString,
        implementationType,
        metadata: JSON.stringify(metadata),
        acceptedStrategyJson: acceptedStrategyJson ?? undefined,
        requiredCredentialNames: requiredCredentialNames ? JSON.stringify(requiredCredentialNames) : null,
        version: 1,
      },
    });
    logger.tool("Registered new tool in registry", { toolId: tool.id, toolName: name, userId: userId });
    return createCustomToolReference(tool.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.error("Failed to register tool: Name already exists for this user", { name, userId });
      throw new Error(`Tool with name "${name}" already exists for this user.`);
    }
    logger.error("Failed to register tool", { name, error, userId });
    throw new Error(`Failed to register tool ${name}: ${ error instanceof Error ? error.message : String(error) }`);
  }
}

export async function CUSTOM_TOOL_updateTool(
  id: string,
  updates: {
    name?: string;
    description?: string;
    parameters?: any[];
    implementation?: string | object;
    implementationType?: string;
    metadata?: { [key: string]: any };
    acceptedStrategyJson?: string | null;
    requiredCredentialNames?: Array<{ name: string; label: string }> | null;
  }
): Promise<string> {
  try {
    const currentTool = await db.customTool.findUnique({ where: { id } });
    if (!currentTool) {
      throw new Error(`Tool with ID ${id} not found`);
    }

    const dataToUpdate: Prisma.CustomToolUpdateInput = {};

    if (updates.name) dataToUpdate.name = updates.name;
    if (updates.description) dataToUpdate.description = updates.description;
    if (updates.parameters) dataToUpdate.parameters = JSON.stringify(updates.parameters);
    
    if (updates.implementation) {
      dataToUpdate.implementation = typeof updates.implementation === 'object'
        ? JSON.stringify(updates.implementation)
        : updates.implementation;
    }
    
    if (updates.implementationType) dataToUpdate.implementationType = updates.implementationType;
    
    if (updates.acceptedStrategyJson !== undefined) {
        dataToUpdate.acceptedStrategyJson = updates.acceptedStrategyJson;
    }

    if (updates.requiredCredentialNames !== undefined) {
        dataToUpdate.requiredCredentialNames = updates.requiredCredentialNames 
            ? JSON.stringify(updates.requiredCredentialNames) 
            : null;
    }

    let finalMetadataString = currentTool.metadata;
    if (updates.metadata) {
       const currentMeta = JSON.parse(currentTool.metadata || '{}');
       const originalUserId = currentMeta.userId;
       const updatedMetaContent = {
            ...currentMeta,
            ...updates.metadata,
            updatedAt: new Date().toISOString()
       };
       if (originalUserId && updatedMetaContent.userId !== originalUserId) {
            updatedMetaContent.userId = originalUserId; 
       }
       finalMetadataString = JSON.stringify(updatedMetaContent);
    }
    dataToUpdate.metadata = finalMetadataString;
    
    dataToUpdate.version = (currentTool.version || 0) + 1;

    const updatedTool = await db.customTool.update({
      where: { id },
      data: dataToUpdate,
    });

    logger.tool("Updated tool in registry", {
      toolId: id,
      toolName: updatedTool.name,
      version: updatedTool.version,
    });

    return createCustomToolReference(id);
  } catch (error) {
    logger.error("Failed to update tool", { id, error });
    throw new Error(
      `Failed to update tool ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function CUSTOM_TOOL_getToolById(
  id: string
): Promise<ToolRegistryEntry | null> {
  try {
    const tool = await db.customTool.findUnique({ where: { id } });
    logger.tool("Retrieved tool by ID", { toolId: id, userId: tool?.userId });
    return tool as any as ToolRegistryEntry | null;
  } catch (error) {
    logger.error("Failed to retrieve tool by ID", { id, error });
    return null;
  }
}

export async function CUSTOM_TOOL_findToolByName(
  name: string,
  userId: string
): Promise<ToolRegistryEntry | null> {
  if (!userId) {
    logger.error("findToolByName called without userId", { name });
    throw new Error("User ID is required to find a tool by name.");
  }
  try {
    const tool = await db.customTool.findUnique({
      where: {
        userId_name: {
            userId: userId,
            name: name
        }
       },
    });
    logger.tool("Attempted to find tool by name for user", { name, userId, found: !!tool });
    return tool as any as ToolRegistryEntry | null;
  } catch (error) {
    logger.error("Failed to find tool by name", { name, userId, error });
    return null;
  }
}

export async function CUSTOM_TOOL_getToolsForUser(
  userId: string
): Promise<ToolRegistryEntry[]> {
  try {
    const tools = await db.customTool.findMany({
      where: {
        userId: userId,
      },
    });
     logger.tool("Retrieved tools for user", { userId, count: tools.length });
    return tools as any as ToolRegistryEntry[];
  } catch (error) {
    logger.error("Failed to retrieve tools for user", { userId, error });
    return [];
  }
}

export async function CUSTOM_TOOL_deleteTool(id: string, requestingUserId: string): Promise<boolean> {
  try {
    await db.customTool.delete({ where: { id } });
    logger.tool("Deleted tool from registry", { toolId: id });
    return true;
  } catch (error) {
    logger.error("Failed to delete tool", { id, error });
    return false;
  }
}

export async function CUSTOM_TOOL_listAllTools(userId: string): Promise<ToolRegistryEntry[]> {
  if (!userId) {
    logger.error("listAllTools called without userId");
    throw new Error("User ID is required to list tools.");
  }
  try {
    const tools = await db.customTool.findMany({ where: { userId: userId } });
    logger.tool("Listed tools for user", { userId: userId, count: tools.length });
    return tools as any as ToolRegistryEntry[];
  } catch (error) {
    logger.error("Failed to list tools", { userId, error });
    return [];
  }
}
