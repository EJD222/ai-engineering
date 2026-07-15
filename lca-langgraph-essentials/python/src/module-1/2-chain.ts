import path from "node:path";
import { fileURLToPath } from "node:url";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import { tool } from "@langchain/core/tools";
import { type } from "arktype";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", "..", ".env");

dotenv.config({ path: envPath });

if (!process.env.GOOGLE_API_KEY) {
    throw new Error(`Google API key not found. Make sure the key exists in ${envPath}`);
}

//Messages
const initialMessages = [
    new AIMessage({ content: "So you said you were researching ocean mammals?", name: "Model" }),
    new HumanMessage({ content: "Yes, that's right.", name: "Lance" }),
    new AIMessage({ content: "Great, what would you like to learn about.", name: "Model" }),
    new HumanMessage({ content: "I want to learn about the best place to see Orcas in the US.", name: "Lance" }),
];

for (const message of initialMessages) {
    console.log(`${message.name}: ${message.content}`);
}

//Chat Models
const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash", 
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
});

// const response = await llm.invoke(initialMessages);
// console.log(`Model: ${JSON.stringify(response.content)}`);
// console.log(`Model: ${JSON.stringify(response.additional_kwargs)}`);

//Tools
const multiplySchema = type({
    a: "number",
    b: "number",
});

const multiplyTool = tool(
    async ({ a, b }) => {
        return a * b;
    },
    {
        name: "multiply",
        description: "Multiply a and b. 'a' is the first integer, 'b' is the second integer.",
        schema: multiplySchema,
    }
);

const toolList = [
    multiplyTool
];

const llmWithTools = llm.bindTools(toolList)
const messages = [new HumanMessage("What is 35 multiplied by 12?")];

// llmWithTools.invoke(messages).then((res) => {
//     console.log(`Model Tool Calls: ${JSON.stringify(res.tool_calls, null, 2)}`);
// });


//State
const MessageState = Annotation.Root({
    messages: Annotation<string[]>({
        reducer: (existingList, newListItems) => existingList.concat(newListItems),
        default: () => []
    })
})

const sampleMessages = [
  new AIMessage({ content: "Hello! How can I assist you?", name: "Model" }),
  new HumanMessage({ content: "I'm looking for information on marine biology.", name: "Lance" })
];

const newMessage = new AIMessage({ 
  content: "Sure, I can help with that. What specifically are you interested in?", 
  name: "Model" 
});

async function toolCallingllm(state: typeof MessageState.State) {
    const response = await llmWithTools.invoke(state.messages);
    return { messages: [response] };
}

//Graph
export const graph = new StateGraph(MessageState)
    .addNode("tool_calling_llm", toolCallingllm)
    .addEdge(START, "tool_calling_llm")
    .addEdge("tool_calling_llm", END)
    .compile();

// 3. Render the visual graph layout
const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();