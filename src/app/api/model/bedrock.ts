// import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

// console.log("process.env.AWS_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID);
// console.log("process.env.AWS_SECRET_ACCESS", process.env.AWS_SECRET_ACCESS);
// console.log("process.env.AWS_REGION", process.env.AWS_REGION);
// const bedrock = new BedrockRuntimeClient({
//    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//    secretAccessKey: process.env.AWS_SECRET_ACCESS,
//    region: process.env.AWS_REGION,
// });

// // export type BedrockModelNames = 
// //     | "amazon.titan-tg1-large"
// //     | "amazon.titan-text-express-v1"
// //     | "anthropic.claude-3-5-sonnet-20241022-v2:0"
// //     | "anthropic.claude-3-5-sonnet-20240620-v1:0"
// //     | "anthropic.claude-3-5-haiku-20241022-v1:0"
// //     | "anthropic.claude-3-opus-20240229-v1:0"
// //     | "anthropic.claude-3-sonnet-20240229-v1:0"
// //     | "anthropic.claude-3-haiku-20240307-v1:0"
// //     | "anthropic.claude-v2:1"
// //     | "cohere.command-r-v1:0"
// //     | "cohere.command-r-plus-v1:0"
// //     | "meta.llama2-13b-chat-v1"
// //     | "meta.llama2-70b-chat-v1"
// //     | "meta.llama3-8b-instruct-v1:0"
// //     | "meta.llama3-70b-instruct-v1:0"
// //     | "meta.llama3-1-8b-instruct-v1:0"
// //     | "meta.llama3-1-70b-instruct-v1:0"
// //     | "meta.llama3-1-405b-instruct-v1:0"
// //     | "meta.llama3-2-1b-instruct-v1:0"
// //     | "meta.llama3-2-3b-instruct-v1:0"
// //     | "meta.llama3-2-11b-instruct-v1:0"
// //     | "meta.llama3-2-90b-instruct-v1:0"
// //     | "mistral.mistral-7b-instruct-v0:2"
// //     | "mistral.mixtral-8x7b-instruct-v0:1"
// //     | "mistral.mistral-large-2402-v1:0"
// //     | "mistral.mistral-small-2402-v1:0";

// export const BedrockModelNames = {
//     "amazon.titan-tg1-large": "amazon.titan-tg1-large",
//     "amazon.titan-text-express-v1": "amazon.titan-text-express-v1",
//     "anthropic.claude-3-5-sonnet-20241022-v2:0": "anthropic.claude-3-5-sonnet-20241022-v2:0",
//     "anthropic.claude-3-5-sonnet-20240620-v1:0": "anthropic.claude-3-5-sonnet-20240620-v1:0",
//     "anthropic.claude-3-5-haiku-20241022-v1:0": "anthropic.claude-3-5-haiku-20241022-v1:0",
//     "anthropic.claude-3-opus-20240229-v1:0": "anthropic.claude-3-opus-20240229-v1:0",
//     "anthropic.claude-3-sonnet-20240229-v1:0": "anthropic.claude-3-sonnet-20240229-v1:0",
//     "anthropic.claude-3-haiku-20240307-v1:0": "anthropic.claude-3-haiku-20240307-v1:0",
//     "anthropic.claude-v2:1": "anthropic.claude-v2:1",
//     "cohere.command-r-v1:0": "cohere.command-r-v1:0",
//     "cohere.command-r-plus-v1:0": "cohere.command-r-plus-v1:0",
//     "meta.llama2-13b-chat-v1": "meta.llama2-13b-chat-v1",
//     "meta.llama2-70b-chat-v1": "meta.llama2-70b-chat-v1",
//     "meta.llama3-8b-instruct-v1:0": "meta.llama3-8b-instruct-v1:0",
//     "meta.llama3-70b-instruct-v1:0": "meta.llama3-70b-instruct-v1:0",
//     "meta.llama3-1-8b-instruct-v1:0": "meta.llama3-1-8b-instruct-v1:0",
//     "meta.llama3-1-70b-instruct-v1:0": "meta.llama3-1-70b-instruct-v1:0",
//     "meta.llama3-1-405b-instruct-v1:0": "meta.llama3-1-405b-instruct-v1:0",
//     "meta.llama3-2-1b-instruct-v1:0": "meta.llama3-2-1b-instruct-v1:0",
//     "meta.llama3-2-3b-instruct-v1:0": "meta.llama3-2-3b-instruct-v1:0",
//     "meta.llama3-2-11b-instruct-v1:0": "meta.llama3-2-11b-instruct-v1:0",
//     "meta.llama3-2-90b-instruct-v1:0": "meta.llama3-2-90b-instruct-v1:0",
//     "mistral.mistral-7b-instruct-v0:2": "mistral.mistral-7b-instruct-v0:2",
//     "mistral.mixtral-8x7b-instruct-v0:1": "mistral.mixtral-8x7b-instruct-v0:1",
//     "mistral.mistral-large-2402-v1:0": "mistral.mistral-large-2402-v1:0",
//     "mistral.mistral-small-2402-v1:0": "mistral.mistral-small-2402-v1:0",
// }

    
// export type BedrockProps = {
//     modelName: string, 
//     temperature: number
// }

// export async function MODEL_bedrock({ modelName, temperature }: BedrockProps) {
//     console.log("modelName", modelName);
//     return bedrock;
// }

