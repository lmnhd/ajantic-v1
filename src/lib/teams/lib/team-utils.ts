// import { AgentComponentProps, AgentTypeEnum, ModelProviderEnum, Team } from "@/src/lib/types";
// import { v4 as uuidv4 } from "uuid";

// /**
//  * Generates a unique ID for a new agent
//  */
// export function generateAgentId(): string {
//   return `agent-${uuidv4()}`;
// }

// /**
//  * Creates a new empty agent with default values
//  */
// export function createEmptyAgent(teamId?: string): AgentComponentProps {
//   return {
//     name: "New Agent",
//     title: "Untitled Role",
//     roleDescription: "",
//     type: AgentTypeEnum.AGENT,
//     systemPrompt: "",
//     tools: [],
//     modelArgs: {
//       modelName: "gpt-4o",
//       temperature: 0.7,
//       provider: ModelProviderEnum.OPENAI,
//     },
//   };
// }

// /**
//  * Generates a team with predefined agents based on a template
//  */
// export function generateTemplateTeam(templateName: string): Team {
//   const teamId = `team-${uuidv4()}`;
  
//   switch (templateName.toLowerCase()) {
//     case "research":
//       return {
//         id: teamId,
//         name: "Research Team",
//         objective: "Conduct in-depth research on specified topics and produce comprehensive reports",
//         agents: [
//           {
//             name: "Lead Researcher",
//             title: "Research Director",
//             roleDescription: "Coordinates research efforts and synthesizes findings",
//             type: AgentTypeEnum.AGENT,
//             systemPrompt: "You are a Lead Researcher responsible for coordinating research activities and synthesizing findings from your team.",
//             tools: ["search", "document-analysis"],
//             modelArgs: {
//               modelName: "gpt-4o",
//               temperature: 0.7,
//               provider: ModelProviderEnum.OPENAI,
//             },
//           },
//           {
//             name: "Data Analyst",
//             title: "Quantitative Specialist",
//             roleDescription: "Analyzes numerical data and creates visualizations",
//             type: AgentTypeEnum.AGENT,
//             systemPrompt: "You are a Data Analyst who specializes in analyzing numerical data and creating informative visualizations.",
//             tools: ["data-analysis", "chart-generation"],
//             modelArgs: {
//               modelName: "gpt-4o",
//               temperature: 0.2,
//               provider: ModelProviderEnum.OPENAI,
//             },
//           },
//           {
//             name: "Literature Reviewer",
//             title: "Academic Specialist",
//             roleDescription: "Reviews academic literature and summarizes findings",
//             type: AgentTypeEnum.AGENT,
//             systemPrompt: "You are a Literature Reviewer who excels at finding, analyzing, and summarizing academic literature on a given topic.",
//             tools: ["search", "document-analysis"],
//             modelArgs: {
//               modelName: "gpt-4o",
//               temperature: 0.5,
//               provider: ModelProviderEnum.OPENAI,
//             },
//           }
//         ],
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       };
      
//     case "development":
//       return {
//         id: teamId,
//         name: "Development Team",
//         objective: "Design and build software solutions to meet specified requirements",
//         agents: [
//           {
//             id: generateAgentId(),
//             teamId: teamId,
//             name: "Tech Lead",
//             title: "Senior Developer",
//             roleDescription: "Oversees technical implementation and makes architectural decisions",
//             type: AgentTypeEnum.AI_AGENT,
//             systemPrompt: "You are a Tech Lead responsible for overseeing the technical implementation of projects and making key architectural decisions.",
//             tools: ["code-generation", "code-review"],
//             modelArgs: {
//               modelName: "gpt-4o",
//               temperature: 0.7,
//               maxTokens: 4000,
//             },
//           },
//           {
//             id: generateAgentId(),
//             teamId: teamId,
//             name: "Frontend Developer",
//             title: "UI/UX Specialist",
//             roleDescription: "Designs and implements user interfaces",
//             type: AgentTypeEnum.AI_AGENT,
//             systemPrompt: "You are a Frontend Developer who specializes in creating intuitive and visually appealing user interfaces.",
//             tools: ["code-generation", "design-review"],
//             modelArgs: {
//               modelName: "gpt-4o",
//               temperature: 0.6,
//               maxTokens: 4000,
//             },
//           },
//           {
//             id: generateAgentId(),
//             teamId: teamId,
//             name: "QA Engineer",
//             title: "Quality Assurance Specialist",
//             roleDescription: "Tests functionality and ensures quality standards",
//             type: AgentTypeEnum.AI_AGENT,
//             systemPrompt: "You are a QA Engineer responsible for thoroughly testing software to identify bugs and ensure it meets quality standards.",
//             tools: ["test-generation", "bug-reporting"],
//             modelArgs: {
//               modelName: "gpt-4o",
//               temperature: 0.4,
//               maxTokens: 4000,
//             },
//           }
//         ],
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       };
      
//     default:
//       // Empty team with no agents
//       return {
//         id: teamId,
//         name: "New Team",
//         objective: "Define your team's objective here",
//         agents: [],
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       };
//   }
// }

// /**
//  * Validates a team structure to ensure it has required fields
//  */
// export function validateTeam(team: Team): { valid: boolean; errors: string[] } {
//   const errors: string[] = [];
  
//   if (!team.name || team.name.trim() === "") {
//     errors.push("Team name is required");
//   }
  
//   if (!team.objective || team.objective.trim() === "") {
//     errors.push("Team objective is required");
//   }
  
//   // Check each agent for required fields
//   team.agents.forEach((agent, index) => {
//     if (!agent.name || agent.name.trim() === "") {
//       errors.push(`Agent #${index + 1} is missing a name`);
//     }
    
//     if (!agent.roleDescription || agent.roleDescription.trim() === "") {
//       errors.push(`Agent #${index + 1} (${agent.name || 'Unnamed'}) is missing a role description`);
//     }
//   });
  
//   return {
//     valid: errors.length === 0,
//     errors,
//   };
// } 