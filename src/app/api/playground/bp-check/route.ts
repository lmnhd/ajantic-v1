import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const count = body.count || 5; // Default to 5 if count is not provided

    console.log(`Starting loop for ${count} iterations.`);

    for (let i = 0; i < count; i++) {
      // You can set a breakpoint here to test
      console.log(`Iteration ${i + 1}`);
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100)); 
    }

    console.log('Loop finished.');
    return NextResponse.json({ message: `Loop completed ${count} times.` });
  } catch (error) {
    console.error("Error in bp-check API:", error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
