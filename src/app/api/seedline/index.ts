"use server";



import { SERVER_getSeedLine } from "@/src/lib/server";

export async function testSomething() {
    const line = await SERVER_getSeedLine()
  
    console.log(line)
  
    return line;
  }