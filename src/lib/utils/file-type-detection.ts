"use server";
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { read, utils } from 'xlsx';
import { htmlToText } from 'html-to-text';

type FileType = 'pdf' | 'docx' | 'xlsx' | 'xls' | 'html' | 'txt' | 'unknown';

export const detectFileType = async (
  buffer: Buffer,
  contentType?: string,
  fileName?: string
): Promise<{ type: FileType; details: string }> => {
  // Check by content-type first
  const typeFromContent = (): FileType => {
    if (!contentType) return 'unknown';
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document')) return 'docx';
    if (contentType.includes('spreadsheetml')) return 'xlsx';
    if (contentType.includes('html')) return 'html';
    return 'unknown';
  };

  // Fallback to file extension
  const typeFromExtension = (): FileType => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'pdf': return 'pdf';
      case 'docx': return 'docx';
      case 'xlsx': return 'xlsx';
      case 'xls': return 'xls';
      case 'html': return 'html';
      case 'txt': return 'txt';
      default: return 'unknown';
    }
  };

  // Final check with magic numbers
  const magicNumberCheck = (): FileType => {
    const header = buffer.subarray(0, 8).toString('hex');
    if (header.startsWith('25504446')) return 'pdf';
    if (header.startsWith('504b0304')) {
      // ZIP header, check for Office formats
      if (buffer.includes(Buffer.from('word/'))) return 'docx';
      if (buffer.includes(Buffer.from('xl/'))) return 'xlsx';
    }
    return 'unknown';
  };

  const detectedType = typeFromContent() || typeFromExtension() || magicNumberCheck();
  return {
    type: detectedType,
    details: `Detected via ${[
      typeFromContent() && 'content-type',
      typeFromExtension() && 'file-extension',
      magicNumberCheck() && 'binary-header'
    ].filter(Boolean).join(', ')}`
  };
};

export const parseContentByType = async (
  buffer: Buffer, 
  detectedType: FileType
): Promise<string> => {
  try {
    switch(detectedType) {
      case 'pdf':
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      case 'docx':
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
      case 'xlsx':
      case 'xls':
        const wb = read(buffer, { type: 'buffer' });
        return utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      case 'html':
        return htmlToText(buffer.toString());
      default:
        return buffer.toString();
    }
  } catch (error) {
    console.error('File parse error:', error);
    return buffer.toString();
  }
}; 