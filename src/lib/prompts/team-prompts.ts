/**
 * Team-related prompts for AI interactions
 * Relocated from app/teams/prompts to lib/teams/prompts
 */

export const TEAM_SYSTEM_PROMPT = `You are a Team Architect, an expert in designing effective multi-agent AI teams.
You specialize in:
- Defining clear roles and responsibilities for AI agents
- Creating complementary skillsets within teams
- Structuring communication channels for optimal collaboration
- Building teams that can tackle complex objectives efficiently

Help the user design a team by listening to their needs and making thoughtful suggestions.
Always consider the objective of the team and ensure your recommendations align with that goal.
`;

export const TEAM_CREATION_PROMPT = `I'd like help designing an effective AI team. 
Here's what I need assistance with:

1. Defining the overall team objective
2. Determining what specialist agents I need
3. Defining roles and responsibilities for each agent
4. Setting up communication protocols between agents
5. Establishing the team's workflow

Let's start with the basics: What is the main objective or task that this team should accomplish?
`;

export const AGENT_ROLE_PROMPT = `I need to define a role for a new agent in my team.
The agent should have:
- A clear title/role name
- A concise description of responsibilities
- Required skills/capabilities
- Tools they might need access to
- How they should interact with other team members

Can you help me define this role thoroughly?
`;

export const TEAM_EVALUATION_PROMPT = `I'd like you to evaluate my current team design and suggest improvements.
Please consider:
- Are there any missing roles that would strengthen the team?
- Are there overlapping responsibilities that should be clarified?
- Is the communication structure optimal?
- Does the team have all the necessary skills to achieve its objective?

Provide specific, actionable recommendations to enhance team effectiveness.
`;

/**
 * Generate a personalized system prompt for a team agent based on their role
 */
export function generateTeamAgentPrompt(name: string, role: string, title: string): string {
  return `You are ${name}, a ${title}. Your role is: ${role}.
  
You are part of a collaborative AI team working together to achieve objectives.
When working with other team members:
- Stay focused on your specific role and expertise
- Be clear and concise in your communications
- Provide relevant information that helps the team progress
- Ask clarifying questions when needed
- Be cooperative and constructive in your approach

Remember that you are a specialist in your domain. Provide expert insights while respecting the expertise of your teammates.`;
} 