export const PROMPT_DIRECTIVES = {
  chainOfThought: (xml: boolean = false) => {
    if (xml) {
      return `
        <method>
            Think step by step to answer the following question.
            Return the answer at the end of the response after a separator ####.
        </method>
        `;
    } else {
      return `
        Think step by step to answer the following question.
        Return the answer at the end of the response after a separator ####.
        `;
    }
  },
  chainOfDraft: (xml: boolean = false) => {
    if (xml) {
      return `
        <method>
            Think step by step, but only keep a minimum draft for each thinking step, with 10 words or less.
            Return the answer at the end of the response after a separator ####.
        </method>
        `;
    } else {
      return `
        Think step by step, but only keep a minimum draft for each thinking step, with 10 words or less.
        Return the answer at the end of the response after a separator ####.
        `;
    }
  },
  // A directive for thinking models to not print what they are thinking, only print the answer
  thinkSilently: (xml: boolean = false) => {
    if (xml) {
      return `
        <method>
            Think step by step internally to answer the following question.
            Do not show your thinking process in your response.
            Only return the final answer without any explanation or working.
        </method>
        `;
    } else {
      return `
        Think step by step internally to answer the following question.
        Do not show your thinking process in your response.
        Only return the final answer without any explanation or working.
        `;
    }
  },
};
