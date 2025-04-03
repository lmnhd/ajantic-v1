'use server';

import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { read, utils } from "xlsx";
import { htmlToText } from "html-to-text";
import { logger } from "@/src/lib/logger";

export const CORE_parseFile = async (
  fileContent: Buffer,
  fileType: string
): Promise<string> => {
  try {
    switch (fileType.toLowerCase()) {
      case "pdf":
        logger.tool(`CORE_parseFile pdf: Attempting parse.`);
        const pdfData = await pdfParse(fileContent);
        logger.tool(`CORE_parseFile pdf: Parse successful. Length: ${pdfData.text?.length}`);
        return pdfData.text;

      case "docx":
        logger.tool(`CORE_parseFile docx: Attempting parse.`);
        const docxResult = await mammoth.extractRawText({
          buffer: fileContent,
        });
        logger.tool(`CORE_parseFile docx: Parse successful. Length: ${docxResult.value?.length}`);
        return docxResult.value;

      case "xlsx":
      case "xls":
        logger.tool(`CORE_parseFile excel: Attempting parse.`);
        const workbook = read(fileContent);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const excelText = utils.sheet_to_json(worksheet, { header: 1 }).join("\n");
        logger.tool(`CORE_parseFile excel: Parse successful. Length: ${excelText?.length}`);
        return excelText;

      case "html":
        logger.tool(`CORE_parseFile html: Attempting parse.`);
        const htmlText = htmlToText(fileContent.toString(), {
          wordwrap: false,
          preserveNewlines: true,
        });
        logger.tool(`CORE_parseFile html: Parse successful. Length: ${htmlText?.length}`);
        return htmlText;

      case "txt":
        logger.tool(`CORE_parseFile txt: Reading content.`);
        const txtContent = fileContent.toString();
        logger.tool(`CORE_parseFile txt: Read successful. Length: ${txtContent?.length}`);
        return txtContent;

      default:
        logger.warn(`CORE_parseFile: Unsupported file type: ${fileType}`);
        return `Unsupported file type: ${fileType}`;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown parsing error";
    logger.error(`CORE_parseFile error: ${errorMsg}`, {
      fileType,
      error,
    });
    // Return a structured error message for the agent
    return JSON.stringify({
      success: false,
      error: `File parsing failed for ${fileType}: ${errorMsg}`,
    });
  }
}; 