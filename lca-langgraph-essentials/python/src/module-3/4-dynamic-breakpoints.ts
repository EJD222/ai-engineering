import { HumanMessage } from "@langchain/core/messages";
import { Annotation, AnnotationRoot, END, MemorySaver, NodeInterrupt, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "fs/promises";

const StateDefinition = Annotation.Root({
    input: Annotation<string>()
})

function step1(state: typeof StateDefinition.State){
    console.log("Step 1")
    return state
}

function step2(state: typeof StateDefinition.State){
    console.log("Step 2")
    if(state.input.length > 5) {
        throw new NodeInterrupt("Input is longer than 5 characters. Pausing execution."); 
    }
    return state
}

function step3(state: typeof StateDefinition.State){
    console.log("Step 1")
    return state
}

const memory = new MemorySaver();

const graph = new StateGraph(StateDefinition)
    .addNode("step1", step1)
    .addNode("step2", step2)
    .addNode("step3", step3)
    .addEdge(START, "step1")
    .addEdge("step1", "step2")
    .addEdge("step2", "step3")
    .addEdge("step3", END)
    .compile({
        checkpointer: memory // Checkpointer is REQUIRED for interrupts to work
    });

// const drawableGraph = await graph.getGraphAsync();
// const png = await drawableGraph.drawMermaidPng();

// await writeFile(
//     "preview/dynamic-breakpoints-graph.png",
//     Buffer.from(await png.arrayBuffer())
// );

async function run() {
    const config = { configurable: { thread_id: "conversation-1" } };
    
    console.log("--- Starting Initial Stream ---");
    try {
        const stream = await graph.stream(
            { input: "hello world" }, 
            {
                ...config,
                streamMode: "values"
            }
        );

        for await (const chunk of stream) {
            console.log("Current State:", chunk);
        }
    } catch (e) {
        console.log("\nGraph interrupted dynamically via NodeInterrupt!");
    }

    let currentState = await graph.getState(config);
    console.log("\n--- State After Interrupt ---");
    console.log("Next node to execute:", currentState.next);

    console.log("\n--- Updating State input to 'Hi' ---");
    await graph.updateState(config, { input: "Hi" });

    // 4. Resume stream passing `null`
    console.log("\n--- Resuming Stream ---");
    const resumeStream = await graph.stream(null, {
        ...config,
        streamMode: "values"
    });

    for await (const chunk of resumeStream) {
        console.log("Resumed State Chunk:", chunk);
    }
}

run();