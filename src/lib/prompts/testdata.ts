// "ANALYSIS" | "NOTES" | "RETRY" | "PASS" | "COMPLETE" | "FAIL"
// PASS
export function TEST_DATA_TRANSCRIPT_fail_1() {
  return `
CLIENT:  hello

ASSISTANT-LINE MASTER: Hello! How can I assist you today?

CLIENT:  can you please add a random line to a new set in the context named 'Pinky"?

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

    <Charlotte>
        random lines suck!
    </Charlotte>

</PROJECT_CONTEXT>

`;
}

export function TEST_DATA_TRANSCRIPT_fail_2() {
  return `
CLIENT:  hello

ASSISTANT-LINE MASTER: Hello! How can I assist you today?

CLIENT:  can you please add a random line to a new set in the context named 'Pinky"?

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

    <Charlotte>
        random lines suck!
    </Charlotte>

</PROJECT_CONTEXT>

CLIENT: No, I want a random line in the context named 'Pinky'

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

    <Charlotte>
        random lines suck!
    </Charlotte>

</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

    <Jenky>
        random lines suck!
    </Jenky>

</PROJECT_CONTEXT>

CLIENT:  can you please change the title of the set 'Jenky' to 'Pinky'?

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

    <Jenky>
        random lines suck!
    </Jenky>

</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

</PROJECT_CONTEXT>

CLIENT:  No, I want a random line in the context named 'Pinky'

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>


</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE

<PROJECT_CONTEXT>

    <test>
        hello there
    </test>

     <Panther>
        random lines suck!
    </Panther>

</PROJECT_CONTEXT>
`;
}

// export function TEST_DATA_LINE_SETS_fail_1() {
//   return [
//     {text: "hello there", setName: "test", lines: [], isDisabled: false},
//     {text: "this is a random line!", setName: "New Set 1", lines: [], isDisabled: false}
//   ]
// }
