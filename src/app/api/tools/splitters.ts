"use server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const TOOLFUNCTION_split_text = async (text: string, chunkSize: number, chunkOverlap: number) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  return await splitter.createDocuments([text]);
};
