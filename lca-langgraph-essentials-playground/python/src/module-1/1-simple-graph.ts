import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "node:fs/promises";

const StateDefinition = Annotation.Root({
    graphState: Annotation<string>
})

function node1(state: typeof StateDefinition.State) {
    console.log("Node 1");
    return { graphState: state.graphState + " I am" };
}

function node2(state: typeof StateDefinition.State) {
    console.log("Node 2");
    return { graphState: state.graphState + " happy" };
}

function node3(state: typeof StateDefinition.State) {
    console.log("Node 3");
    return { graphState: state.graphState + " sad" };
}

function moodDecider(state: typeof StateDefinition.State) {
    if (Math.random() > 0.5) return "node2";
    return "node3";
}

export const graph = new StateGraph(StateDefinition)
    .addNode("node1", node1)
    .addNode("node2", node2)
    .addNode("node3", node3)
    .addEdge(START, "node1")
    .addConditionalEdges(
        "node1", 
        moodDecider, 
        {
            "node2": "node2", 
            "node3": "node3"  
        }
    )
    .addEdge("node2", END)
    .addEdge("node3", END)
    .compile();

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "../preview/simple-graph.png",
    Buffer.from(await png.arrayBuffer())
);

const initialState: typeof StateDefinition.State = {
    graphState: "Hi, this is Langgraph."
}

const result = await graph.invoke(initialState);
console.log("Final result: ", result);