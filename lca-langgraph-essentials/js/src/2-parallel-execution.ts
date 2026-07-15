import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "node:fs/promises";

const StateDefinition = Annotation.Root({
    nlist: Annotation<string[]>({
        reducer: (existingList, newListItems) => existingList.concat(newListItems),
        default: () => [],
    })
})

function nodeA(state: typeof StateDefinition.State) {
    console.log("Adding A to: ", state.nlist);
    return { nlist: ["Hello from Node A"] };
}

function nodeB(state: typeof StateDefinition.State) {
    console.log("Adding B to: ", state.nlist);
    return { nlist: ["Hello from Node B"] };
}

function nodeBB(state: typeof StateDefinition.State) {
    console.log("Adding BB to: ", state.nlist);
    return { nlist: ["Hello from Node BB"] };
}

function nodeC(state: typeof StateDefinition.State) {
    console.log("Adding C to: ", state.nlist);
    return { nlist: ["Hello from Node C"] };
}

function nodeCC(state: typeof StateDefinition.State) {
    console.log("Adding CC to: ", state.nlist);
    return { nlist: ["Hello from Node CC"] };
}

function nodeD(state: typeof StateDefinition.State) {
    console.log("Adding D to: ", state.nlist);
    return { nlist: ["Hello from Node D"] };
}

export const graph = new StateGraph(StateDefinition)
    .addNode("a", nodeA)
    .addNode("b", nodeB)
    .addNode("bb", nodeBB)
    .addNode("c", nodeC)
    .addNode("cc", nodeCC)
    .addNode("d", nodeD)
    .addEdge(START, "a")
    .addEdge("a", "b")
    .addEdge("a", "c")
    .addEdge("b", "bb")
    .addEdge("c", "cc")
    .addEdge("bb", "d")
    .addEdge("cc", "d")
    .addEdge("d", END)
    .compile();

const initialState: typeof StateDefinition.State = {
    nlist: ['This is a parrel execution example.']
}
console.log("Initial State: ", initialState);

const result = await graph.invoke(initialState);
console.log("Final result: ", result);

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "graph.png",
    Buffer.from(await png.arrayBuffer())
);