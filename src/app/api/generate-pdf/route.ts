import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const url = `${origin}/portfolio`;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 120000 // 2 minutes
    });
    
    const page = await browser.newPage();
    
    // Add print-specific styles
    await page.addStyleTag({
      content: `
        @media print {
          .print:hidden { display: none !important; }
          .download-button { display: none !important; }
          .chat-interface { display: none !important; }
          .wavy-background { background: none !important; }
        }
      `
    });

    // Set longer navigation timeout
    await page.setDefaultNavigationTimeout(60000); // 1 minute
    await page.setDefaultTimeout(60000);

    // Navigate and wait for content
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.max-w-4xl');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=resume.pdf',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to generate PDF. Please try again.' }), 
      { status: 500 }
    );
  }
} 