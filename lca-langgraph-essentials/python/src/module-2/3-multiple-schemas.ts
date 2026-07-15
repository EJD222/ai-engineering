import { Annotation, AnnotationRoot, END, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "node:fs/promises";

export const OverallState = Annotation.Root({
    foo: Annotation<number>()
});

export const PrivateState = Annotation.Root({
    baz: Annotation<number>()
});

function node1(state: typeof OverallState.State): typeof PrivateState.State {
    console.log("Node 1");
    return {
        baz: state.foo + 1
    };
}

function node2(state: typeof PrivateState.State): typeof OverallState.State {
    console.log("Node 1");
    return {
        foo: state.baz + 1
    };
}

export const graph = new StateGraph(OverallState)
    .addNode("node1", node1)
    .addNode("node2", node2, { input: PrivateState })

    .addEdge(START, "node1")
    .addEdge("node1", "node2")
    .addEdge("node2", END)
    .compile();

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "./preview/multiple-schemas-graph-1.png",
    Buffer.from(await png.arrayBuffer())
);

const initialState = {
    foo: 1
};

const result = await graph.invoke(initialState);
console.log("Final result: ", result);