import { Annotation, AnnotationRoot, END, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "node:fs/promises";

//Input/Output
// export const OverallState = Annotation.Root({
//     question: Annotation<string>(),
//     answer: Annotation<string>(),
//     notes: Annotation<string>()
// });

// function thinkingNode(state: typeof OverallState.State) {
//     return {
//         "answer": "bye",
//         "notes": "... his name is User"
//     }
// }

// function answerNode(state: typeof OverallState.State) {
//     return {
//         "answer": "bye Lance",
//     }
// }

// export const graph = new StateGraph(OverallState)
//     .addNode("thinkingNode", thinkingNode)
//     .addNode("answerNode", answerNode)

//     .addEdge(START, "thinkingNode")
//     .addEdge("thinkingNode", "answerNode")
//     .addEdge("answerNode", END)
//     .compile();

// const drawableGraph = await graph.getGraphAsync();
// const png = await drawableGraph.drawMermaidPng();

// await writeFile(
//     "./preview/multiple-schemas-graph-2.png",
//     Buffer.from(await png.arrayBuffer())
// );

// const initialState = {
//     question: "hi"
// };

// const result = await graph.invoke(initialState);
// console.log("Final result: ", result);

//Version 2
export const InputState = Annotation.Root({
    question: Annotation<string>(),
});

export const OutputState = Annotation.Root({
    answer: Annotation<string>(),
});

export const OverallState = Annotation.Root({
    question: Annotation<string>(),
    answer: Annotation<string>(),
    notes: Annotation<string>()
});

function thinkingNode(state: typeof InputState.State) {
    return {
        "answer": "bye",
        "notes": "... his name is User"
    }
}

function answerNode(state: typeof OverallState.State): typeof OutputState.State {
    return {
        "answer": "bye Lance",
    }
}

export const graph = new StateGraph({
        state: OverallState,
        input: InputState,
        output: OutputState
    })
    .addNode("thinkingNode", thinkingNode)
    .addNode("answerNode", answerNode)

    .addEdge(START, "thinkingNode")
    .addEdge("thinkingNode", "answerNode")
    .addEdge("answerNode", END)
    .compile();

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "./preview/multiple-schemas-graph-2.png",
    Buffer.from(await png.arrayBuffer())
);

const initialState = {
    question: "hi"
};

const result = await graph.invoke(initialState);
console.log("Final result: ", result);