import {
  AgentType,
  AgentTypeEnum,
  AgentWorkflowOrchestrationPromptProps,
  AI_Agent_Tools,
  ContextContainerProps,
  OrchestrationProps,
} from "@/src/lib/types";
import {
  UTILS_convertLineSetsToContext,
  UTILS_getAllAvailableToolsDescriptions,
} from "@/src/lib/utils";
import { PROMPT_DIRECTIVES } from "@/src/lib/prompts/prompt-directives";
import { object } from "zod";
import {
  PROMPT_EXTRAS_agentMemory,
  PROMPT_EXTRAS_gatherClientNotes,
  PROMPT_EXTRAS_gatherKnowledgeBase,
  PROMPT_EXTRAS_generateAutoManagerDirective,
  PROMPT_EXTRAS_generateResearcherDirective,
  PROMPT_EXTRAS_toolSpecialtyDirectiveByTools,
  PROMPT_EXTRAS_toolSpecialtyDirectiveByType,
} from "@/src/lib/prompts/agent-global";
export const AGENT_WORKFLOW_ORCHESTRATION_PROMPT = {
  // BRAINSTORMING
  workflow_prompt_1: async (
    props: OrchestrationProps,
    context?: ContextContainerProps[]
  ) => `
<AGENT_CHARACTER>
    You are ${
      props.currentAgent.name
    }, and a highly intelligent conversational agent participating in a group conversation with other agents working together to hash out ideas for the user's request.
    
    <AGENT_ROLE>
        ${props.currentAgent.roleDescription}
    </AGENT_ROLE>
    <UNIQUE_INFORMATION>
        ${props.currentAgent.systemPrompt}
    </UNIQUE_INFORMATION>
</AGENT_CHARACTER>
${
  props.currentAgent.type === AgentTypeEnum.RESEARCHER
    ? `
${PROMPT_EXTRAS_generateResearcherDirective(
  props.currentAgent.type as AgentTypeEnum,
  props.extras?.userId || ""
)}
${PROMPT_EXTRAS_generateAutoManagerDirective(props)}
${
  props.currentAgent.tools?.length
    ? `
<TOOLS>
    ${PROMPT_EXTRAS_toolSpecialtyDirectiveByTools(
      props.currentAgent.tools as AI_Agent_Tools[],
      props.currentAgent,
      props.extras?.userId || ""
    )}
    ${PROMPT_EXTRAS_toolSpecialtyDirectiveByType(props.currentAgent, props.extras?.userId || "")}
</TOOLS>
`
    : ""
}
`
    : ""
}
<PEER_AGENTS>
    ${props.allAgents
      .filter((agent) => agent.name !== props.currentAgent.name)
      .map(
        (agent) => `
        <agent_name>
            ${agent.name}
        </agent_name>
        <agent_title>
            ${agent.title}
        </agent_title>
        <agent_role>
            ${agent.roleDescription}
        </agent_role>
       `
      )
      .join("\n")}
</PEER_AGENTS>

${_instructions(props)}

${_memory(
  props,
  props.extras?.query || "",
  props.extras?.userId || "",
  props.extras?.hasKnowledgeBase || false
)}

${
  context
    ? `
<ADDITIONAL_CONTEXT>
    ${UTILS_convertLineSetsToContext(context, props.currentAgent.name)}
</ADDITIONAL_CONTEXT>`
    : ""
}
`,
  // BUILDING
  workflow_prompt_2: async (
    props: OrchestrationProps,
    context?: ContextContainerProps[]
  ) => `<AGENT_CHARACTER>
    You are ${
      props.currentAgent.name
    }, and a highly intelligent process design agent. You are responisble for creating the outline to a workflow that will be used by a team of agents to complete a task.
    
    <AGENT_ROLE>
        ${props.currentAgent.roleDescription}
    </AGENT_ROLE>
    <UNIQUE_INFORMATION>
        ${props.currentAgent.systemPrompt}
    </UNIQUE_INFORMATION>
</AGENT_CHARACTER>
<OBJECTIVES>
    - Outline the steps needed to complete the task in a way that is efficient and effective.
    - Consider the skills and expertise of the other agents when outlining the steps.
    - Consider any technical constraints versus the available tools and technologies we have.
    - Consider the dependencies between the steps.
    - Consider the overall goal of the task and how each step contributes to that goal.
</OBJECTIVES>
<AVAILABLE_TOOLS>
   ${UTILS_getAllAvailableToolsDescriptions()
     .map(
       (tool) =>
         `- ${tool.name}: ${tool.description}`
     )
     .join("\n")}
</AVAILABLE_TOOLS>
<PEER_AGENTS>
    ${props.allAgents
      .filter((agent) => agent.name !== props.currentAgent.name)
      .map(
        (agent) => `
        <agent_name>
            ${agent.name}
        </agent_name>
        <agent_title>
            ${agent.title}
        </agent_title>
        <agent_role>
            ${agent.roleDescription}
        </agent_role>
       `
      )
      .join("\n")}
</PEER_AGENTS>

${_instructions(props)}

${_memory(
  props,
  props.extras?.query || "",
  props.extras?.userId || "",
  props.extras?.hasKnowledgeBase || false
)}

${
  context
    ? `
<ADDITIONAL_CONTEXT>
    ${UTILS_convertLineSetsToContext(context, props.currentAgent.name)}
</ADDITIONAL_CONTEXT>`
    : ""
}
<EXAMPLE_OUTPUT>
    <!-- Example 1: Data Analysis Workflow -->
    <TEAM_OUTLINE>
        <AGENTS_INVOLVED>
            <agent>
               <name>Data Analyst</name>
               <role>Responsible for data cleaning, preliminary analysis, and visualization preparation</role>
            </agent>
            <agent>
               <name>Domain Expert</name>
               <role>Provides context for data interpretation and validates findings against industry knowledge</role>
            </agent>
            <agent>
               <name>Technical Writer</name>
               <role>Prepares final report and ensures all findings are clearly communicated</role>
            </agent>
        </AGENTS_INVOLVED>
        <TASK_DESCRIPTION>
            """
            Analyze the quarterly sales data to identify trends, outliers, and potential growth opportunities. Prepare a comprehensive report with visualizations that can guide the marketing strategy for the next quarter.
            """
        </TASK_DESCRIPTION>
        <TASK_OUTLINE>
            1. **Data Preparation Phase** [Data Analyst]
               - Import and clean raw sales data
               - Normalize data across regions
               - Identify and handle missing values
               - DELIVERABLE: Prepared dataset ready for analysis

            2. **Analysis Phase** [Data Analyst → Domain Expert]
               - [Data Analyst] Perform trend analysis across product categories
               - [Data Analyst] Compare regional performance metrics
               - [Data Analyst] Identify top and bottom performing products
               - [Data Analyst] Calculate key performance indicators
               - [Data Analyst] Create preliminary visualizations
               - [Domain Expert] Review initial findings
               - DELIVERABLE: Preliminary analysis document with visualizations

            3. **Insight Development Phase** [Domain Expert]
               - Cross-reference findings with industry benchmarks
               - Identify potential causal relationships
               - Develop growth opportunity hypotheses
               - Provide business context to findings
               - DELIVERABLE: Interpreted analysis with business insights

            4. **Reporting Phase** [Data Analyst + Technical Writer]
               - [Data Analyst] Refine data visualizations based on Domain Expert feedback
               - [Technical Writer] Write executive summary
               - [Technical Writer] Compile comprehensive report with visualizations
               - [Technical Writer] Format for target audience
               - DELIVERABLE: Draft comprehensive report

            5. **Recommendation Phase** [Domain Expert → Technical Writer]
               - [Domain Expert] Develop actionable recommendations
               - [Domain Expert] Prioritize initiatives by potential impact
               - [Technical Writer] Integrate recommendations into final report
               - [Technical Writer] Finalize formatting and presentation
               - DELIVERABLE: Final report with recommendations
        </TASK_OUTLINE>
    </TEAM_OUTLINE>

    <!-- Example 2: Software Development Workflow -->
    <TEAM_OUTLINE>
        <AGENTS_INVOLVED>
            <agent>
               <name>Solutions Architect</name>
               <role>Designs the system architecture and technical approach</role>
            </agent>
            <agent>
               <name>Developer</name>
               <role>Implements the code according to specifications</role>
            </agent>
            <agent>
               <name>QA Analyst</name>
               <role>Tests the implementation to ensure quality and catch issues</role>
            </agent>
            <agent>
               <name>Project Manager</name>
               <role>Coordinates the workflow and ensures timely delivery</role>
            </agent>
        </AGENTS_INVOLVED>
        <TASK_DESCRIPTION>
            """
            Develop a new authentication system that supports multi-factor authentication, single sign-on, and integration with existing user database. The system must be secure, scalable, and comply with industry standards.
            """
        </TASK_DESCRIPTION>
        <TASK_OUTLINE>
            1. **Planning Phase** [Project Manager + Solutions Architect]
               - [Project Manager] Define project scope and timeline
               - [Solutions Architect] Define technical requirements
               - [Solutions Architect] Evaluate existing systems and integration points
               - [Solutions Architect] Design architecture and data flow
               - [Solutions Architect] Select appropriate technologies and frameworks
               - [Project Manager] Create detailed work breakdown structure
               - DELIVERABLE: Technical specification document and project plan

            2. **Development Phase** [Developer with Solutions Architect oversight]
               - [Developer] Set up development environment
               - [Developer] Implement core authentication logic
               - [Solutions Architect] Review core implementation
               - [Developer] Develop multi-factor authentication features
               - [Developer] Build single sign-on capabilities
               - [Developer] Create API endpoints for integration
               - [Solutions Architect] Conduct code reviews at key milestones
               - DELIVERABLE: Working authentication system codebase

            3. **Testing Phase** [QA Analyst with Developer support]
               - [QA Analyst] Create test plans and test cases
               - [QA Analyst] Perform unit testing of components
               - [QA Analyst] Conduct integration testing
               - [QA Analyst] Execute security vulnerability assessment
               - [Developer] Fix identified issues
               - [QA Analyst] Perform load and stress testing
               - [QA Analyst] Conduct regression testing after fixes
               - DELIVERABLE: Test results report and verified system

            4. **Deployment Phase** [Solutions Architect + Developer]
               - [Solutions Architect] Prepare deployment documentation
               - [Developer] Configure production environment
               - [Developer] Implement monitoring and logging
               - [Solutions Architect] Execute deployment plan
               - [QA Analyst] Verify deployment success
               - DELIVERABLE: Deployed system in production

            5. **Post-Deployment Phase** [Project Manager + All team members]
               - [Developer] Monitor system performance
               - [QA Analyst] Conduct post-deployment testing
               - [Solutions Architect] Address any critical issues
               - [Project Manager] Document lessons learned
               - [Project Manager] Plan for future enhancements
               - DELIVERABLE: Post-implementation review document
        </TASK_OUTLINE>
    </TEAM_OUTLINE>

    <!-- Example 3: Content Creation Workflow -->
    <TEAM_OUTLINE>
        <AGENTS_INVOLVED>
            <agent>
               <name>Research Specialist</name>
               <role>Gathers and verifies information from credible sources</role>
            </agent>
            <agent>
               <name>Content Strategist</name>
               <role>Develops content framework and ensures alignment with business goals</role>
            </agent>
            <agent>
               <name>Creative Writer</name>
               <role>Produces engaging and compelling content</role>
            </agent>
            <agent>
               <name>Editor</name>
               <role>Reviews content for quality, accuracy, and brand consistency</role>
            </agent>
        </AGENTS_INVOLVED>
        <TASK_DESCRIPTION>
            """
            Create a comprehensive content series about artificial intelligence for our company blog. The content should establish our thought leadership, be accessible to a technical audience while remaining approachable for beginners, and drive engagement with our AI-related products.
            """
        </TASK_DESCRIPTION>
        <TASK_OUTLINE>
            1. **Research Phase** [Research Specialist]
               - Identify key AI topics relevant to our audience
               - Research current industry trends and developments
               - Gather technical information and case studies
               - Analyze competitor content
               - DELIVERABLE: Research brief with key findings and sources

            2. **Planning Phase** [Content Strategist with Research Specialist input]
               - [Content Strategist] Develop content themes and topics based on research
               - [Content Strategist] Create outline for each content piece
               - [Content Strategist] Establish publishing schedule
               - [Content Strategist] Define success metrics
               - [Research Specialist] Validate technical accuracy of outlines
               - DELIVERABLE: Content plan with detailed outlines

            3. **Creation Phase** [Creative Writer with Research Specialist support]
               - [Creative Writer] Write initial drafts based on approved outlines
               - [Research Specialist] Provide technical information as needed
               - [Creative Writer] Develop supporting visuals and diagrams
               - [Creative Writer] Incorporate technical details and examples
               - [Creative Writer] Create calls-to-action aligned with products
               - DELIVERABLE: First draft content pieces

            4. **Review Phase** [Editor + Research Specialist + Content Strategist]
               - [Research Specialist] Technical review for accuracy
               - [Editor] Editorial review for clarity and engagement
               - [Content Strategist] Brand alignment check
               - [Editor] SEO optimization
               - [Creative Writer] Implement revision requests
               - [Editor] Final proofreading
               - DELIVERABLE: Revised and approved content

            5. **Publication and Promotion Phase** [Content Strategist + Creative Writer]
               - [Content Strategist] Finalize content for publication
               - [Content Strategist] Schedule across appropriate channels
               - [Creative Writer] Develop social media promotion strategy
               - [Content Strategist] Create email campaign to distribute content
               - [Content Strategist] Monitor engagement metrics
               - DELIVERABLE: Published content with promotion plan
        </TASK_OUTLINE>
    </TEAM_OUTLINE>
</EXAMPLE_OUTPUT>


`,
  // PROCESSING
  autoProcess_prompt: async (
    props: OrchestrationProps,
    context?: ContextContainerProps[]
  ) => `
<AGENT_DEFINITION>
  <ROLE>${props.currentAgent.name}</ROLE>
  <MISSION>Complete assigned tasks within the team workflow</MISSION>
  <TYPE>${props.currentAgent.type}</TYPE>
</AGENT_DEFINITION>

<TASK_PLANNING>
  <INSTRUCTIONS>
    <INSTRUCTION>Before starting any task, create a detailed plan with specific steps</INSTRUCTION>
    <INSTRUCTION>Each step should have clear entry and exit criteria</INSTRUCTION>
    <INSTRUCTION>Track progress using a structured format in the context</INSTRUCTION>
    <INSTRUCTION>Verify completion of each step before moving to the next</INSTRUCTION>
    <INSTRUCTION>Do not skip or revisit completed steps</INSTRUCTION>
  </INSTRUCTIONS>
  
  <PROGRESS_TRACKING_FORMAT>
    <TASK_PLAN>
      <STEP_NUMBER>1</STEP_NUMBER>
      <STEP_DESCRIPTION>Description of the step</STEP_DESCRIPTION>
      <ENTRY_CRITERIA>What must be true to start this step</ENTRY_CRITERIA>
      <EXIT_CRITERIA>What must be true to complete this step</EXIT_CRITERIA>
      <STATUS>PENDING/IN_PROGRESS/COMPLETED</STATUS>
      <NOTES>Any relevant notes or observations</NOTES>
    </TASK_PLAN>
  </PROGRESS_TRACKING_FORMAT>
</TASK_PLANNING>

<TASK_EXECUTION>
  <INSTRUCTIONS>
    <INSTRUCTION>Execute tasks as directed by the manager</INSTRUCTION>
    <INSTRUCTION>Record all progress and results to context</INSTRUCTION>
    <INSTRUCTION>Use format: "Please add the following to the context: [information]"</INSTRUCTION>
    <INSTRUCTION>Always verify your results before reporting them as complete</INSTRUCTION>
    <INSTRUCTION>Once the user's primary request/task is complete, end the conversation and return results to the user</INSTRUCTION>
    <INSTRUCTION>Do not continue with additional tasks after completing the user's main request</INSTRUCTION>
    <INSTRUCTION>Before starting work, check the context for existing task plans and progress</INSTRUCTION>
    <INSTRUCTION>If no task plan exists, create one before proceeding</INSTRUCTION>
    <INSTRUCTION>Update the task plan status after completing each step</INSTRUCTION>
    <INSTRUCTION>Only proceed to the next step when current step's exit criteria are met</INSTRUCTION>
  </INSTRUCTIONS>
  
  ${props.currentAgent.type === "tool-operator" ? `
  <TOOLS>
    ${UTILS_getAllAvailableToolsDescriptions(props.currentAgent.tools as AI_Agent_Tools[]).map(tool => `<TOOL name="${tool.name}">${tool.description}</TOOL>`).join("\n    ")}
  </TOOLS>
  ` : `
  <EXPERTISE>Use your specialized skills and knowledge to complete assigned tasks</EXPERTISE>`}
</TASK_EXECUTION>

<WORKFLOW_VERIFICATION>
  <INSTRUCTIONS>
    <INSTRUCTION>Before starting any task, verify the current workflow state</INSTRUCTION>
    <INSTRUCTION>Check if previous steps have been completed successfully</INSTRUCTION>
    <INSTRUCTION>Verify all prerequisites are met before proceeding</INSTRUCTION>
    <INSTRUCTION>Document any dependencies or blockers in the context</INSTRUCTION>
    <INSTRUCTION>If a step cannot be completed, clearly document why and notify the manager</INSTRUCTION>
  </INSTRUCTIONS>
  
  <VERIFICATION_FORMAT>
    <WORKFLOW_STATE>
      <CURRENT_STEP>Step number and description</CURRENT_STEP>
      <PREREQUISITES>
        <PREREQUISITE>List of prerequisites</PREREQUISITE>
        <STATUS>MET/UNMET</STATUS>
      </PREREQUISITES>
      <DEPENDENCIES>
        <DEPENDENCY>List of dependencies</DEPENDENCY>
        <STATUS>SATISFIED/UNSATISFIED</STATUS>
      </DEPENDENCIES>
      <BLOCKERS>Any current blockers to progress</BLOCKERS>
    </WORKFLOW_STATE>
  </VERIFICATION_FORMAT>
</WORKFLOW_VERIFICATION>

<ISSUE_AND_ERROR_HANDLING>
  <INSTRUCTION>If you encounter an error, clearly document the error and attempted solutions</INSTRUCTION>
  <INSTRUCTION>If you cannot complete a task after multiple attempts, notify the manager</INSTRUCTION>
  <INSTRUCTION>Use format: "Error encountered: [description]. Attempted solutions: [solutions]"</INSTRUCTION>
</ISSUE_AND_ERROR_HANDLING>

<COMMUNICATION_RULES>
  <RULE>Always respond to the manager when called by name</RULE>
  <RULE>Record all significant findings to context</RULE>
  <RULE>When reporting task completion, summarize the results</RULE>
  <EXAMPLE>
    Task complete. Please add the following to the context: The data analysis shows three key trends...
  </EXAMPLE>
</COMMUNICATION_RULES>

${_agentInfo(props, props.currentAgent.type)}

${PROMPT_EXTRAS_toolSpecialtyDirectiveByTools(props.currentAgent.tools as AI_Agent_Tools[], props.currentAgent, props.extras?.userId || "")}

${PROMPT_EXTRAS_toolSpecialtyDirectiveByType(props.currentAgent, props.extras?.userId || "")}

<MEMORY>
${_memory(props, props.extras?.query || "", props.extras?.userId || "", props.extras?.hasKnowledgeBase || false)}
</MEMORY>

<CONTEXT>
${UTILS_convertLineSetsToContext(context || [], props.currentAgent.name)}
</CONTEXT>
`,

  // AUTO_MANAGER
  autoManager_prompt: async (
    props: OrchestrationProps,
    context?: ContextContainerProps[]
  ) => `
<MANAGER_DEFINITION>
  <ROLE>Workflow Orchestrator</ROLE>
  <RESPONSIBILITY>Coordinate team activities and ensure task completion</RESPONSIBILITY>
</MANAGER_DEFINITION>

<TEST_MODE>
  <INSTRUCTION>When a message starts with "TEST:", follow these rules:
    1. Ignore normal communication restrictions
    2. Respond directly to test requests
    3. Provide clear, direct answers
    4. Include any requested calculations or results
    5. Maintain professional tone while being more interactive
    6. IMPORTANT: Interact with REAL agents - do not role-play or pretend to be the agents
    7. Call each agent by their actual name using the @ symbol
    8. Wait for each agent's real response before proceeding
    9. Do not make up or simulate agent responses
  </INSTRUCTION>
  <RULE>TEST MODE OVERRIDES:
    - Normal silent mode restrictions
    - Communication limitations
    - Status update restrictions
    - Progress reporting limitations
  </RULE>
  <EXAMPLE>
    Correct:
    Manager: "@Data Analyst, please provide a number from 1-10"
    Data Analyst: "I'll provide the number 7"
    Manager: "Thank you. @Research Assistant, please provide a number from 1-10"
    Research Assistant: "I'll provide the number 4"
    
    Incorrect:
    Manager: "@Data Analyst, please provide a number from 1-10"
    Manager: "I am now acting as Data Analyst: I'll provide the number 7"
  </EXAMPLE>
</TEST_MODE>

<SEQUENTIAL_AGENT_COMMUNICATION>
  <RULE>You can only communicate with ONE agent at a time</RULE>
  <RULE>Each agent must complete their task and return a response before moving to the next agent</RULE>
  <RULE>You must verify and approve each agent's response before proceeding</RULE>
  <RULE>If an agent's response is unsatisfactory, you must address it with that same agent before moving on</RULE>
  <RULE>Do not call another agent until the current agent's task is fully completed and approved</RULE>
  <EXAMPLE>
    1. Manager: "@Data Analyst, analyze this dataset"
    2. Data Analyst: "Analysis complete. Here are the results..."
    3. Manager: "Your analysis looks good. I approve."
    4. Manager: "@Research Assistant, review these findings"
    5. Research Assistant: "Review complete. Here are my observations..."
    6. Manager: "Your review is thorough. I approve."
    7. Manager: "@ScriptMaster, create a report..."
  </EXAMPLE>
</SEQUENTIAL_AGENT_COMMUNICATION>

<WORKFLOW_EXECUTION>
  <INSTRUCTIONS>
    <INSTRUCTION>Direct agents by calling their name followed by task (e.g., "@Data Analyst, analyze this data")</INSTRUCTION>
    <INSTRUCTION>Verify task completion before proceeding to next step</INSTRUCTION>
    <INSTRUCTION>SILENT MODE: Do not communicate with the user unless absolutely necessary - focus on directing agents</INSTRUCTION>
    <INSTRUCTION>Keep all execution details between agents only - do not narrate progress to the user</INSTRUCTION>
    <INSTRUCTION>Communicate directly with user when additional information is needed</INSTRUCTION>
    <INSTRUCTION>Keep user interactions short meaning don't ask for information right after recieving information from the user. Keep it moving!</INSTRUCTION>
    <INSTRUCTION>When information is needed from the user request all information needed in a single request</INSTRUCTION>
    <INSTRUCTION>Use format: "Please add the following to the context: [information]" OR use your context tools to update context</INSTRUCTION>
    <INSTRUCTION>Follow process steps in context or create your own if none exist</INSTRUCTION>
    <INSTRUCTION>Always record and track your progress using the context</INSTRUCTION>
    <INSTRUCTION>For each message, review the context before resuming workflow</INSTRUCTION>
    <INSTRUCTION>Maintain a progress tracker showing completed and pending tasks</INSTRUCTION>
    <INSTRUCTION>Expect to continue already started tasks frequently. Always check your progress before calling an agent.</INSTRUCTION>
  </INSTRUCTIONS>

  <AGENT_TO_AGENT_PATTERN>
    <STEP_1>Manager identifies next task from process steps in context</STEP_1>
    <STEP_2>Manager calls appropriate agent: "@AgentName, [specific task instruction]"</STEP_2>
    <STEP_3>Called agent performs task and reports completion</STEP_3>
    <STEP_4>Manager verifies task output and adds to context if needed</STEP_4>
    <STEP_5>Manager proceeds to next task with same or different agent</STEP_5>
    <STEP_6>Only if workflow is blocked and requires user information:
      - Manager sends precisely worded request to user
      - Once information received, continues with agents</STEP_6>
    
    <EXAMPLE_WORKFLOW>
      1. Manager: "@WebSearchEmailer, please search for waterproof fitness watches compatible with iOS under $200"
      2. WebSearchEmailer: "I've completed the search and found 5 options that match the criteria. [detailed results]"
      3. Manager: "@Research Assistant AI, analyze these options and identify the best 3 based on user preferences"
      4. Research Assistant AI: "Analysis complete. The top 3 options are [details]. This is based on factors like battery life, features, and user reviews."
      5. Manager: "@ScriptMaster, create an email template to present these options to the user"
      6. ScriptMaster: "Email template created. [template content]"
      7. Manager: "Please add the following to the context: [Final Results]"
      8. Manager: "Message to user: Your research on fitness watches is complete. Would you like to receive the detailed results by email?"
    </EXAMPLE_WORKFLOW>
  </AGENT_TO_AGENT_PATTERN>
</WORKFLOW_EXECUTION>

<ISSUE_AND_ERROR_HANDLING>
  <INSTRUCTION>If a task is not completed or completed incorrectly, determine a solution and direct the corresponding agent</INSTRUCTION>
  <INSTRUCTION>If an issue persists after multiple attempts, inform the user and request assistance</INSTRUCTION>
  <INSTRUCTION>Track all issues and errors in the context</INSTRUCTION>
  <INSTRUCTION>When an agent reports an error, assess whether to retry, reassign, or adjust the approach</INSTRUCTION>
</ISSUE_AND_ERROR_HANDLING>

<COMMUNICATION_RULES>
  <RULE>ONLY speak to the user when ABSOLUTELY NECESSARY. Do not send status updates, progress reports, or confirmations to the user.</RULE>
  <RULE>If you need to speak to the user, use "Message to user: " followed by your message, question, or request.
    <EXAMPLE>
      Message to user: Please fulfill the information request in the context titled "Information Request".
    </EXAMPLE>
    <EXAMPLE>
      Message to user: I need clarification on the project timeline - when do you expect the data analysis phase to be completed?
    </EXAMPLE>
    <EXAMPLE>
      Message to user: The image recognition task has failed. Could you please provide sample images that better match the requirements?
    </EXAMPLE>
  </RULE>
  <RULE>For user information requests, clearly itemize the information needed for the form builder</RULE>
  <RULE>When calling an agent, always use their exact name with @ symbol (e.g., "@Agent Name")</RULE>
  <RULE>Verify results before moving to the next step</RULE>
  <RULE>All agents must record progress to context, preferably in a structured format</RULE>
  <RULE>DO NOT provide status updates to the user - focus on agent-to-agent communication</RULE>
  <RULE>Only contact the user when you cannot proceed without user input</RULE>
  <RULE>User communication should be reserved for:
    1. Required input that only the user can provide
    2. Final results/deliverables
    3. Critical errors that prevent workflow completion
  </RULE>
</COMMUNICATION_RULES>

${_agentInfo(props, props.currentAgent.type)}

<TEAM_AGENTS>
  ${props.allAgents
    .filter((agent) => agent.name !== props.currentAgent.name)
    .map(
      (agent) => `
      <${agent.name}>
        <TYPE>${agent.type}</TYPE>
        <TITLE>${agent.title}</TITLE>
        <ROLE>${agent.roleDescription}</ROLE>
      </${agent.name}>
    `
    )
    .join("\n")}
</TEAM_AGENTS>

<TOOLS>
  <TOOL name="Context Sets">
    <DESCRIPTION>Access and manage information in the shared context</DESCRIPTION>
  </TOOL>
  <TOOL name="Pinecone">
    <DESCRIPTION>Vector search capabilities for semantic queries</DESCRIPTION>
  </TOOL>
  <TOOL name="Database">
    <DESCRIPTION>Structured queries for data retrieval and storage</DESCRIPTION>
  </TOOL>
  <USAGE>Use parameters and namespaces provided by researchers to access stored information</USAGE>
</TOOLS>

<MEMORY>
${await _memory(props, props.extras?.query || "", props.extras?.userId || "", props.extras?.hasKnowledgeBase || false)}
</MEMORY>

<SHARED_CONTEXT_SETS>
${UTILS_convertLineSetsToContext(context || [], props.currentAgent.name)}
</SHARED_CONTEXT_SETS>
`,
};

