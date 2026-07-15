import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { type } from "arktype";
import { writeFile } from "node:fs/promises";

const mood = type.enumerated(
    'happy',
    'sad'
)
export type TMood = typeof mood.infer

const GraphState = Annotation.Root({
    name: Annotation<string>(),
    mood: Annotation<TMood>(),
});

function node1(state: typeof GraphState.State) {
    console.log("Node 1")
    return {
        "name": state.name + " is ... "
    }
}

function node2(state: typeof GraphState.State) {
    console.log("Node 2")
    return {
        "mood": "happy" as const
    }
}


function node3(state: typeof GraphState.State) {
    console.log("Node 3")
    return {
        "mood": "sad" as const
    }
}

function decideMood(state: typeof GraphState.State) {
    if (Math.random() > 0.5) {
        return "node2";
    }
    return "node3";
}

export const graph = new StateGraph(GraphState)
    .addNode("node1", node1)
    .addNode("node2", node2)
    .addNode("node3", node3)

    .addEdge(START, "node1")
    .addConditionalEdges(
        "node1", 
        decideMood, 
        {
            "node2": "node2", 
            "node3": "node3" 
        }
    )
    
    .addEdge("node2", END)
    .addEdge("node3", END)
    .compile();

const initialState = {
    name: "EL-J"
};

const result = await graph.invoke(initialState);
console.log("Final result: ", result);

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "./preview/state-schema-graph.png",
    Buffer.from(await png.arrayBuffer())
);
