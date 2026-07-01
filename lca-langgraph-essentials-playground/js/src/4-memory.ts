import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeFile } from "node:fs/promises";

const StateDefinition  = Annotation.Root({
    nlist: Annotation<string[]>({
        reducer: (existingList, newListItems) => existingList.concat(newListItems),
        default: () => [],
    })
})

function nodeA(state: typeof StateDefinition.State) {
    const selectedNode = state.nlist[state.nlist.length - 1] || "No previous elements";
    return { nlist: [selectedNode] };
}

function nodeB(state: typeof StateDefinition.State) {
    console.log("Adding B to: ", state.nlist);
    return { nlist: ["B"] };
}

function nodeC(state: typeof StateDefinition.State) {
    console.log("Adding C to: ", state.nlist);
    return { nlist: ["C"] };
}

const memory = new MemorySaver()

function routeFromA(state: typeof StateDefinition.State) {
    const selectedNode = state.nlist[state.nlist.length - 1] || "No previous elements";
    if(selectedNode.includes("B")) return "b";
    else if(selectedNode.includes("C")) return "c";
    else if(selectedNode.includes("Q")) return END;
    else return END;
}

export const graph = new StateGraph(StateDefinition)
    .addNode("a", nodeA)
    .addNode("b", nodeB)
    .addNode("c", nodeC)
    .addEdge(START, "a")
    .addConditionalEdges("a", routeFromA)
    .addEdge("b", END)
    .addEdge("c", END)
    .compile({
        checkpointer: memory,
    });

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

        const result = await graph.invoke(inputState, config);
        console.log("Updated Thread State: ", result.nlist);

        // const drawableGraph = await graph.getGraphAsync();
        // const png = await drawableGraph.drawMermaidPng();

        // await writeFile(
        //     "graph.png",
        //     Buffer.from(await png.arrayBuffer())
        // );
    }

}