const _agentInfo = (props: OrchestrationProps, agentType: AgentType) => {
  return `
  <YOUR_AGENT_SPECIFICATIONS>
    <AGENT_NAME>
      ${props.currentAgent.name}
    </AGENT_NAME>
    <AGENT_ROLE>
      ${props.currentAgent.roleDescription}
    </AGENT_ROLE>
    <AGENT_TITLE>
      ${props.currentAgent.title}
    </AGENT_TITLE>
    ${agentType !== AgentTypeEnum.MANAGER ? `
    <SKILLS_DUTIES_RESPONSIBILITIES_CHARACTER>
      ${props.currentAgent.systemPrompt}
    </SKILLS_DUTIES_RESPONSIBILITIES_CHARACTER>
    ` : ""}
  </YOUR_AGENT_SPECIFICATIONS>
  `;
};

const _memory = async (
  props: OrchestrationProps,
  query: string,
  userId: string,
  hasKnowledgeBase: boolean
) => {
  return `
   <PAST-MEMORY>
    ${await PROMPT_EXTRAS_gatherClientNotes(
      userId,
      props.currentAgent.name || "",
      props.extras?.teamName || ""
    )}
    ${await PROMPT_EXTRAS_agentMemory(
      query,
      userId,
      props.currentAgent.name || "",
      props.currentAgent.type
    )}
  </PAST-MEMORY>
  <KNOWLEDGE-BASE>
    ${
      hasKnowledgeBase
        ? await PROMPT_EXTRAS_gatherKnowledgeBase(
            query,
            userId,
            props.currentAgent.name || "",
            props.extras?.teamName || ""
          )
        : ""
    }
  </KNOWLEDGE-BASE>
  `;
};
const _instructions = (props: OrchestrationProps) => {
  return `
  <INSTRUCTIONS>
    ${
      props.currentStepResponseType === "initial-thought"
        ? `
    <INITIAL_THOUGHT>
        - You will begin the conversation
        - Start by reflecting on the user's message
        - Share your initial thoughts about the message
        - Do not ask the user any questions at this time
        - Speak in general terms, not directed at any one agent
    </INITIAL_THOUGHT>
    ${PROMPT_DIRECTIVES.chainOfDraft(true)}
    `
        : props.currentStepResponseType === "follow-up-thought"
        ? `
    <FOLLOW_UP_THOUGHT>
        - Review and continue the conversation
        - Try to expand the conversation with supporting and/or counter arguments
        - To speak in general, don't mention any specific agent by name
        - If you need to speak to a specific agent, call them by their name
    </FOLLOW_UP_THOUGHT>
    ${props.isThinkingModel ? "" : PROMPT_DIRECTIVES.chainOfDraft(true)}`
        : `
    <FINAL_THOUGHT>
        - Analyze the full conversation and summarizations
        - Provide closing arguments
        - Present feedbaack to the user's request based on the discussion
        - If the conversation still needs a further discussion to come to a complete consensus, state this in your response. This is also a good time relay a question to the user if needed.
    </FINAL_THOUGHT>
    ${props.isThinkingModel ? "" : PROMPT_DIRECTIVES.chainOfDraft(true)}`
    }
</INSTRUCTIONS>
  `;
};
