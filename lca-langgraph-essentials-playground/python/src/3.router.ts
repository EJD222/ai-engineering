import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import { tool } from "@langchain/core/tools";
import { type } from "arktype";
import { Annotation, AnnotationRoot, END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", "..", ".env");

dotenv.config({ path: envPath });

if (!process.env.GOOGLE_API_KEY) {
    throw new Error(`Google API key not found. Make sure the key exists in ${envPath}`);
}

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash", 
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
});

const multiplyInputType = type({
    a: "number",
    b: "number",
});

const multiplySchema = {
    type: "object",
    properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" }
    },
    required: ["a", "b"]
};

const multiplyTool = tool(
    async (input: { a: number; b: number }) => {
        const parsed = multiplyInputType(input);
        if (parsed instanceof Error) throw parsed;
        return input.a * input.b;
    },
    {
        name: "multiply",
        description: "Multiply a and b. 'a' is the first integer, 'b' is the second integer.",
        schema: multiplySchema as any,
    }
);

// Non-ArkType version (simpler, no runtime validation)
// const multiplyTool = tool(
//     async ({ a, b }: { a: number; b: number }) => {
//         return a * b;
//     },
//     {
//         name: "multiply",
//         description: "Multiply a and b. 'a' is the first integer, 'b' is the second integer.",
//         schema: {
//             type: "object",
//             properties: {
//                 a: { type: "number" },
//                 b: { type: "number" }
//             },
//             required: ["a", "b"]
//         }
//     }
// );

const toolList = [
    multiplyTool
];

const llmWithTools = llm.bindTools(toolList)

const MessageState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (existingList, newListItems) => existingList.concat(newListItems),
        default: () => []
    })
})

async function toolCallingllm(state: typeof MessageState.State) {
    const response = await llmWithTools.invoke(state.messages);
    return { messages: [response] };
}

export const graph = new StateGraph(MessageState)
    .addNode("tool_calling_llm", toolCallingllm)
    .addNode("tools", new ToolNode(toolList))

    .addEdge(START, "tool_calling_llm") 
    .addConditionalEdges(
        "tool_calling_llm",
        toolsCondition  
    )
    .addEdge("tool_calling_llm", END)
    .compile();

const initialState: typeof MessageState.State = {
    messages: [
        new HumanMessage("What is 35 multiplied by 12?") 
    ]
};

const result = await graph.invoke(initialState);
console.log("\n--- Final Conversation History ---");
for (const msg of result.messages) {
    const role = msg.getType().toUpperCase();
    
    const toolInfo = ("tool_calls" in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0)
        ? ` [Tool Calls: ${JSON.stringify(msg.tool_calls)}]` 
        : "";

    console.log(`[${role}]: ${msg.content}${toolInfo}`);
}

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();