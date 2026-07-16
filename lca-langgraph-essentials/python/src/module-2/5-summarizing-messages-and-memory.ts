import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Annotation, END, MemorySaver, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, RemoveMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { writeFile } from "fs/promises";

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

const MessageState = Annotation.Root({
    ...MessagesAnnotation.spec,
    summary: Annotation<string>(),
});

async function callModel(state: typeof MessageState.State) {
    const { summary, messages } = state;
    let messageList = [...messages];
    
    if (summary) {
        const systemMessage = new SystemMessage(`Summary of conversation earlier: ${summary}`);
        messageList = [systemMessage, ...messages];
    }

    const response = await llm.invoke(messageList);
    return {
        messages: [response]
    };
}

async function summarizeConversation(state: typeof MessageState.State) {
    const { summary, messages } = state;
    
    let systemMessage: SystemMessage;
    
    if (summary) {
        systemMessage = new SystemMessage(
            `This is summary of the conversation to date: ${summary}\n\nExtend the summary by taking into account the new messages above`
        );
    } else {
        systemMessage = new SystemMessage(`Create a summary of the conversation above`);
    }
   
    const response = await llm.invoke([systemMessage, ...messages]);
    const deletedMessages = messages
        .slice(0, -2)
        .filter((m): m is typeof m & { id: string } =>m.id !== undefined)
        .map((m) => new RemoveMessage({ id: m.id }))
   
    return {
        summary: response.content,
        messages: deletedMessages
    };
}

function shouldContinue(state: typeof MessageState.State) {
    const { messages } = state;
    if(messages.length > 0 ) {
        return "summarizeConversation"
    } else {
        return END
    }
}

const memory = new MemorySaver()

export const graph = new StateGraph(MessageState)
    .addNode("callModel", callModel)
    .addNode("summarizeConversation", summarizeConversation)

    .addEdge(START, "callModel")
    .addConditionalEdges(
        "callModel", 
        shouldContinue, 
        {
            "summarizeConversation": "summarizeConversation", 
            [END]: END,
        }
    )
    .addEdge("summarizeConversation", END)
    .compile({
        checkpointer: memory,
    })

const drawableGraph = await graph.getGraphAsync();
const png = await drawableGraph.drawMermaidPng();

await writeFile(
    "./preview/summarizing-messages-and-memory-graph.png",
    Buffer.from(await png.arrayBuffer())
);

const config = {
    configurable: {
        thread_id: "1"
    }
}

const result1 = await graph.invoke(
    { messages: [new HumanMessage({ content: "Hi, I am EL-J!", id: "msg-1" })] }, 
    config // Pass config here
);
console.log("Result 1: ", result1.messages[result1.messages.length - 1].content);

const result2 = await graph.invoke(
    { messages: [new HumanMessage({ content: "What is my name?", id: "msg-2" })] }, 
    config // Pass the SAME config here
);
console.log("Result 2: ", result2.messages[result2.messages.length - 1].content);
