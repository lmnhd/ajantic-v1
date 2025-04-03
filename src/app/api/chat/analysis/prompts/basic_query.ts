import { LineLyricType } from "@/components/songeditor/lyric/line";
import { ContextContainerProps } from "@/src/lib/types";

export const PROMPT_ANALYSIS_QUERY1 = {
  general: (
    sets: ContextContainerProps[]
  ) => `IMPORTANT: For technical reasons, Please respond with the answer AND NO additional conversation. You will answer the user's question using the following lyric sets...

    <lyric-sets>

    ${sets
      .filter(set => !set.isDisabled)
      .map(
        (set: ContextContainerProps, index: number) => `<${set.setName}> 
        ${set.text ? set.text + '\n' : set.lines?.map(line => line.content).join("\n")}
        

        </${set.setName}>`
      )
      .join("\n")}
      </lyric-sets>
      `,
};
