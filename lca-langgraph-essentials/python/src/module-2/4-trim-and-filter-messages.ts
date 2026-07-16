import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { AIMessage, BaseMessage, HumanMessage, RemoveMessage } from "@langchain/core/messages";
import { Annotation, END, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { writeFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", "..", "..", ".env");

dotenv.config({ path: envPath });

if (!process.env.GOOGLE_API_KEY) {
    throw new Error(`Google API key not found. Make sure the key exists in ${envPath}`);
}

const messages = [
    new HumanMessage({ content: "What are ocean mammals", name: "Model", id: "msg-1" }),
    new AIMessage({ content: "So you said you were researching ocean mammals?", name: "Bot", id: "msg-2" }),
    new HumanMessage({ content: "Yes I know about whales. But what others should I learn about?. Answer in 2 senteces only.", name: "Model", id: "msg-3" }),
];

console.log(messages);

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
});

const MessageState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer, // 2. Use the official reducer here
        default: () => []
    })
});

async function chatModel(state: typeof MessageState.State) {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
}

// export const graph = new StateGraph(MessageState)
//     .addNode("chatModel", chatModel)
//     .addEdge(START, "chatModel")
//     .addEdge("chatModel", END)
//     .compile();


function filterMessages(state: typeof MessageState.State) {
    const deletedMessages = state.messages
        .slice(0, -2)
        .filter((m): m is typeof m & { id: string } => m.id !== undefined)
        .map((m) => new RemoveMessage({ id: m.id }))

    return {
        messages: deletedMessages
    }
}

export const graph = new StateGraph(MessageState)
    .addNode("chatModel", chatModel)
    .addNode("filterMessages", filterMessages)
    .addEdge(START, "filterMessages")
    .addEdge("filterMessages", "chatModel")
    .addEdge("chatModel", END)
    .compile();

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "./preview/trim-and-filter-messages-graph-2.png",
    Buffer.from(await png.arrayBuffer())
);

const result = await graph.invoke({ messages: messages });
console.log("Final result: ", result);
