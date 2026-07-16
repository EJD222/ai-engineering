import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { AIMessage, BaseMessage, HumanMessage, trimMessages } from "@langchain/core/messages";
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

// Massive conversation history simulation
const messages = [
    new HumanMessage({ 
        id: "msg-1",
        name: "User", 
        content: "Let's discuss deep-sea biology. Hydrothermal vents support highly complex ecosystems that rely on chemosynthesis instead of photosynthesis. Microbes convert chemical energy from hydrogen sulfide into organic matter, forming the foundational baseline of this entirely dark web of life." 
    }),
    new AIMessage({ 
        id: "msg-2",
        name: "Bot", 
        content: "That is entirely accurate. Organisms like the giant tube worm Riftia pachyptila live in symbiosis with these chemosynthetic bacteria. Because they lack a traditional mouth or gut, they rely entirely on internal colonies of these microbes to convert chemical vent fluid directly into usable nutritional energy." 
    }),
    new HumanMessage({ 
        id: "msg-3",
        name: "User", 
        content: "Incredible. Now switch topics completely to terrestrial forest ecologies. What are the key defining structural layers of an old-growth temperate rainforest canopy, and how do mosses populate it? Answer in exactly 2 short sentences." 
    }),
];

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY,
});

const MessageState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => []
    })
});

async function chatModel(state: typeof MessageState.State) {
    // ✂️ Trim to a tight 45 tokens. 
    // This is large enough to hold msg-3, but too small to hold the deep-sea text.
    const trimmedMessages = await trimMessages(state.messages, {
        strategy: "last",
        maxTokens: 150, 
        tokenCounter: llm, 
        startOn: "human", 
        includeSystem: true,
        allowPartial: true,
    });

    console.log("\n==================================================");
    console.log("✂️ SHRUNKEN PAYLOAD SENT TO GEMINI API:");
    console.log(JSON.stringify(trimmedMessages, null, 2));
    console.log("==================================================\n");

    const response = await llm.invoke(trimmedMessages);

    return { messages: [response] };
}

export const graph = new StateGraph(MessageState)
    .addNode("chatModel", chatModel)
    .addEdge(START, "chatModel")
    .addEdge("chatModel", END)
    .compile();

const result = await graph.invoke({ messages: messages });

console.log("==================================================");
console.log("👑 FINAL GRAPH STATE (UNTOUCHED HISTORICAL RECORD):");
console.log(JSON.stringify(result.messages, null, 2));
console.log("==================================================");