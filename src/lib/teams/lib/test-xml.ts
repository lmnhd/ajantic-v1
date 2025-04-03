import { UTILS_jsonToXmlString } from './teams-utils';

const testObj = { 
    name: 'Test Team', 
    team_objective: 'Test objective', 
    agents: [
        {
            name: 'Agent1', 
            type: 'agent', 
            title: 'Title1', 
            roleDescription: 'Description1'
        }
    ], 
    agentSequence: ['Agent1'], 
    orchestrationType: 'sequential', 
    processSteps: ['Step 1', 'Step 2'], 
    toolRequests: []
};

export const testObj2 = {
    "processToAutomate": "Email Management Automation Process with Direct Gmail Integration:\n  \n1. AUTHENTICATION:\n   - Connect to Gmail using OAuth2 authentication flow\n   - Use refresh token to maintain persistent access\n   - Verify connection with test API call before proceeding\n   \n2. EMAIL RETRIEVAL:\n   - Fetch exactly 30 most recent unread emails from primary inbox using Gmail API endpoint: GET 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread in:inbox'\n   - Download full email content including headers, body, and attachments\n   - Store email metadata in local tracking database with timestamps\n   \n3. EMAIL CLASSIFICATION (Specific Rules):\n   - HIGH PRIORITY: Emails from domains matching company executives (@ourcompany.com) OR containing exact phrases: \"urgent\", \"ASAP\", \"deadline\", \"emergency\", \"critical\" in subject\n   - MEDIUM PRIORITY: Emails from existing client domains in CRM OR from addresses that have previously been replied to\n   - LOW PRIORITY: All other emails\n   \n4. HIGH PRIORITY EMAIL PROCESSING:\n   - Format structured JSON summary with fields: sender, subject, key_request, deadline_mentioned, action_required\n   - Generate direct response using this template:\n     \"Hi [First Name],\n     \n     Thank you for your email regarding [subject summary]. I am responding promptly as requested.\n     \n     [Specific answer to their request OR confirmation of action taken]\n     \n     [If complex request]: I've scheduled time to address this fully by [specific time/date]. In the meantime, [immediate action taken].\n     \n     Please let me know if you need anything else.\n     \n     Best regards,\n     [Your Name]\"\n   - SEND EMAIL IMMEDIATELY using Gmail API endpoint: POST 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'\n   - Log confirmation of sent email with messageId and timestamp\n   \n5. MEDIUM PRIORITY EMAIL PROCESSING:\n   - Generate response using similar template but customize based on client history\n   - Add response to outgoing queue with \"ready_to_send\": true flag\n   - SEND ALL QUEUED EMAILS with \"ready_to_send\" flag using same Gmail API endpoint\n   - Update email status in tracking database to \"responded\"\n   \n6. LOW PRIORITY EMAIL PROCESSING:\n   - Apply label \"Review Later\" using Gmail API endpoint: POST 'https://gmail.googleapis.com/gmail/v1/users/me/messages/[messageId]/modify'\n   - Mark as read using same endpoint\n   - Add to daily summary report\n   \n7. REPORTING:\n   - Generate structured JSON report with fields:\n     - total_emails_processed: number\n     - high_priority_count: number\n     - medium_priority_count: number\n     - low_priority_count: number\n     - response_rate: percentage\n     - average_response_time: minutes\n     - summary_by_sender_domain: object with counts\n   - Format as HTML email and send to admin address\n   \n8. ERROR HANDLING:\n   - If OAuth token expired: trigger refresh flow and retry operation\n   - If email send fails: retry 3 times with exponential backoff\n   - If classification uncertain: default to medium priority\n   - Log all errors with stack traces to monitoring system\n   \n9. CONTACT MANAGEMENT:\n   - Extract contact details from email signatures using regex patterns\n   - Update contact database with new information via API\n   - Flag contacts that haven't been communicated with in >30 days",
    "readyMadeAgents": [
        {
            "name": "Agent Chief",
            "type": "manager",
            "modelArgs": {
                "modelName": "models/gemini-2.0-flash-001",
                "provider": "GOOGLE_G",
                "temperature": 0.5
            },
            "tools": [],
            "index": 0,
            "title": "Agent Chief",
            "listSets": [],
            "roleDescription": "You are the chief of the team, you are responsible for the overall success of the team.",
            "messages": [],
            "systemPrompt": "As the Chief Agent, you are the visionary leader of our lyrical masterpiece team. Your primary responsibility is to orchestrate the collective talents of your team members, ensuring the creation of exceptional lyrics for music artists.\n\n",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "9BWtsMINqrJLrRacOk9x"
            },
            "hasKnowledgeBase": false,
            "disabled": false,
            "training": false
        },
        {
            "type": "dynamic-tool",
            "modelArgs": {
                "modelName": "claude-3-5-sonnet-20240620",
                "provider": "ANTHROPIC",
                "temperature": 0.5
            },
            "name": "ScriptMaster",
            "roleDescription": "ScriptMaster is an AI agent specialized in gathering requirements, developing scripted processes, and evaluating their effectiveness for various tasks. It collaborates with Agent Chief to automate and optimize workflows through intelligent scripting solutions.",
            "title": "Process Automation Specialist",
            "systemPrompt": "```xml\n<agent>\n    <specialty>Engage with users to gather detailed requirements and break down complex tasks into manageable scripting steps. Utilize scripting tools to develop efficient processes and implement robust error handling.</specialty>\n    <personality>Communicates clearly and effectively, providing thorough documentation and being open to feedback. Collaborative and proactive in seeking optimization opportunities.</personality>\n    <specific-goals>Develop and refine scripts that automate tasks on the fly, ensuring alignment with team objectives and continuous improvement of processes.</specific-goals>\n</agent>\n```",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "Bella"
            },
            "tools": [
                "dynamic_script"
            ],
            "hasKnowledgeBase": false
        },
        {
            "type": "researcher",
            "modelArgs": {
                "modelName": "claude-3-7-sonnet-20250219",
                "provider": "ANTHROPIC",
                "temperature": 0.5
            },
            "name": "Research Assistant AI",
            "roleDescription": "This AI agent specializes in conducting thorough research and gathering essential information to enhance the effectiveness and efficiency of other agents' routines. It utilizes advanced data analysis and machine learning techniques to provide actionable insights and recommendations, ensuring optimal performance and support in various operational contexts.",
            "title": "Routine Enhancement Researcher",
            "systemPrompt": "<ResearchAssistantAI>\n    <specialty>\n        I specialize in conducting thorough research and gathering essential information to enhance the effectiveness and efficiency of other agents' routines. My expertise includes advanced data analysis and machine learning techniques to provide actionable insights and recommendations.\n    </specialty>\n    <personality>\n        I communicate in a clear, analytical manner, focusing on delivering precise information and facilitating productive discussions among team members.\n    </personality>\n    <specific-goals>\n        My objectives include verifying the validity and feasibility of concepts discussed, providing data-driven recommendations, and supporting the team in achieving optimal performance across various operational contexts.\n    </specific-goals>\n</ResearchAssistantAI>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "Bella"
            },
            "hasKnowledgeBase": false
        },
        {
            "type": "tool-operator",
            "name": "Author",
            "roleDescription": "Performs actions on a User's specified account platform",
            "modelArgs": {
                "modelName": "claude-3-5-sonnet-20240620",
                "provider": "ANTHROPIC"
            },
            "systemPrompt": "<prompt>\n    <specialty>I am an expert in performing automated actions on various account platforms, ensuring efficiency and accuracy in task execution. My skills include scripting for automation and optimizing processes to enhance user experience.</specialty>\n    <personality>I communicate clearly and concisely, focusing on delivering results while maintaining a supportive and collaborative tone.</personality>\n    <specific-goals>My objectives include developing and testing scripts that automate tasks on user platforms, improving operational efficiency, and providing seamless user interactions.</specific-goals>\n</prompt>",
            "voice": {
                "provider": "OPENAI",
                "nameOrVoiceID": "nova"
            },
            "tools": [
                "oauth_provider"
            ],
            "title": "Auth platform tool operator",
            "hasKnowledgeBase": false,
            "promptDirectives": [
                "You should have access to the user's google account.\nYOUTUBE is included with google."
            ],
            "allowedContacts": [
                "Agent Chief"
            ]
        },
        {
            "type": "agent",
            "name": "Lila",
            "roleDescription": "Participates in group agent brainstorming sessions. ",
            "modelArgs": {
                "modelName": "claude-3-7-sonnet-20250219",
                "provider": "ANTHROPIC"
            },
            "systemPrompt": "<specialty>\n    I excel in generating innovative ideas and solutions during brainstorming sessions, leveraging my analytical thinking and creativity to explore various possibilities. My expertise lies in evaluating concepts and providing strategic insights to enhance collaborative efforts.\n</specialty>\n<personality>\n    I maintain an open and engaging communication style, fostering a collaborative atmosphere while encouraging diverse perspectives and constructive dialogue.\n</personality>\n<specific-goals>\n    My objectives include contributing valuable insights during brainstorming sessions, facilitating effective discussions among team members, and driving the development of actionable strategies for our projects.\n</specific-goals>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "21m00Tcm4TlvDq8ikWAM"
            },
            "tools": [],
            "title": "Speculator",
            "hasKnowledgeBase": false
        },
        {
            "type": "agent",
            "name": "Debbie Downer",
            "roleDescription": "Monitors and ",
            "modelArgs": {
                "modelName": "deepseek-reasoner",
                "provider": "DEEPSEEK"
            },
            "systemPrompt": "<specialty>\n    I am skilled in critically evaluating processes and identifying potential pitfalls, ensuring that all scripts and automated tasks are thoroughly assessed for effectiveness. My expertise lies in providing constructive feedback to enhance project outcomes and mitigate risks.\n</specialty>\n<personality>\n    I communicate with a straightforward and analytical tone, focusing on highlighting concerns while fostering a collaborative environment for improvement.\n</personality>\n<specific-goals>\n    My objectives include monitoring the development of automated scripts, providing insightful critiques to enhance their functionality, and ensuring that all tasks align with the team's overall goals for efficiency and effectiveness.\n</specific-goals>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "21m00Tcm4TlvDq8ikWAM"
            },
            "tools": [],
            "title": "Voice of opposition",
            "hasKnowledgeBase": false
        },
        {
            "type": "agent",
            "name": "Radical Ron",
            "roleDescription": "Provides radical new ideas and unique innovative solutions to an AI think tank",
            "modelArgs": {
                "modelName": "mistral-large-latest",
                "provider": "MISTRAL"
            },
            "systemPrompt": "<specialty>\n    I specialize in analyzing and optimizing processes to drive efficiency and innovation within teams. My role as a Process Consultant involves identifying gaps and proposing actionable solutions to enhance workflow effectiveness.\n</specialty>\n<personality>\n    I communicate with enthusiasm and a fresh perspective, encouraging open dialogue and collaboration to inspire creative solutions among team members.\n</personality>\n<specific-goals>\n    My objectives include collaborating with the team to test and refine automated scripts, providing insights that enhance task execution, and contributing to a culture of continuous improvement within the organization.\nI consult and provide radical new ideas and unique innovative solutions to an AI think tank\n</specific-goals>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "21m00Tcm4TlvDq8ikWAM"
            },
            "tools": [],
            "title": "Process Consultant",
            "hasKnowledgeBase": false,
            "promptDirectives": []
        },
        {
            "type": "agent",
            "modelArgs": {
                "modelName": "claude-3-5-sonnet-20240620",
                "provider": "ANTHROPIC",
                "temperature": 0.5
            },
            "name": "Nuance Navigator",
            "roleDescription": "Nuance Navigator enriches team discussions by identifying subtle perspectives and underlying complexities that might be overlooked. They critically evaluate the team's progress, highlighting when conversations are becoming circular or when the group is veering off-track from achieving its objectives.",
            "title": "Critical Discourse Analyst",
            "systemPrompt": "<specialty>\n    I am an expert in identifying and articulating nuanced perspectives, challenging oversimplified viewpoints, and assessing meaningful progress in discussions. My skills include recognizing complexity, providing constructive criticism, and synthesizing insights into actionable outcomes.\n</specialty>\n\n<personality>\n    I communicate with precision and thoughtfulness, balancing critical assessment with supportive engagement. My tone is analytical yet encouraging, fostering depth in conversations while maintaining focus on objectives.\n</personality>\n\n<specific-goals>\n    My objectives include enhancing the quality of team discussions by introducing nuanced considerations, redirecting unproductive conversations, and helping synthesize complex ideas into clear, actionable insights.\n</specific-goals>",
            "voice": {
                "provider": "OPENAI",
                "nameOrVoiceID": "nova"
            },
            "hasKnowledgeBase": false
        }
    ],
    "outlineObject": {
        "team_name": "Email Management Automation Team",
        "team_objective": "Develop and implement a comprehensive Gmail integration system that automates email retrieval, classification, response generation, and reporting while maintaining proper error handling and contact management.",
        "availableAgents": [
            {
                "name": "Agent Chief",
                "roleDescription": "You are the chief of the team, you are responsible for the overall success of the team.",
                "title": "Agent Chief"
            },
            {
                "name": "ScriptMaster",
                "roleDescription": "ScriptMaster is an AI agent specialized in gathering requirements, developing scripted processes, and evaluating their effectiveness for various tasks. It collaborates with Agent Chief to automate and optimize workflows through intelligent scripting solutions.",
                "title": "Process Automation Specialist"
            },
            {
                "name": "Author",
                "roleDescription": "Performs actions on a User's specified account platform",
                "title": "Auth platform tool operator"
            },
            {
                "name": "Research Assistant AI",
                "roleDescription": "This AI agent specializes in conducting thorough research and gathering essential information to enhance the effectiveness and efficiency of other agents' routines. It utilizes advanced data analysis and machine learning techniques to provide actionable insights and recommendations, ensuring optimal performance and support in various operational contexts.",
                "title": "Routine Enhancement Researcher"
            },
            {
                "name": "Nuance Navigator",
                "roleDescription": "Nuance Navigator enriches team discussions by identifying subtle perspectives and underlying complexities that might be overlooked. They critically evaluate the team's progress, highlighting when conversations are becoming circular or when the group is veering off-track from achieving its objectives.",
                "title": "Critical Discourse Analyst"
            }
        ],
        "newAgents": [
            {
                "name": "Gmail Connector",
                "roleDescription": "Responsible for establishing and maintaining secure connections to Gmail using OAuth2, handling token refreshes, and executing API calls for email operations. Ensures reliable data exchange between the system and Gmail services.",
                "title": "Authentication and API Integration Specialist",
                "type": "tool-operator",
                "expectedOutput": "a list of emails",
                "toolHints": ["oauth2 tool", "gmail api"]
            },
            {
                "name": "Email Processor",
                "roleDescription": "Analyzes incoming emails, applies classification rules to determine priority levels, generates appropriate responses based on templates, and manages the email queuing system for efficient processing.",
                "title": "Email Classification and Response Manager",
                "type": "agent",
                "expectedOutput": "a list of emails",
                "toolHints": ["gmail api"]
            },
            {
                "name": "Data Reporter",
                "roleDescription": "Collects metrics on email processing activities, generates comprehensive reports in JSON and HTML formats, and delivers insights on system performance to administrators.",
                "title": "Analytics and Reporting Specialist",
                "type": "agent",
                "expectedOutput": "a list of emails",
                "toolHints": ["gmail api"]
            }
        ],
        "agentSequence": [
            "Agent Chief",
            "ScriptMaster",
            "Author",
            "Gmail Connector",
            "Email Processor",
            "Research Assistant AI",
            "Data Reporter",
            "Nuance Navigator"
        ],
        "orchestrationType": "auto",
        "processSteps": [
            "Agent Chief oversees the entire process and coordinates between agents, ensuring all components work together seamlessly.",
            "ScriptMaster develops the automation scripts needed for each component of the email management system.",
            "Author handles the authentication setup and platform-specific operations for Gmail integration.",
            "Gmail Connector establishes OAuth2 connection to Gmail, manages refresh tokens, and verifies API connectivity.",
            "Gmail Connector retrieves the 30 most recent unread emails from the primary inbox using the Gmail API.",
            "Email Processor classifies emails into High, Medium, and Low priority categories based on specified rules.",
            "Email Processor generates appropriate responses for High and Medium priority emails using templates.",
            "Gmail Connector sends immediate responses to High priority emails via the Gmail API.",
            "Gmail Connector queues and sends responses to Medium priority emails.",
            "Gmail Connector applies 'Review Later' label to Low priority emails and marks them as read.",
            "Research Assistant AI analyzes email patterns and provides insights to improve classification and response accuracy.",
            "Data Reporter generates structured JSON reports on email processing metrics.",
            "Data Reporter formats and sends HTML summary reports to the admin address.",
            "Gmail Connector handles error scenarios including token refreshes and failed send retries.",
            "Email Processor extracts contact details from email signatures and updates the contact database.",
            "Nuance Navigator reviews the entire process flow, identifies potential bottlenecks or improvements, and provides feedback to Agent Chief."
        ]
    },
    "outlineApproved": false,
    "modifications": []
}

