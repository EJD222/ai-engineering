import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { type } from "arktype";
import { tool } from "@langchain/core/tools";
import { BaseMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { writeFile } from "node:fs/promises";

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

const arithmeticInput = type({
    a: "number",
    b: "number"
})
type TArithmeticInput = typeof arithmeticInput.infer;

const additionTool = tool(
    async (input: TArithmeticInput) => {
        const parsed = arithmeticInput.assert(input);
        return (parsed.a + parsed.b);
    },
    {
        name: "addition",
        description: "Add two numbers together.",
        schema: arithmeticInput.toJsonSchema(),
    }
);

const multiplicationTool = tool(
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

const divisionTool = tool(
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
    additionTool,
    multiplicationTool,
    divisionTool
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

const graph = new StateGraph(MessageState)
    .addNode("assistant", assistant)
    .addNode("tools", new ToolNode(toolList))
    .addEdge(START, "assistant")
    .addConditionalEdges(
        "assistant",
        toolsCondition
    )
    .addEdge("tools", "assistant")
    .compile();

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "../preview/agent-graph.png",
    Buffer.from(await png.arrayBuffer())
);

// Invoke the graph
async function run() {
    const initialState = {
        messages: [new HumanMessage("Multiply  3 and 4.")]
    };

    const result = await graph.invoke(initialState);
    console.log(result.messages[result.messages.length - 1].content);
}

run();