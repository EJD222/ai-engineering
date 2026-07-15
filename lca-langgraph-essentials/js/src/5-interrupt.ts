import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph, } from "@langchain/langgraph";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeFile } from "node:fs/promises";

const StateDefinition = Annotation.Root({
    nlist: Annotation<string[]>({
        reducer: (exisitingList, newListItems) => exisitingList.concat(newListItems),
        default: () => [],
    })
})

export const nodeA = (state: typeof StateDefinition.State) => {
    const selectedNode = state.nlist[state.nlist.length - 1] || "No previous elements";
    let nextNode: string | typeof END;

    if (selectedNode.includes("B")) nextNode = "b";
    else if (selectedNode.includes("C")) nextNode = "c";
    else if (selectedNode.includes("Q")) nextNode = END;
    else {
        const input = interrupt({
            value: `Unexpected input: ${selectedNode}. Please enter 'B', 'C', or 'Q' to proceed.`,
        })

        if (input.toLowerCase() === 'continue') {
            nextNode = "B";
        } else {
            nextNode = END;
            return new Command({
                update: { nlist: ['q'] },
                goto: nextNode,
            });
        }
    }

    return new Command({
        update: {},
        goto: nextNode,
    });
}

export const nodeB = (state: typeof StateDefinition.State) => {
    console.log("Adding B to: ", state.nlist);
    return { nlist: ["B"] };
}

export const nodeC = (state: typeof StateDefinition.State) => {
    console.log("Adding C to: ", state.nlist);
    return { nlist: ["C"] };
}


const memory = new MemorySaver()

export const graph = new StateGraph(StateDefinition)
    .addNode("a", nodeA, { ends: ["b", "c"] })
    .addNode("b", nodeB)
    .addNode("c", nodeC)

    .addEdge(START, "a")
    .addEdge("b", END)
    .addEdge("c", END)
    .compile({
        checkpointer: memory,
    });

const initialState = { nlist: [] };
console.log("Initial State: ", initialState);

export async function getUserInput(questionText: string): Promise<string> {
    const rl = readline.createInterface({ input, output });

    try {
        const answer = await rl.question(questionText);
        return answer;
    } finally {
        rl.close(); // Crucial: Closes the stream so your script doesn't hang forever
    }
}

while (true) {
    console.log("--- START NEW SESSION ---");
    const threadId = await getUserInput("Enter a unique name for this chat session (or 'exit'): ");

    if (threadId.toLowerCase() === "exit") {
        console.log("Exiting the program.");
        break;
    }

    const config = {
        configurable: {
            thread_id: threadId,
        },
    };

    while (true) {
        console.log(`\n[Current Session: ${threadId}]`);
        const input = await getUserInput("Choose a node path (Enter 'B', 'C', or 'Q' to quit this session): ");

        if (input.toUpperCase() === "Q") {
            console.log(`Ending session: ${threadId}`);
            break; // Breaks inner loop, goes back to outer loop to select a new thread
        }

        const inputState = { nlist: [input] };
        console.log("Input State: ", inputState);

        let stream = await graph.streamEvents(inputState, {
            ...config,
            version: "v3"
        });

        for await (const snapshot of stream.values) {
            console.log(" > Node finished execution. Live state snapshot:", snapshot.nlist);
        }

        if (stream.interrupted) {
            console.log(`\n⚠️  [GRAPH PAUSED BY INTERRUPT]`);


            const lastestInterruption = stream.interrupts[stream.interrupts.length - 1];
            const interruptData = (lastestInterruption?.payload as { value: string } | undefined)?.value;

            console.log(`Last interruption details:`, interruptData);

            const resumeValue = await getUserInput("Enter your response to the interrupt (e.g. 'continue'): ");
            const result = await graph.invoke(new Command({ resume: resumeValue }), config);

            console.log("Updated Thread State after resume:", result.nlist);
        } else {
            const state = await graph.getState(config);
            console.log("Updated Thread State: ", state.values.nlist);
        }
    }
}