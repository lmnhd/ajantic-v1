'use server';

import { logger } from '@/src/lib/logger';

export const TOOLFUNCTION_fetch = async (url: string, options: RequestInit = {}) => {
  logger.tool("Fetch Tool - Making Request", { 
    url,
    method: options.method || 'GET',
    hasHeaders: !!options.headers
  });

  try {
    const response = await fetch(url, options);
    logger.tool("Fetch Tool - Response Received", {
      url,
      status: response.status,
      ok: response.ok
    });
    // We should return the text content, not the stringified response object itself
    // Also handle non-ok responses better
    if (!response.ok) {
      const errorText = await response.text();
      logger.tool("Fetch Tool - Request Failed (Non-OK)", {
        url,
        status: response.status,
        errorText: errorText.substring(0, 100) // Log snippet of error text
      });
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const textContent = await response.text();
    logger.tool("Fetch Tool - Request Successful", {
      url,
      contentLength: textContent.length
    });
    return textContent;
  } catch (error) {
    logger.tool("Fetch Tool - Request Error (Catch Block)", {
      url,
      error: (error as Error).message
    });
    // Rethrow or handle as appropriate
    // Consider returning a specific error message instead of throwing
    return `Error fetching ${url}: ${(error as Error).message}`;
  }
}; 