// // api/run.js
// import edgeChromium from 'chrome-aws-lambda'

// // Importing Puppeteer core as default otherwise
// // it won't function correctly with "launch()"
// import puppeteer from 'puppeteer-core'

// // You may want to change this if you're developing
// // on a platform different from macOS.
// // See https://github.com/vercel/og-image for a more resilient
// // system-agnostic options for Puppeteeer.
// const LOCAL_CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// export const CHROMIUM_loadPage = async () => {
//   // Edge executable will return an empty string locally.
//   const executablePath = await edgeChromium.executablePath || LOCAL_CHROME_EXECUTABLE
  
//   const browser = await puppeteer.launch({
//     executablePath,
//     args: edgeChromium.args,
//     headless: false,
//   })
  
//   const page = await browser.newPage()
//   await page.goto('https://github.com')

//   const content = await page.content();
//   console.log("content", content);

//   await browser.close();

//   return content;
// }