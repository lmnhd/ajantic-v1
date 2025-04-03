import { AgentComponentProps, AgentType, AI_Agent_ToolsDescription } from "@/src/lib/types"
import { UTILS_getAllAvailableToolsDescriptions } from "@/src/lib/utils"
import { AutoGenTeam } from "../autogen"
import { UTILS_jsonToXmlString } from "@/src/lib/teams/lib/teams-utils"

export const PROMPT_AUTO_GENERATE_WORKFLOW = {
    // DEPRECATED! This prompt is used to generate a new workflow - UNUSED!
    generationPrompt: (processToAutomate: string, readyMadeAgents: AgentComponentProps[], allToolDescriptions: AI_Agent_ToolsDescription[]) => {
        return `
        <orchestration_types>
            <sequential>Agents processed in the exact order listed</sequential>
            <random>Agents processed in random order</random>
            <auto>Agents processed in real-time by an AI orchestrator</auto>
        </orchestration_types>

        <context_sets>
            <instruction>Create context sets with titles and information (text/XML/JSON) for process steps and research data</instruction>
            <instruction>Specify which agent names should access each context set</instruction>
        </context_sets>

        <predefined_agents>
            ${readyMadeAgents.map(agent => `<agent>
                <name>${agent.name}</name>
                <role_description>${agent.roleDescription}</role_description>
                <title>${agent.title}</title>
                <tools>${UTILS_getAllAvailableToolsDescriptions(agent.tools!)}</tools>
            </agent>`).join("\n")}
        </predefined_agents>

        <agent_creation_properties>
            <agent_types>
                <manager>Manages and orchestrates the process</manager>
                <researcher>Researches and gathers information</researcher>
                <tool_user>Uses tools to complete tasks</tool_user>
                <agent>Performs specific tasks without tools</agent>
            </agent_types>
            <properties>
                <name>Unique identifier for the agent</name>
                <role_description>Detailed description of agent's responsibilities</role_description>
                <title>Short professional title</title>
                <process>Specific steps this agent follows</process>
                <tools>Only for tool_user agents</tools>
                <knowledge_base>Only for agents requiring specialized knowledge</knowledge_base>
            </properties>
            <instruction>Focus on essential actions needed for specific tasks</instruction>
        </agent_creation_properties>

        <tool_repository>
            ${allToolDescriptions.map(tool => `<tool>
                <name>${tool.name}</name>
                <description>${tool.description}</description>
            </tool>`).join("\n")}
        </tool_repository>

        <guidelines>
            <guideline>Design a fully autonomous workflow process</guideline>
            <guideline>Select the optimal orchestration type</guideline>
            <guideline>Use predefined agents when possible</guideline>
            <guideline>Create new agents only when necessary</guideline>
            <guideline>Maintain clear separation of agent duties</guideline>
        </guidelines>

        <process_to_automate>
            ${processToAutomate}
        </process_to_automate>

        <output>
            <new_agents>
                <format>{name: string, roleDescription: string, title: string, tools: string[], process: string[], knowledgeBase: boolean}</format>
            </new_agents>
            <agent_sequence>Array of agent names in processing order</agent_sequence>
            <orchestration_type>sequential|random|auto</orchestration_type>
        </output>
       `
    },
    outlinePrompt: async (processToAutomate: string, availableAgents: AgentComponentProps[], currentOutline?: AutoGenTeam, modifications?: string[], memoryNotes?: string[]) => {
        let xmlString = "";
        if (currentOutline) {
            const resolvedOutline = {
                ...currentOutline,
                availableAgents: await Promise.resolve(currentOutline.availableAgents),
                newAgents: await Promise.resolve(currentOutline.newAgents),
                agentSequence: await Promise.resolve(currentOutline.agentSequence),
                processSteps: await Promise.resolve(currentOutline.processSteps)
            };
            
            xmlString = await UTILS_jsonToXmlString(resolvedOutline, 12);
        }
        
        return `
        <task>
            <role>Process planner and automation expert</role>
            <objective>Create a process outline coordinating AI agents to complete tasks</objective>
            <instructions>
                <instruction>Outline process steps and agent tasks</instruction>
                <instruction>Try to keep the process steps under 10 if feasible</instruction>
                <instruction>Try to lay out a clear progression of process steps that lead to a useful outcome</instruction>
                <instruction>Prioritize using existing agents before creating new ones</instruction>
                <instruction>Balance number of agents and process steps to create a process that is both efficient and effective</instruction>
                <instruction>For new agents, specify name, title, role description, and required skills/tools and expected outputs/results</instruction>
                <instruction>Maintain clear separation of agent duties</instruction>
                <instruction>Select optimal orchestration method</instruction>
                <instruction>For team objective, focus on the outcome of the process and the results, not the process itself
                    <example type="wrong">
                    Design and implement a simple automated process that searches for a specific product on a website and emails the results to the user
                    </example>
                    <example type="correct">
                    Search for a specific product on a website and email the results to the user
                    </example>
                </instruction>
                <instruction>For "auto" orchestration, the first agent must be a manager</instruction>
                <instruction>Prefer 'auto' orchestration and manager agents especially when task verification is needed</instruction>
                ${currentOutline ? `
                <instruction>This is a request to modify an previously generated outline. Review the current outline and make the requested modifications.</instruction>
                <instruction>Check for issues in processing logic that may have been introduced by the user and adjust the outline accordingly.</instruction>
                    ` : ""}
            </instructions>
        </task>

        <process_to_automate/user_request>
            ${processToAutomate}
        </process_to_automate/user_request>

        <available_agents>
            ${availableAgents.map(agent => `<agent>
                <name>${agent.name}</name>
                <title>${agent.title}</title>
                <role_description>${agent.roleDescription}</role_description>
            </agent>`).join("\n")}
        </available_agents>

        ${currentOutline ? `<original_outline>
            ${xmlString}
        </original_outline>` : ""}

        ${modifications ? `
        <requested_modifications>
            ${modifications.map(modification => `
            <modification>${modification}</modification>`).join("\n")}
        </requested_modifications>` : ""}

        ${memoryNotes ? `
        <related_memories>
            ${memoryNotes.map(note => `<memory>${note}</memory>`).join("\n")}
        </related_memories>` : ""}

        <output>
            <team_name>Name of the team</team_name>
            <team_objective>Objective of the team</team_objective>
            <available_agents>Predefined agents to be used as part of the team</available_agents>
            <new_agents>New agents needed to complete the team</new_agents>
            <agent_sequence>Order of agent processing</agent_sequence>
            <orchestration_type>sequential|random|auto</orchestration_type>
            <process_steps>Steps of the process to automate</process_steps>
        </output>
       `
    },
    agentBuilderPrompt: (name: string, title: string, roleDescription: string, type: "agent" | "tool-operator" | "manager" | "researcher", availableTools: AI_Agent_ToolsDescription[], toolHints: string[], teamObjective: string) => {
        return `
        <role>AI agent architect</role>
        <task>Build an agent based on provided specifications</task>

        <instructions>
            <instruction>Study the provided agent type and role description to determine the best way to build the agent</instruction>
            <instruction>Assess if knowledge base supplementation is needed</instruction>
            <instruction>Create process steps for the agent to follow</instruction>
            ${toolHints.length > 0 ? `
            <instruction>For tool-operator agents, carefully select the appropriate tools from the tool repository</instruction>
            <instruction>For tool-operator agents, use the tool hints to help you select the best tools</instruction>
            <instruction>Request custom tools if no tool in the repository closely matches what is needed</instruction>` : ""}
            <instruction>Note: Only tool-operator agents can use tools</instruction>
        </instructions>

        <agent_type type="${type}">
            ${type === "agent" ? "Standard agent without tools, using only LLM capabilities" : type === "tool-operator" ? "Uses tools for tasks that require them" : type === "manager" ? "Orchestrates other agents during the process" : "Uses research-specific tools to gather information. Tools are hardcoded and cannot be changed. This is not a tool-operator agent."}
        </agent_type>

        <tool_hints>
            ${toolHints.length > 0 ? toolHints.map(hint => `<hint>${hint}</hint>`).join("\n") : ""}
        </tool_hints>

        ${type === "tool-operator" ? `
        <tool_repository>
            ${availableTools.map(tool => `
            <tool_group name="${tool.group}">
                <tool name="${tool.name}">${tool.description}</tool>
            </tool_group>`).join("\n")}
            <note>Use collection name to add all tools in that group</note>
        </tool_repository>` : ""}

        ### Here is the objective of the team:
        <team_objective>${teamObjective}</team_objective>

        ### Here are the specific details for the agent you are building:
         <agent_info>
            <type>${type}</type>
            <name>${name}</name>
            <title>${title}</title>
            <role_description>${roleDescription}</role_description>
        </agent_info>

        <output>
         <name>The agents name</name>
         <role-description>The details of the agent role</role-description>
         <title>The agents title</title>
         <type>Manager, Agent, Tool_Operator, or researcher</type>
         <process>The steps for the agent to follow for successfull task completion</process>
         <tools>Existing or custom tools the agent will need access to (by group name)</tools>
         <tool-requests>Describe the tools this agent will need that do not already exist</tool-requests>
         <knowledge-base>True or False - Should this agent possess a supplimental knowledge data base to help it with it's tasks? Will this agent's tasks require very specialized information that an LLM would not normally be trained on?</knowledge-base>
        </output>
        `
    },
    perplexityModelResearch: (agentRoles: {name: string, title: string, roleDescription: string}[], modelNames: {provider: string, modelName: string}[]) => {
        return `
        <task>
            <objective>Identify the 3 best LLMs for each specified agent role in order of best to worst</objective>
            <instructions>
                <instruction>Review each agent role description</instruction>
                <instruction>Research the provided language models</instruction>
                <instruction>Rank the top 3 models from best to worst for each agent role</instruction>
                <instruction>Consideration hints: 
                    <hint>Thinking models versus generation models</hint>
                    <hint>Will the agent need to use tools?</hint>
                    <hint>Determine the context window of the model compared to the expected process</hint>
                    <hint>Consider the style and characteristics of the model as it relates to the agent role</hint>
                    
                </instruction>
            </instructions>
        </task>

        <agent_roles>
            ${agentRoles.map(role => `<role>
                <name>${role.name}</name>
                <title>${role.title}</title>
                <role_description>${role.roleDescription}</role_description>
            </role>`).join("\n")}
        </agent_roles>

        <available_models>
            ${modelNames.map(model => `<model>
                <provider>${model.provider}</provider>
                <name>${model.modelName}</name>
            </model>`).join("\n")}
        </available_models>

        <output_format>Short report in markdown format listing the top 3 model/provider combinations for each agent role in order of best to worst</output_format>
        `
    },
    formatModelResearchOutput: (report: string, modelNames: {provider: string, modelName: string}[]) => {
        return `
        <task>Extract recommended models from research report</task>

        <report>
            ${report}
        </report>

        <output>
            <models>
                <model>
                    <provider>provider name</provider>
                    <model_name>model name</model_name>
                </model>
                <model>
                    <provider>provider name</provider>
                    <model_name>model name</model_name>
                </model>
                <model>
                    <provider>provider name</provider>
                    <model_name>model name</model_name>
                </model>
            </models>
        </output>
        `
    },
    agentKnowledgeBase: (processToAutomate: string) => {
        return `
        <task>Identify research topics for agent knowledge base</task>

        <process_to_automate>
            ${processToAutomate}
        </process_to_automate>

        <output>
            <knowledge_base_items>
                <format>{researchTopic: string, description: string}</format>
            </knowledge_base_items>
        </output>
        `
    },
    generateResponsibilities: (title: string, roleDescription: string, teamObjective: string) => {
        return `
        <task>Generate a list of 3 or more research topics that will enhance the knowledge, usefulness, and performance of the agent</task>

        <agent_info>
            <title>${title}</title>
            <role_description>${roleDescription}</role_description>
        </agent_info>
        
        `
    },
    processNotes: (processToAutomate: string, modifications: string[]) => {
        return `
        <task>Baded on the process to automate, determine what, if any, modifications should be remembered as pointers for future auto-gen creations</task>
        <hints>
            <hint>We may be creating a lot of similarly structured processes in the future. What may be considered a shortcut for future auto-gen creations?</hint>
            <hint>Are there any modifications here that are likely to be needed again?</hint>
            <hint>What are the most common modifications that are made to the process to automate?</hint>
            
            
            
            
        </hints>

        <process_to_automate>
            ${processToAutomate}
        </process_to_automate>

        <modifications>
            ${modifications.map(modification => `<modification>${modification}</modification>`).join("\n")}
        </modifications>

        <output>
            <pointers>
                Return a list of pointers to remember for future auto-gen creations as an array of strings.
            </pointers>
            <keyword>A single keyword that will help us remember what this process is about</keyword>
        </output>
        
        
        `
    }
} 