////"use server";

import { NextResponse } from "next/server";

import { generateNameFromPrompt } from ".";

//export const runtime = "edge";

// Example usage in an API route handler:
export async function POST(req: Request) {
  const { prompt } = await req.json();

  try {
    const generatedName = await generateNameFromPrompt(prompt);
    return NextResponse.json({ name: generatedName });
  } catch (error) {
    console.error("Error generating name:", error);
    return NextResponse.json(
      { error: "Failed to generate name" },
      { status: 500 }
    );
  }
}
