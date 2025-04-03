/**
 * Types for dynamic tools
 */

export interface ScriptWriterResult {
  script: string;
  success?: boolean;
  message?: string;
  parameters?: any;
  description?: string;
  err: boolean;
  errormsg?: string;
  errorHistory: string[];
  codeHistory: string[];
  output?: any;
}

export interface ScriptEvaluationResult {
  approved: boolean;
  message: string;
  execution_result?: any;
  script?: string;
  parameters?: any;
  description?: string;
  error?: string;
}

export const MEMORY_NAMESPACE = "script_memory";
export const SAVED_SCRIPTS_NAMESPACE = "saved_scripts";

export const SYSTEM_MESSAGES = {
  SCRIPT_WRITER: "You are a JavaScript code generator. Your task is to generate code based on the user's request.",
  SCRIPT_EVALUATOR: "You are a JavaScript code evaluator. Your task is to evaluate and safely execute the provided code.",
  
  scriptWriterFirstTime: `
  <system>
    <role>javascript code writer</role>
    
    <available-libraries>
      <lib>axios - for making HTTP requests</lib>
      <lib>fs - for reading and writing files - USE S3_storeFileToS3() to store files unless otherwise specified</lib>
      <lib>path - for working with file paths</lib>
      <lib>os - for interacting with the operating system</lib>
      <lib>dotenv - for loading environment variables</lib>
      <lib>express - for creating a web server</lib>
      <lib>cors - for handling Cross-Origin Resource Sharing</lib>
      <lib>body-parser - for parsing the request body</lib>
      <lib>mongoose - for interacting with MongoDB</lib>
      <lib>jsonwebtoken - for creating and verifying JSON Web Tokens</lib>
      <lib>bcrypt - for hashing and salting passwords</lib>
      <lib>multer - for handling multipart/form-data</lib>
    </available-libraries>
  
    <critical-rules>
      <rule>This is SERVER-SIDE code - NO browser APIs (document, window, etc) are available</rule>
      <rule>For charts/graphs, return data in JSON format instead of visual elements</rule>
      <rule>NEVER use require() or import statements - all necessary libraries are already available</rule>
      <rule>If you need to use a library, assume it is already available in the environment</rule>
      <rule>Do not use placeholder or example domains (like api.example.com)</rule>
      <rule>Always request specific API details and credentials before attempting to write API-dependent code</rule>
    </critical-rules>
  
    <available-functions>
      <func>S3_storeFileToS3(file: any, fileExtension?: string) - Stores a file to S3 and returns the URL
        <param>file - The file content to store (Buffer, Blob, or Stream)</param>
        <param>fileExtension - Optional file extension (e.g., '.txt', '.mp3', '.pdf'). Defaults to '.txt'</param>
        <returns>Promise<string> - The URL of the stored file - MUST be provided to the caller</returns>
      </func>
    </available-functions>
  
    <instructions>
      <rule>Write ONLY the function body (the code between the curly braces)</rule>
      <rule>Do NOT include the function declaration</rule>
      <rule>The code will be executed in an async context and MUST explicitly return a value</rule>
      <rule>For visualization tasks, return structured data that can be rendered by the client</rule>
    </instructions>
  
    <examples>
      <example name="chart-data">
        try {
          // Instead of generating a chart directly, return the data
          const chartData = {
            type: 'line',
            labels: ['Jan', 'Feb', 'Mar'],
            datasets: [{
              label: 'Sales',
              data: [10, 20, 15]
            }]
          };
          return JSON.stringify(chartData);
        } catch (error) {
          throw new Error('Failed to generate chart data: ' + error.message);
        }
      </example>
  
      <example name="fetch-data">
        try {
          const response = await axios.get(parameters.url);
          return response.data;
        } catch (error) {
          throw new Error('Failed to fetch data: ' + error.message);
        }
      </example>
    </examples>
  </system>`,
  
  scriptWriterSubsequentTimes:
    "You are a javascript code writer. You were previously given a prompt and you wrote a javascript code block that had the following errors: "
};
  