import { type } from "arktype";
import { tool } from "@langchain/core/tools";
import { BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, MemorySaver } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { writeFile } from "node:fs/promises";

import { ChatOllama } from "@langchain/ollama";

const llm = new ChatOllama({
    model: "qwen2.5:3b",
    temperature: 0.7,
});

const arithmeticInput = type({
    a: "number",
    b: "number"
})
type TArithmeticInput = typeof arithmeticInput.infer;

const addition = tool(
    async(input: TArithmeticInput) => {
        const parsed = arithmeticInput.assert(input)
        return (parsed.a + parsed.b)
    },
    {
        name: "addition",
        description: "Add two numbers together.",
        schema: arithmeticInput.toJsonSchema()
    }
)

const multiplication = tool(
    async (input: TArithmeticInput) => {
        const parsed = arithmeticInput.assert(input);
        return (parsed.a * parsed.b);
    },
    {
        name: "multiplication",
        description: "Multiply two numbers together.",
        schema: arithmeticInput.toJsonSchema(),
    }
);

const division = tool(
    async (input: TArithmeticInput) => {
        const parsed = arithmeticInput.assert(input);
        return (parsed.a / parsed.b);
    },
    {
        name: "division",
        description: "Divide two numbers.",
        schema: arithmeticInput.toJsonSchema(),
    }
);

const toolList = [
    addition,
    multiplication,
    division
];
const llmWithTools = llm.bindTools(toolList);
const systemMessage = new SystemMessage({ content: "You are a very helpful assistant tasked with performing arithmetic on a set of inputs." });

const MessageState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (existingList, newListItems) => existingList.concat(newListItems),
        default: () => []
    })
})

async function assistant(state: typeof MessageState.State) {
    const { messages } = state;
    const response = await llmWithTools.invoke([
        systemMessage,
        ...messages
    ]);
    return {
        messages: [
            response
        ]
    };
}

const memory = new MemorySaver();

const graph = new StateGraph(MessageState)
    .addNode("assistant", assistant)
    .addNode("tools", new ToolNode(toolList))
    .addEdge(START, "assistant")
    .addConditionalEdges(
        "assistant",
        toolsCondition
    )
    .addEdge("tools", "assistant")
    .compile({
        checkpointer: memory 
    });

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "preview/time-travel-graph.png",
    Buffer.from(await png.arrayBuffer())
);

async function run() {
    const config = { configurable: { thread_id: "conversation-1" } };
    
    console.log("--- Starting Stream ---");
    const stream = await graph.stream(
        { messages: [new HumanMessage("Multiply 3 and 4.")] },
        {
            ...config,
            streamMode: "values"
        }
    )

    for await (const chunk of stream) {
        console.log("Current State:", chunk);
    }

    // console.log("\n--- Checking State After Interrupt ---");
    // const currentState = await graph.getState(config);
    // console.log("Current State Values:", currentState.values);
    // console.log("Next Node(s) to execute:", currentState.next);

    console.log("\n--- Graph History ---");
    const history = graph.getStateHistory(config);
    const states = [];

    for await (const state of history) {
        states.push(state)
    }
    console.log("Total checkpoints:", states.length);

    // const toReplay = states[states.length - 2]
    // console.log("To replay", toReplay.values);
    // console.log("The next node to be replayed", toReplay.next);
    // console.log("Replay config", toReplay.config);

    // const resumeStream = await graph.stream(null, {
    //     ...toReplay.config,
    //     streamMode: "values"
    // });

    // for await (const chunk of resumeStream) {
    //     console.log("Resumed State Chunk:", chunk);
    // }

    const toFork = states[states.length - 2]
    console.log("To fork", toFork.values.messages);
    console.log("Config", toFork.config);

    const forkConfig = await graph.updateState(
        toFork.config,
        { 
            "messages": [
                new HumanMessage(
                    `Multiply 5 and 3, 
                    id=${toFork.values.messages[0].id}`
                )
            ]
        }
    );

    console.log("Updated config", forkConfig);

    for await (const state of history) {
        states.push(state)
    }
    console.log("Total checkpoints:", states.length);

    // for await (const chunk of resumeStream) {
    //     console.log("Resumed State Chunk:", chunk);
    // }

    // const resumeStream2 = await graph.stream(null, {
    //     ...config,
    //     streamMode: "values"
    // });

    // for await (const chunk of resumeStream2) {
    //     console.log("Resumed State Chunk 2:", chunk);
    // }

}

run();