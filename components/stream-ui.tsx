import AiValue from "@/app/(main)/dashboard/aivalue";
import { ProcessLyricProps } from "@/src/lib/types";

export async function renderResponseUI({
    options,
    props,
  }: {
    options: string[];
    props: ProcessLyricProps;
  }) {
    return (
      <div className="flex flex-col gap-6 items-center w-full min-w-full">
        <p className="mb-3">Please choose a result...</p>
        <div className="flex flex-col items-center gap-4 h-[300px] overflow-y-scroll  mx-2 w-full ">
          {options &&
            options.map((option: string, index: number) => {
              //console.log("Option: ",firstCallProps.history)
              return <AiValue key={index} text={option} />;
            })}
        </div>
      </div>
    );
  }