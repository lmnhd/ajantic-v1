import {
    PlaywrightWebBaseLoader,
    Page,
    Browser,
  } from "@langchain/community/document_loaders/web/playwright";
  
 export const LC_PLAYWRIGHT_loadPage = async (url: string = "https://www.imdb.com/") => {
    const loader = new PlaywrightWebBaseLoader(url, {
        launchOptions: {
          headless: true,
        },
        gotoOptions: {
          waitUntil: "domcontentloaded",
        },
        /** Pass custom evaluate, in this case you get page and browser instances */
        async evaluate(page: Page, browser: Browser) {
          await page.waitForResponse(url + "chart/toptv/?ref_=tt_ttv_sm");
      
          const result = await page.evaluate(() => document.body.innerHTML);
          return result;
        },
      });
      
      const docs = await loader.load();
    
      console.log(docs);
    
      const extractedContents = docs[0].pageContent;
    
      console.log(extractedContents);

      return extractedContents;
 }
