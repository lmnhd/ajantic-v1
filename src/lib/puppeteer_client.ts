import puppeteer from "puppeteer-core";
import { createSession } from "./agent-tools/browserbase";

declare global {
    var puppeteer_client: puppeteer.Browser | undefined
    var puppeteer_page: puppeteer.Page | undefined
}

const _getPuppeteerClient = async (browserBaseOrLocal: string) => {
    if (browserBaseOrLocal === "browserbase") {
        const sessionId = await createSession();
        const wsUrl = `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`;
        return puppeteer.connect({ browserURL: wsUrl });
    } else {
        const findChrome = require('chrome-finder');
        try {
            const executablePath = findChrome();
            console.log("Executable path:", executablePath);
            return puppeteer.launch({ 
                executablePath,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        } catch (error) {
            console.error('Could not find Chrome installation:', error);
            return puppeteer.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }
}

export const GLOBAL_getPuppeteerClient = async (browserBaseOrLocal: string): Promise<puppeteer.Browser> => {
    console.log("GLOBAL_getPuppeteerClient called");
    
    try {
        // Check if existing client and page are still connected
        if (globalThis.puppeteer_client && globalThis.puppeteer_page) {
            try {
                // Test if the browser and page are still responsive
                await globalThis.puppeteer_page.title();
                console.log("Using existing puppeteer client and page");
                return globalThis.puppeteer_client;
            } catch (error) {
                console.log("Existing client/page disconnected, creating new ones");
                globalThis.puppeteer_client = undefined;
                globalThis.puppeteer_page = undefined;
            }
        }

        // Create new client if needed
        const newClient = await _getPuppeteerClient(browserBaseOrLocal);
        
        // Create new page
        const newPage = await newClient.newPage();
        await newPage.setViewport({ width: 1280, height: 800 });

        // Set up disconnection handler
        newClient.on('disconnected', () => {
            console.log("Browser disconnected");
            globalThis.puppeteer_client = undefined;
            globalThis.puppeteer_page = undefined;
        });

        // Use type casting to satisfy the TypeScript compiler
        globalThis.puppeteer_client = newClient as unknown as puppeteer.Browser;
        globalThis.puppeteer_page = newPage as unknown as puppeteer.Page;
        console.log("Created new puppeteer client and page");
        return newClient as unknown as puppeteer.Browser;

    } catch (error) {
        console.error("Error in GLOBAL_getPuppeteerClient:", error);
        throw error;
    }
}

export const GLOBAL_getPuppeteerPage = async (): Promise<puppeteer.Page> => {
    if (!globalThis.puppeteer_page) {
        throw new Error("No global page available");
    }
    return globalThis.puppeteer_page;
}

