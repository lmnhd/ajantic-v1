"use server";

import { logger } from "@/src/lib/logger";
import mammoth from "mammoth";
import { read, utils } from "xlsx";
import { htmlToText } from "html-to-text";
import pdfParse from "pdf-parse";

export const TOOLFUNCTION_parseFile = async (
  fileContent: Buffer,
  fileType: string
): Promise<string> => {
  try {
    switch (fileType.toLowerCase()) {
      case "pdf":
         const pdfData = await pdfParse(fileContent);
         return pdfData.text;
        //return "This is a test response";

      case "docx":
        const docxResult = await mammoth.extractRawText({
          buffer: fileContent,
        });
        return docxResult.value;

      case "xlsx":
      case "xls":
        const workbook = read(fileContent);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        return utils.sheet_to_json(worksheet, { header: 1 }).join("\n");

      case "html":
        return htmlToText(fileContent.toString(), {
          wordwrap: false,
          preserveNewlines: true,
        });

      case "txt":
        return fileContent.toString();

      default:
        return `Unsupported file type: ${fileType}`;
    }
  } catch (error) {
    logger.error(`TOOLFUNCTION_parseFile error: ${error}`, {
      fileType,
      error,
    });
    return JSON.stringify({
      error: true,
      details: `File parsing failed - Error occurred while parsing ${fileType} file`,
    });
  }
};