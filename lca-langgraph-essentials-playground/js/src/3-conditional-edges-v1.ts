import { Annotation, Command, END, START, StateGraph } from "@langchain/langgraph";
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
    let nextNode: string;

    if (selectedNode.includes("B")) nextNode = "b";
    else if (selectedNode.includes("C")) nextNode = "c";
    else nextNode = END

    return new Command({
        update: { nlist: [selectedNode] },
        goto: nextNode
    })
}

function nodeB(state: typeof StateDefinition.State) {
    console.log("Adding B to: ", state.nlist);
    return { nlist: ["B"] };
}

function nodeC(state: typeof StateDefinition.State) {
    console.log("Adding C to: ", state.nlist);
    return { nlist: ["C"] };
}

export const graph = new StateGraph(StateDefinition)
    .addNode("a", nodeA, {ends: ['b', 'c']})
    .addNode("b", nodeB)
    .addNode("c", nodeC)
    .addEdge(START, "a")
    .addEdge("b", END) 
    .addEdge("c", END)
    .compile();


export async function getUserInput(questionText: string): Promise<string> {
    const rl = readline.createInterface({ input, output });
  
    try {
        const answer = await rl.question(questionText);
        return answer;
    } finally {
        rl.close(); // Crucial: Closes the stream so your script doesn't hang forever
    }
}

console.log("Enter B to go to node B, C to go to node C, or any other input to end the graph.");
const user = await getUserInput("Enter your choice (B/C): ");

const inputState = { nlist: [user] };
console.log("Input State: ", inputState);

const result = await graph.invoke(inputState);
console.log("Final result: ", result);

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "graph.png",
    Buffer.from(await png.arrayBuffer())
);