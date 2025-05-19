import { AuthConfig, AuthMethod } from './types';
import { FetchedCredentials } from './execution_logic';
import puppeteer, { Page } from 'puppeteer-core'; // Using puppeteer-core
import { GLOBAL_getPuppeteerClient, GLOBAL_getPuppeteerPage } from '../../puppeteer_client';

export interface AuthContext {
  puppeteerPage?: Page; // Changed from any to Page
  authHeaders?: Record<string, string>;
  cookies?: any[]; // puppeteer.Protocol.Network.Cookie[] once fully typed
  error?: string;
  browser?: puppeteer.Browser; // To manage browser instance if launched here
}

/**
 * Performs authentication based on the provided configuration and credentials.
 * Manages a Puppeteer instance if needed for form-based login.
 *
 * @param authConfig The authentication configuration for the tool.
 * @param targetDomain The base domain, potentially used for cookie scoping or navigation.
 * @param credentials The fetched credentials (e.g., username, password, API keys).
 * @param formLoginDetails Optional parameters for form login
 * @returns A Promise resolving to an AuthContext object.
 */
export async function performAuthentication(
  authConfig: AuthConfig,
  targetDomain: string, // Used as a fallback or base for login URLs
  credentials: FetchedCredentials,
  // Optional parameters for form login
  formLoginDetails?: {
    loginUrl: string;
    puppeteerExecutablePath?: string; // For local testing or specific setups
  }
): Promise<AuthContext> {
  console.log(`[AuthHandler] Performing authentication with method: ${authConfig.method} for domain: ${targetDomain}`);

  if (authConfig.method === AuthMethod.NONE) {
    console.log('[AuthHandler] No authentication required.');
    return {}; // No specific context needed for 'none'
  }

  let browser: puppeteer.Browser | null = null;
  let page: Page | null = null;

  try {
    if (authConfig.method === AuthMethod.FORM) {
      if (!formLoginDetails?.loginUrl) {
        return { error: 'Form authentication requires a loginUrl to be provided.' };
      }
      if (!authConfig.formSelector || !authConfig.usernameFieldSelector || !authConfig.passwordFieldSelector || !authConfig.submitButtonSelector) {
        return { error: 'Form authentication selected, but missing one or more required fields from AuthConfig (formSelector, usernameFieldSelector, passwordFieldSelector, submitButtonSelector).' };
      }
      // Correctly find credential names assuming requiredCredentialNames is string[]
      const usernameCredName = authConfig.requiredCredentialNames?.find(name => name.toLowerCase().includes('user') || name.toLowerCase().includes('email'));
      const passwordCredName = authConfig.requiredCredentialNames?.find(name => name.toLowerCase().includes('pass'));

      if (!usernameCredName || !passwordCredName) {
        return { error: 'Form login requires credential names for username and password to be defined in authConfig.requiredCredentialNames.' };
      }
      const username = credentials[usernameCredName];
      const password = credentials[passwordCredName];

      if (!username || !password) {
        return { error: `Missing username (via ${usernameCredName}) or password (via ${passwordCredName}) in credentials for form login.` };
      }

      console.log(`[AuthHandler] Form login: attempting to get browser and navigate to ${formLoginDetails.loginUrl}`);

      // Determine browserBaseOrLocal based on environment for GLOBAL_getPuppeteerClient
      const browserBaseOrLocal = process.env.VERCEL || process.env.NODE_ENV === 'production' ? 'browserbase' : 'local';
      
      // Use the global puppeteer client and page
      // The GLOBAL_getPuppeteerClient will handle specific launch options (like executablePath from @sparticuz/chromium or chrome-finder)
      browser = await GLOBAL_getPuppeteerClient(browserBaseOrLocal);
      // It's generally better to get a fresh page for auth, but GLOBAL_getPuppeteerPage gives the singleton page.
      // If isolation is needed, GLOBAL_getPuppeteerClient should allow creating new pages.
      // For now, let's assume the global page is acceptable or will be correctly managed.
      page = await GLOBAL_getPuppeteerPage(); 
      // Potentially add a check here if page is null or browser is not connected, though GLOBAL_ funcs should handle this.

      await page.goto(formLoginDetails.loginUrl, { waitUntil: 'networkidle2' });
      console.log(`[AuthHandler] Navigated to ${formLoginDetails.loginUrl}`);

      // Wait for the form to be available
      await page.waitForSelector(authConfig.formSelector, { timeout: 10000 });
      console.log('[AuthHandler] Login form found.');

      await page.type(authConfig.usernameFieldSelector, username);
      await page.type(authConfig.passwordFieldSelector, password);
      console.log('[AuthHandler] Filled username and password.');

      await page.click(authConfig.submitButtonSelector);
      console.log('[AuthHandler] Clicked submit button.');

      // Wait for navigation, or a success indicator, or a timeout
      // This is a common point of failure and may need site-specific adjustments
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
        console.log('[AuthHandler] Navigation after login successful.');
      } catch (navError) {
        console.warn('[AuthHandler] waitForNavigation after login timed out or failed. Checking current URL and for login form again.', navError);
        // Check if login form is GONE as an alternative success indicator
        const loginFormStillPresent = await page.$(authConfig.formSelector);
        if (loginFormStillPresent) {
          console.error('[AuthHandler] Login form still present after attempted login.');
          // You might want to grab error messages from the page here
          // Pass the browser instance obtained from GLOBAL_getPuppeteerClient
          return { puppeteerPage: page, cookies: await page.cookies(), browser: browser };
        }
        console.log('[AuthHandler] Login form is no longer present. Assuming login was successful.');
      }
      
      const pageCookies = await page.cookies();
      console.log('[AuthHandler] Form login successful, cookies obtained.');
      // Do not close the browser here if the page object is to be reused by other steps.
      // The browser instance is returned in AuthContext for later cleanup.
      return { puppeteerPage: page, cookies: pageCookies, browser: browser };

    } else if (authConfig.method === AuthMethod.BASIC) {
      // Correctly find credential names assuming requiredCredentialNames is string[]
      const usernameCredName = authConfig.requiredCredentialNames?.find(name => name.toLowerCase().includes('user') || name.toLowerCase().includes('email'));
      const passwordCredName = authConfig.requiredCredentialNames?.find(name => name.toLowerCase().includes('pass'));
      if (!usernameCredName || !passwordCredName) {
        return { error: 'Basic auth requires credential names for username and password.' };
      }
      const username = credentials[usernameCredName];
      const password = credentials[passwordCredName];
      if (!username || !password) {
        return { error: 'Missing username or password for Basic auth.' };
      }
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      return { authHeaders: { 'Authorization': `Basic ${encoded}` } };

    } else if (authConfig.method === AuthMethod.BEARER) {
      const tokenCredName = authConfig.requiredCredentialNames?.[0];
      if (!tokenCredName) {
        return { error: 'Bearer token auth requires a credential name.' };
      }
      const token = credentials[tokenCredName];
      if (!token) {
        return { error: `Missing bearer token (via ${tokenCredName}).` };
      }
      return { authHeaders: { 'Authorization': `Bearer ${token}` } };

    } else if (authConfig.method === AuthMethod.API_KEY) {
      if (!authConfig.apiKeyHeaderName) {
        return { error: 'API Key (Header) auth missing apiKeyHeaderName.' };
      }
      const apiKeyCredName = authConfig.requiredCredentialNames?.[0];
      if (!apiKeyCredName) {
        return { error: 'API Key (Header) auth requires a credential name.' };
      }
      const apiKey = credentials[apiKeyCredName];
      if (!apiKey) {
        return { error: `Missing API key (via ${apiKeyCredName}).` };
      }
      return { authHeaders: { [authConfig.apiKeyHeaderName]: apiKey } };
    }
  } catch (e: any) {
    console.error('[AuthHandler] Error during authentication process:', e);
    // We don't close the global browser here, as it's managed by puppeteer_client.ts
    // if (browser) {
    //   await browser.close(); 
    // }
    return { error: `Authentication process failed: ${e.message}` };
  }
  // This should ideally not be reached if all AuthMethods are handled or have a default case before this.
  // But as a safeguard:
  console.warn(`[AuthHandler] Authentication method "${String(authConfig.method)}" is not explicitly handled or is unknown.`);
  return { error: `Authentication method "${String(authConfig.method)}" not supported or logic incomplete.` };
}

/**
 * Closes the Puppeteer browser instance if it exists in the AuthContext.
 * This should be called after all scraping operations using the Puppeteer page are complete.
 */
export async function closeAuthSession(authContext: AuthContext): Promise<void> {
  if (authContext.browser) {
    try {
      // We should not close the global browser instance here directly.
      // The global instance is managed by puppeteer_client.ts.
      // If a specific auth session *did* create its own temporary browser (which it shouldn't with this pattern),
      // then it would be closed. But since we use the global one, we don't close it here.
      // await authContext.browser.close(); 
      console.log('[AuthHandler] closeAuthSession called. Global browser is not closed by this function.');
    } catch (e) {
      console.error('[AuthHandler] Error in closeAuthSession (attempting to close a browser that should be global):', e);
    }
  }
} 