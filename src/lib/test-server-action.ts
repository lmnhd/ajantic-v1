"use server";

export async function testSimpleServerAction(input: string) {
  // Simple server action that just returns the input
  console.log("Test server action executed with input:", input);
  return {
    message: `Server received: ${input}`,
    timestamp: new Date().toISOString()
  };
} 