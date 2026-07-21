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
import { stdin as inputStream, stdout as outputStream } from "node:process";
import * as readline from "node:readline/promises";

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


function humanFeedback(state: typeof MessageState.State) {
    return {}
}

const memory = new MemorySaver();

const graph = new StateGraph(MessageState)
    .addNode("assistant", assistant)
    .addNode("tools", new ToolNode(toolList))
    .addNode("humanFeedback", humanFeedback)
    .addEdge(START, "humanFeedback")
    .addEdge("humanFeedback", "assistant")
    .addConditionalEdges(
        "assistant",
        toolsCondition,
        {
            "tools": "tools",
            "__end__": END
        }
    )
    .addEdge("tools", "humanFeedback")
    .compile({ 
        interruptBefore: ["humanFeedback"],
        checkpointer: memory 
    });

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "preview/eshf-graph-2.png",
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

    const rl = readline.createInterface({ input: inputStream, output: outputStream });
    const userInput = await rl.question("\nTell me how you want to update the state: ");
    rl.close(); // Close the input stream when done

    console.log("\n--- Applying State Update ---");
    
    // 2. Apply state update (passing asNode if updating relative to a specific node checkpoint)
    await graph.updateState(
        config,
        { messages: [new HumanMessage(userInput)] },
        "humanFeedback" // asNode parameter
    );

    console.log("\n--- Checking State After Interrupt ---");
    const currentState = await graph.getState(config);
    
    console.log("Current State Values:", currentState.values);
    console.log("Next Node(s) to execute:", currentState.next);

    //Apply a state update
    const stateUpdate = await graph.updateState(
        config,
        { messages: [new HumanMessage("No, actually multiply 3 and 3!")]}
    );

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
        console.log("Resumed State Chunk:", chunk);
    }
}

run();

// async function run() {
//     const config = { configurable: { thread_id: "conversation-1" } };
    
//     console.log("--- Starting Stream ---");
//     const stream = await graph.stream(
//         { messages: [new HumanMessage("Multiply 3 and 4.")] },
//         {
//             ...config,
//             streamMode: "values"
//         }
//     );
//     for await (const chunk of stream) {
//         console.log("Current State:", chunk);
//     }

//     // Check the current state to see if we are paused
//     let currentState = await graph.getState(config);

//     // This loop dynamically handles as many pauses as the graph requires
//     while (currentState.next.length > 0) {
//         console.log(`\n--- Graph Paused ---`);
//         console.log(`Next node to execute: ${currentState.next}`);
        
//         const rl = readline.createInterface({ input: inputStream, output: outputStream });
//         const userInput = await rl.question("\nTell me how you want to update the state (or press Enter to just let it continue): ");
//         rl.close(); 

//         // Only apply a state update if the user actually typed something
//         if (userInput.trim() !== "") {
//             console.log("\n--- Applying State Update ---");
//             await graph.updateState(
//                 config,
//                 { messages: [new HumanMessage(userInput)] },
//                 "humanFeedback" // Fast-forwards the state as if humanFeedback produced this
//             );
//         } else {
//             console.log("\n--- Continuing Without Changes ---");
//         }

//         console.log("\n--- Resuming Stream ---");
//         const resumeStream = await graph.stream(null, {
//             ...config,
//             streamMode: "values"
//         });

//         for await (const chunk of resumeStream) {
//             console.log("Resumed State Chunk:", chunk);
//         }

//         // Fetch the state again. If it hit END, `next` will be empty and the loop breaks.
//         currentState = await graph.getState(config);
//     }
    
//     console.log("\n--- Execution Complete ---");
// }

// run();