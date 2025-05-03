import puppeteer from "puppeteer-core";
import { createSession } from "@/src/lib/agent-tools/puppeteer-tool/puppeteer_core";

declare global {
    var puppeteer_client: puppeteer.Browser | undefined
    var puppeteer_page: puppeteer.Page | undefined
    var puppeteer_initializing: boolean | undefined
}

const _getPuppeteerClient = async (browserBaseOrLocal: string) => {
    if (browserBaseOrLocal === "browserbase") {
        const sessionId = await createSession();
        const wsUrl = `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`;
        console.log("[Puppeteer Client] Connecting to Browserbase...");
        return puppeteer.connect({ browserURL: wsUrl, defaultViewport: null });
    } else {
        const findChrome = require('chrome-finder');
        let executablePath: string | undefined;
        try {
            executablePath = findChrome();
            console.log("[Puppeteer Client] Found local Chrome:", executablePath);
        } catch (error) {
            console.error('[Puppeteer Client] Could not find local Chrome installation:', error);
        }
        console.log("[Puppeteer Client] Launching local Puppeteer...");
        return puppeteer.launch({
            executablePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
}

export const GLOBAL_getPuppeteerClient = async (browserBaseOrLocal: string): Promise<puppeteer.Browser> => {
    console.log("GLOBAL_getPuppeteerClient called");
    
    while (globalThis.puppeteer_initializing) {
        console.log("[Puppeteer Client] Waiting for initialization lock...");
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (globalThis.puppeteer_client && globalThis.puppeteer_page) {
        try {
            await globalThis.puppeteer_page.title();
            console.log("[Puppeteer Client] Using existing connected instance.");
            return globalThis.puppeteer_client;
        } catch (error) {
            console.log("[Puppeteer Client] Existing instance disconnected.");
            globalThis.puppeteer_client = undefined;
            globalThis.puppeteer_page = undefined;
        }
    }

    console.log("[Puppeteer Client] Acquiring initialization lock...");
    globalThis.puppeteer_initializing = true;

    try {
        console.log("[Puppeteer Client] No valid instance found, creating new one...");
        const newClient = await _getPuppeteerClient(browserBaseOrLocal);
        console.log("[Puppeteer Client] New client created. Creating page...");

        const newPage = await newClient.newPage();
        await newPage.setViewport({ width: 1280, height: 800 });
        console.log("[Puppeteer Client] New page created.");

        newClient.on('disconnected', () => {
            console.log("[Puppeteer Client] Browser disconnected event received.");
            globalThis.puppeteer_client = undefined;
            globalThis.puppeteer_page = undefined;
            globalThis.puppeteer_initializing = false;
        });

        globalThis.puppeteer_client = newClient;
        globalThis.puppeteer_page = newPage;
        console.log("[Puppeteer Client] New instance assigned globally.");
        return newClient;

    } catch (error) {
        console.error("Error during Puppeteer client initialization:", error);
        globalThis.puppeteer_initializing = false;
        throw error;
    } finally {
        console.log("[Puppeteer Client] Releasing initialization lock.");
        globalThis.puppeteer_initializing = false;
    }
}

export const GLOBAL_getPuppeteerPage = async (): Promise<puppeteer.Page> => {
    if (!globalThis.puppeteer_page || !globalThis.puppeteer_client?.isConnected()) {
        console.log("[Puppeteer Page] Page not available or client disconnected, ensuring client is initialized...");
        await GLOBAL_getPuppeteerClient(process.env.NODE_ENV === 'production' ? 'browserbase' : 'local');
        if (!globalThis.puppeteer_page) {
            throw new Error("[Puppeteer Page] Failed to get page even after client initialization attempt.");
        }
        console.log("[Puppeteer Page] Page obtained after client initialization.");
    }
    if (!globalThis.puppeteer_page) {
        throw new Error("[Puppeteer Page] Global page is still not available after checks.");
    }
    return globalThis.puppeteer_page;
}

