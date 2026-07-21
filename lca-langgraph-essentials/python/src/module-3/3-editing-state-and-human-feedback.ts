import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { type } from "arktype";
import { tool } from "@langchain/core/tools";
import { BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph, MemorySaver } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { writeFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", "..", "..", ".env");

dotenv.config({ path: envPath });

if (!process.env.GOOGLE_API_KEY) {
    throw new Error(`Google API key not found. Make sure the key exists in ${envPath}`);
}

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
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
        interruptBefore: ["assistant"],
        checkpointer: memory 
    });

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "preview/eshf-graph.png",
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

    console.log("\n--- Checking State After Interrupt ---");
    const currentState = await graph.getState(config);
    
    console.log("Current State Values:", currentState.values);
    console.log("Next Node(s) to execute:", currentState.next);

    //Apply a state update
    const stateUpdate = await graph.updateState(
        config,
        { messages: [new HumanMessage("No, actually multiply 3 and 3!")]}
    );

    const updatedState = await graph.getState(config);
    console.log("Updated State Values:", updatedState.values);

    const resumeStream = await graph.stream(null, {
        ...config,
        streamMode: "values"
    });

    for await (const chunk of resumeStream) {
        console.log("Resumed State Chunk:", chunk);
    }

    const resumeStream2 = await graph.stream(null, {
        ...config,
        streamMode: "values"
    });

    for await (const chunk of resumeStream2) {
        console.log("Resumed State Chunk 2:", chunk);
    }

}

run();