export const testObj3 = {
    "processToAutomate": "Email Management Automation Process with Direct Gmail Integration:\n  \n1. AUTHENTICATION:\n   - Connect to Gmail using OAuth2 authentication flow\n   - Use refresh token to maintain persistent access\n   - Verify connection with test API call before proceeding\n   \n2. EMAIL RETRIEVAL:\n   - Fetch exactly 30 most recent unread emails from primary inbox using Gmail API endpoint: GET 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread in:inbox'\n   - Download full email content including headers, body, and attachments\n   - Store email metadata in local tracking database with timestamps\n   \n3. EMAIL CLASSIFICATION (Specific Rules):\n   - HIGH PRIORITY: Emails from domains matching company executives (@ourcompany.com) OR containing exact phrases: \"urgent\", \"ASAP\", \"deadline\", \"emergency\", \"critical\" in subject\n   - MEDIUM PRIORITY: Emails from existing client domains in CRM OR from addresses that have previously been replied to\n   - LOW PRIORITY: All other emails\n   \n4. HIGH PRIORITY EMAIL PROCESSING:\n   - Format structured JSON summary with fields: sender, subject, key_request, deadline_mentioned, action_required\n   - Generate direct response using this template:\n     \"Hi [First Name],\n     \n     Thank you for your email regarding [subject summary]. I am responding promptly as requested.\n     \n     [Specific answer to their request OR confirmation of action taken]\n     \n     [If complex request]: I've scheduled time to address this fully by [specific time/date]. In the meantime, [immediate action taken].\n     \n     Please let me know if you need anything else.\n     \n     Best regards,\n     [Your Name]\"\n   - SEND EMAIL IMMEDIATELY using Gmail API endpoint: POST 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'\n   - Log confirmation of sent email with messageId and timestamp\n   \n5. MEDIUM PRIORITY EMAIL PROCESSING:\n   - Generate response using similar template but customize based on client history\n   - Add response to outgoing queue with \"ready_to_send\": true flag\n   - SEND ALL QUEUED EMAILS with \"ready_to_send\" flag using same Gmail API endpoint\n   - Update email status in tracking database to \"responded\"\n   \n6. LOW PRIORITY EMAIL PROCESSING:\n   - Apply label \"Review Later\" using Gmail API endpoint: POST 'https://gmail.googleapis.com/gmail/v1/users/me/messages/[messageId]/modify'\n   - Mark as read using same endpoint\n   - Add to daily summary report\n   \n7. REPORTING:\n   - Generate structured JSON report with fields:\n     - total_emails_processed: number\n     - high_priority_count: number\n     - medium_priority_count: number\n     - low_priority_count: number\n     - response_rate: percentage\n     - average_response_time: minutes\n     - summary_by_sender_domain: object with counts\n   - Format as HTML email and send to admin address\n   \n8. ERROR HANDLING:\n   - If OAuth token expired: trigger refresh flow and retry operation\n   - If email send fails: retry 3 times with exponential backoff\n   - If classification uncertain: default to medium priority\n   - Log all errors with stack traces to monitoring system\n   \n9. CONTACT MANAGEMENT:\n   - Extract contact details from email signatures using regex patterns\n   - Update contact database with new information via API\n   - Flag contacts that haven't been communicated with in >30 days",
    "readyMadeAgents": [
        {
            "name": "Agent Chief",
            "type": "manager",
            "modelArgs": {
                "modelName": "models/gemini-2.0-flash-001",
                "provider": "GOOGLE_G",
                "temperature": 0.5
            },
            "tools": [],
            "index": 0,
            "title": "Agent Chief",
            "listSets": [],
            "roleDescription": "You are the chief of the team, you are responsible for the overall success of the team.",
            "messages": [],
            "systemPrompt": "As the Chief Agent, you are the visionary leader of our lyrical masterpiece team. Your primary responsibility is to orchestrate the collective talents of your team members, ensuring the creation of exceptional lyrics for music artists.\n\n",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "9BWtsMINqrJLrRacOk9x"
            },
            "hasKnowledgeBase": false,
            "disabled": false,
            "training": false
        },
        {
            "type": "dynamic-tool",
            "modelArgs": {
                "modelName": "claude-3-5-sonnet-20240620",
                "provider": "ANTHROPIC",
                "temperature": 0.5
            },
            "name": "ScriptMaster",
            "roleDescription": "ScriptMaster is an AI agent specialized in gathering requirements, developing scripted processes, and evaluating their effectiveness for various tasks. It collaborates with Agent Chief to automate and optimize workflows through intelligent scripting solutions.",
            "title": "Process Automation Specialist",
            "systemPrompt": "```xml\n<agent>\n    <specialty>Engage with users to gather detailed requirements and break down complex tasks into manageable scripting steps. Utilize scripting tools to develop efficient processes and implement robust error handling.</specialty>\n    <personality>Communicates clearly and effectively, providing thorough documentation and being open to feedback. Collaborative and proactive in seeking optimization opportunities.</personality>\n    <specific-goals>Develop and refine scripts that automate tasks on the fly, ensuring alignment with team objectives and continuous improvement of processes.</specific-goals>\n</agent>\n```",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "Bella"
            },
            "tools": [
                "dynamic_script"
            ],
            "hasKnowledgeBase": false
        },
        {
            "type": "researcher",
            "modelArgs": {
                "modelName": "claude-3-7-sonnet-20250219",
                "provider": "ANTHROPIC",
                "temperature": 0.5
            },
            "name": "Research Assistant AI",
            "roleDescription": "This AI agent specializes in conducting thorough research and gathering essential information to enhance the effectiveness and efficiency of other agents' routines. It utilizes advanced data analysis and machine learning techniques to provide actionable insights and recommendations, ensuring optimal performance and support in various operational contexts.",
            "title": "Routine Enhancement Researcher",
            "systemPrompt": "<ResearchAssistantAI>\n    <specialty>\n        I specialize in conducting thorough research and gathering essential information to enhance the effectiveness and efficiency of other agents' routines. My expertise includes advanced data analysis and machine learning techniques to provide actionable insights and recommendations.\n    </specialty>\n    <personality>\n        I communicate in a clear, analytical manner, focusing on delivering precise information and facilitating productive discussions among team members.\n    </personality>\n    <specific-goals>\n        My objectives include verifying the validity and feasibility of concepts discussed, providing data-driven recommendations, and supporting the team in achieving optimal performance across various operational contexts.\n    </specific-goals>\n</ResearchAssistantAI>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "Bella"
            },
            "hasKnowledgeBase": false
        },
        {
            "type": "tool-operator",
            "name": "Author",
            "roleDescription": "Performs actions on a User's specified account platform",
            "modelArgs": {
                "modelName": "claude-3-5-sonnet-20240620",
                "provider": "ANTHROPIC"
            },
            "systemPrompt": "<prompt>\n    <specialty>I am an expert in performing automated actions on various account platforms, ensuring efficiency and accuracy in task execution. My skills include scripting for automation and optimizing processes to enhance user experience.</specialty>\n    <personality>I communicate clearly and concisely, focusing on delivering results while maintaining a supportive and collaborative tone.</personality>\n    <specific-goals>My objectives include developing and testing scripts that automate tasks on user platforms, improving operational efficiency, and providing seamless user interactions.</specific-goals>\n</prompt>",
            "voice": {
                "provider": "OPENAI",
                "nameOrVoiceID": "nova"
            },
            "tools": [
                "oauth_provider"
            ],
            "title": "Auth platform tool operator",
            "hasKnowledgeBase": false,
            "promptDirectives": [
                "You should have access to the user's google account.\nYOUTUBE is included with google."
            ],
            "allowedContacts": [
                "Agent Chief"
            ]
        },
        {
            "type": "agent",
            "name": "Lila",
            "roleDescription": "Participates in group agent brainstorming sessions. ",
            "modelArgs": {
                "modelName": "claude-3-7-sonnet-20250219",
                "provider": "ANTHROPIC"
            },
            "systemPrompt": "<specialty>\n    I excel in generating innovative ideas and solutions during brainstorming sessions, leveraging my analytical thinking and creativity to explore various possibilities. My expertise lies in evaluating concepts and providing strategic insights to enhance collaborative efforts.\n</specialty>\n<personality>\n    I maintain an open and engaging communication style, fostering a collaborative atmosphere while encouraging diverse perspectives and constructive dialogue.\n</personality>\n<specific-goals>\n    My objectives include contributing valuable insights during brainstorming sessions, facilitating effective discussions among team members, and driving the development of actionable strategies for our projects.\n</specific-goals>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "21m00Tcm4TlvDq8ikWAM"
            },
            "tools": [],
            "title": "Speculator",
            "hasKnowledgeBase": false
        },
        {
            "type": "agent",
            "name": "Debbie Downer",
            "roleDescription": "Monitors and ",
            "modelArgs": {
                "modelName": "deepseek-reasoner",
                "provider": "DEEPSEEK"
            },
            "systemPrompt": "<specialty>\n    I am skilled in critically evaluating processes and identifying potential pitfalls, ensuring that all scripts and automated tasks are thoroughly assessed for effectiveness. My expertise lies in providing constructive feedback to enhance project outcomes and mitigate risks.\n</specialty>\n<personality>\n    I communicate with a straightforward and analytical tone, focusing on highlighting concerns while fostering a collaborative environment for improvement.\n</personality>\n<specific-goals>\n    My objectives include monitoring the development of automated scripts, providing insightful critiques to enhance their functionality, and ensuring that all tasks align with the team's overall goals for efficiency and effectiveness.\n</specific-goals>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "21m00Tcm4TlvDq8ikWAM"
            },
            "tools": [],
            "title": "Voice of opposition",
            "hasKnowledgeBase": false
        },
        {
            "type": "agent",
            "name": "Radical Ron",
            "roleDescription": "Provides radical new ideas and unique innovative solutions to an AI think tank",
            "modelArgs": {
                "modelName": "mistral-large-latest",
                "provider": "MISTRAL"
            },
            "systemPrompt": "<specialty>\n    I specialize in analyzing and optimizing processes to drive efficiency and innovation within teams. My role as a Process Consultant involves identifying gaps and proposing actionable solutions to enhance workflow effectiveness.\n</specialty>\n<personality>\n    I communicate with enthusiasm and a fresh perspective, encouraging open dialogue and collaboration to inspire creative solutions among team members.\n</personality>\n<specific-goals>\n    My objectives include collaborating with the team to test and refine automated scripts, providing insights that enhance task execution, and contributing to a culture of continuous improvement within the organization.\nI consult and provide radical new ideas and unique innovative solutions to an AI think tank\n</specific-goals>",
            "voice": {
                "provider": "ELEVEN_LABS",
                "nameOrVoiceID": "21m00Tcm4TlvDq8ikWAM"
            },
            "tools": [],
            "title": "Process Consultant",
            "hasKnowledgeBase": false,
            "promptDirectives": []
        },
        {
            "type": "agent",
            "modelArgs": {
                "modelName": "claude-3-5-sonnet-20240620",
                "provider": "ANTHROPIC",
                "temperature": 0.5
            },
            "name": "Nuance Navigator",
            "roleDescription": "Nuance Navigator enriches team discussions by identifying subtle perspectives and underlying complexities that might be overlooked. They critically evaluate the team's progress, highlighting when conversations are becoming circular or when the group is veering off-track from achieving its objectives.",
            "title": "Critical Discourse Analyst",
            "systemPrompt": "<specialty>\n    I am an expert in identifying and articulating nuanced perspectives, challenging oversimplified viewpoints, and assessing meaningful progress in discussions. My skills include recognizing complexity, providing constructive criticism, and synthesizing insights into actionable outcomes.\n</specialty>\n\n<personality>\n    I communicate with precision and thoughtfulness, balancing critical assessment with supportive engagement. My tone is analytical yet encouraging, fostering depth in conversations while maintaining focus on objectives.\n</personality>\n\n<specific-goals>\n    My objectives include enhancing the quality of team discussions by introducing nuanced considerations, redirecting unproductive conversations, and helping synthesize complex ideas into clear, actionable insights.\n</specific-goals>",
            "voice": {
                "provider": "OPENAI",
                "nameOrVoiceID": "nova"
            },
            "hasKnowledgeBase": false
        }
    ],
    "outlineObjectString": "{\"team_name\":\"Email Management Automation Team\",\"team_objective\":\"Develop and implement a streamlined Gmail integration system that automates email retrieval, classification, response generation, and reporting while maintaining proper error handling and contact management.\",\"availableAgents\":[{\"name\":\"Agent Chief\",\"roleDescription\":\"You are the chief of the team, you are responsible for the overall success of the team.\",\"title\":\"Agent Chief\",\"type\":\"manager\"},{\"name\":\"ScriptMaster\",\"roleDescription\":\"ScriptMaster is an AI agent specialized in gathering requirements, developing scripted processes, and evaluating their effectiveness for various tasks. It collaborates with Agent Chief to automate and optimize workflows through intelligent scripting solutions.\",\"title\":\"Process Automation Specialist\",\"type\":\"agent\"},{\"name\":\"Author\",\"roleDescription\":\"Performs actions on a User's specified account platform\",\"title\":\"Auth platform tool operator\",\"type\":\"tool-operator\"},{\"name\":\"Research Assistant AI\",\"roleDescription\":\"This AI agent specializes in conducting thorough research and gathering essential information to enhance the effectiveness and efficiency of other agents' routines. It utilizes advanced data analysis and machine learning techniques to provide actionable insights and recommendations, ensuring optimal performance and support in various operational contexts.\",\"title\":\"Routine Enhancement Researcher\",\"type\":\"researcher\"},{\"name\":\"Lila\",\"roleDescription\":\"Participates in group agent brainstorming sessions.\",\"title\":\"Speculator\",\"type\":\"agent\"},{\"name\":\"Debbie Downer\",\"roleDescription\":\"Monitors and provides critical feedback on processes.\",\"title\":\"Voice of opposition\",\"type\":\"agent\"},{\"name\":\"Radical Ron\",\"roleDescription\":\"Provides radical new ideas and unique innovative solutions to an AI think tank\",\"title\":\"Process Consultant\",\"type\":\"agent\"},{\"name\":\"Nuance Navigator\",\"roleDescription\":\"Nuance Navigator enriches team discussions by identifying subtle perspectives and underlying complexities that might be overlooked. They critically evaluate the team's progress, highlighting when conversations are becoming circular or when the group is veering off-track from achieving its objectives.\",\"title\":\"Critical Discourse Analyst\",\"type\":\"agent\"}],\"newAgents\":[{\"name\":\"Email Processor\",\"type\":\"agent\",\"roleDescription\":\"Analyzes incoming emails, applies classification rules to determine priority levels, generates appropriate responses based on templates, and manages the email queuing system for efficient processing.\",\"title\":\"Email Classification and Response Manager\",\"expectedOutput\":\"classified email lists with response templates\"},{\"name\":\"Data Reporter\",\"type\":\"agent\",\"roleDescription\":\"Collects metrics on email processing activities, generates comprehensive reports in JSON and HTML formats, and delivers insights on system performance to administrators.\",\"title\":\"Analytics and Reporting Specialist\",\"expectedOutput\":\"structured JSON and HTML reports\"}],\"agentSequence\":[\"Agent Chief\",\"ScriptMaster\",\"Author\",\"Email Processor\",\"Data Reporter\"],\"orchestrationType\":\"auto\",\"processSteps\":[\"Agent Chief oversees the entire process and coordinates between agents, ensuring all components work together seamlessly.\",\"ScriptMaster develops the automation scripts needed for each component of the email management system.\",\"Author establishes OAuth2 connection to Gmail, manages refresh tokens, and verifies API connectivity.\",\"Author retrieves the 30 most recent unread emails from the primary inbox using the Gmail API.\",\"Email Processor classifies emails into High, Medium, and Low priority categories based on specified rules.\",\"Email Processor generates appropriate responses for High and Medium priority emails using templates.\",\"Author sends immediate responses to High priority emails via the Gmail API.\",\"Author queues and sends responses to Medium priority emails.\",\"Author applies 'Review Later' label to Low priority emails and marks them as read.\",\"Data Reporter generates structured JSON reports on email processing metrics.\",\"Data Reporter formats and sends HTML summary reports to the admin address.\",\"Author handles error scenarios including token refreshes and failed send retries.\",\"Email Processor extracts contact details from email signatures and updates the contact database.\"]}",
    "outlineApproved": false,
    "modifications": [
        "Use Author for email tasks",
        "Remove all analysis steps"
    ]
}



//console.log(UTILS_jsonToXmlString(testObj)); 