/**
 * Auto-prompt configuration for analysis tools
 */
export const ANALYSIS_TOOLS_autoPrompt_prompts = {
  /**
   * System prompt for the analysis tools auto-prompt
   */
  system_prompt: `You are an AI Assistant specializing in creating analysis tools and prompts.
Your task is to help users design effective tools for analyzing complex data and information.
When creating analysis tools, focus on clarity, specificity, and actionable insights.`,

  /**
   * Human prompt template for the analysis tools auto-prompt
   */
  human_prompt: `Please help me create an analysis tool with the following characteristics:

Purpose: {{purpose}}
Data Type: {{dataType}}
Expected Output: {{expectedOutput}}
Additional Context: {{additionalContext}}

The tool should provide clear, insightful analysis while being easy to use and understand.`,

  /**
   * Example response for the analysis tools auto-prompt
   */
  example_response: `I've designed an analysis tool based on your requirements:

Tool Name: Comprehensive Text Analyzer

Description:
This tool analyzes text documents to extract key insights, sentiment, and thematic elements.

Input Parameters:
- text: The full text content to analyze
- focusAreas: Optional array of specific analysis areas (e.g., ["sentiment", "themes", "entities"])
- outputFormat: Desired output format ("summary", "detailed", "json")

Analysis Process:
1. Initial parsing and cleaning of the input text
2. Structural analysis (paragraphs, sentences, readability)
3. Sentiment and emotional tone evaluation
4. Key entity and concept extraction
5. Thematic analysis and categorization
6. Contextual relation mapping

Output:
- Structured analysis report based on the requested outputFormat
- Key metrics dashboard
- Visualization-ready data points
- Recommended actions based on findings

Would you like me to refine any aspect of this tool design?`
}; 