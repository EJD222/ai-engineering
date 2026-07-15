import { type } from "arktype";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "node:fs/promises";

// const StateDefinition = type({
//     nlist: "string[]",
// });
// export type TStateDefinition = typeof StateDefinition.infer;

const StateDefinition = Annotation.Root({
    nlist: Annotation<string[]>
})

function nodeA(state: typeof StateDefinition.State) {
    console.log("Node A: ", state.nlist);
    const note = "Hello from Node A";
    return { nlist: [...state.nlist, note] };
}

export const graph = new StateGraph(StateDefinition)
    .addNode("a", nodeA)
    .addEdge(START, "a")
    .addEdge("a", END)
    .compile();

const initialState: typeof StateDefinition.State = {
    nlist: ['Hello node A how are you?']
};
console.log("Initial State: ", initialState);

const result = await graph.invoke(initialState);
console.log("Final result: ", result);

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "graph.png",
    Buffer.from(await png.arrayBuffer())
);