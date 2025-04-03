import { count } from "console";

export const rulesArray = [
  {
    functionName: "CLAMP_keepSameLength",
    value:
      "Keep the length of your response approximately the same as the original. Change all the words if necessary but KEEP THE SAME LENGTH.",
    displayName: "Keep Same Length",
    default: true,
  },
  {
    functionName: "CLAMP_restrictSyllableCount",
    value:
      "Return EXACTLY *** SYLLABLES. You may add and remove syllables as needed for sake of artistic integrity. Do not return more or less than *** syllables.",
    displayName: "Restrict Syllable Count",
    default: false,
    count: 12,
  },
  {
    functionName: "CLAMP_restrictWordCount",
    value:
      "Return EXACTLY *** WORDS. You may add and remove words as needed for sake of artistic integrity. Do not return more or less than *** words.",
    displayName: "Restrict Word Count",
    default: false,
    count: 7,
  },
  {
    functionName: "MODIFIER_ryhme",
    value: "Make sure your response is a Rhyme to the original lyric.",
    function: (baseLyric: string) => {
      return `Make sure your response is a Rhyme to ${baseLyric}`;
    },
    displayName: "Rhyme",
    default: false,
    count: 0,
  },
  {
    functionName: "MODIFIER_ryhme_before",
    value: "Make sure your response is a Rhyme to the line before.",
    function: (baseLyric: string) => {
      return `Make sure your response is a Rhyme to ${baseLyric}`;
    },
    displayName: "Rhyme Before",
    default: false,
    count: 0,
  },
  {
    functionName: "MODIFIER_ryhme_after",
    value: "Make sure your response is a Rhyme to the line after.",
    function: (baseLyric: string) => {
      return `Make sure your response is a Rhyme to ${baseLyric}`;
    },
    displayName: "Rhyme After",
    default: false,
    count: 0,
  },
  {
    functionName: "MODIFIER_phrase_as_question",
    value: "Phrase this lyric as a question.",
    displayName: "Phrase as question",
    default: false,
    count: 0,
  },
  {
    functionName: "MODIFIER_unnecessarily_complex",
    value: "Make this lyric unnecessarily complex and convoluted.",
    displayName: "Unnecessarily Complex",
    default: false,
    count: 0,
  },
];
