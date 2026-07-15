import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, Command, END, interrupt, MemorySaver, START, StateGraph, } from "@langchain/langgraph";
import { type } from "arktype";

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3.5-flash",
    temperature: 0,
    maxRetries: 2,
})

export const EmailClassificationType = type({
    intent: "'question' | 'bug' | 'billing' | 'feature' | 'complex'",
    urgency: "'low' | 'medium' | 'high' | 'critical'",
    topic: "string",
    summary: "string",
})

export type EmailClassification = typeof EmailClassificationType.infer;

const EmailStateDefinition = Annotation.Root({
    emailContent: Annotation<string>,
    senderEmail: Annotation<string>,
    emailId: Annotation<string>,
    classification: Annotation<EmailClassification>,
    ticketId: Annotation<string | null>,
    searchResults: Annotation<string[]>,
    customerHistory: Annotation<string[]>,
    draftResponse: Annotation<string>
})

function readEmail(state: typeof EmailStateDefinition.State) {
    console.log("Processing email from:", state.senderEmail);
    return {}
}

async function classifyIntent(state: typeof EmailStateDefinition.State) {
    console.log("Classifying email intent and urgency...");
    const structuredOutputLlm = llm.withStructuredOutput(EmailClassificationType)

    const classificationPrompt = `
Analyze the customer email and classify it:

Email:  ${state.emailContent}
From: ${state.senderEmail}

Provide classification including intent, urgency, topic, and a brief summary.
    `

    try {
        const classification = await structuredOutputLlm.invoke(classificationPrompt)
        console.log("Classification result:", classification);
        return {
            classification
        }
    } catch (error) {
        console.error("Error during classification:", error);
        return {
            classification: {
                intent: "complex",
                urgency: "high",
                topic: "classification_error",
                summary: "Failed to classify email due to an error."
            }
        }
    }
}

function bugTracking(state: typeof EmailStateDefinition.State) {
    console.log("Create bug tracking ticket for the classified email...");

    const ticketId = `BUG-${Math.floor(Math.random() * 10000)}`;
    console.log(`Created bug tracking ticket with ID: ${ticketId}`);
    return {
        ticketId
    };
}

function searchDocumentation(state: typeof EmailStateDefinition.State) {
    console.log("Searching documentation for relevant information...");

    const classification = state.classification ?? {
        intent: "question",
        topic: "general",
        urgency: "medium",
        summary: "No classification available."
    }

    try {
        const searchResults = [
            `Documentation for ${classification.topic}: Basic information about ${classification.topic}.`,
            `FAQ Entry: Common questions and answers related to ${classification.topic}.`,
            `Knowdledge base article: How to handle ${classification.topic}. requests.`,
        ]
        console.log("Search results:", searchResults);
        return { searchResults };
    } catch (error) {
        console.error("Error during documentation search:", error);
        return { searchResults: ['Search temporary unavailable.'] };
    }
}


async function writeResponse(state: typeof EmailStateDefinition.State) {
    console.log("Writing response...");

    const classification = state.classification ?? {
        intent: "question",
        topic: "general",
        urgency: "medium",
        summary: "No classification available."
    }

    const contextSections: string[] = []

    if (state.searchResults) {
        const formattedDocs = state.searchResults.map(doc => `- ${doc}`).join("\n");
        contextSections.push(`Relevant documentation:\n${formattedDocs}`);
    }

    if (state.customerHistory) {
        contextSections.push(`Customer history:\n${state.customerHistory.join("\n")}`);
    }

    const draftPrompt = `
Draft a response to the customer email based on the following information:
${state.emailContent}

Email intent: ${classification.intent}
Urgency: ${classification.urgency}

${contextSections.join("\n\n")}

Guidelines:
- Be professional and helpful.
- Address the customer's concerns.
- Be brief.
- Use the provided context when relevant.
    `
    try {
        const response = await llm.invoke(draftPrompt)

        const needsReview =
            classification.urgency === "high" ||
            classification.urgency === "critical" ||
            classification.intent === "complex"

        const goto = needsReview ? 'human_review' : 'send_reply'

        return new Command({
            update: { draftResponse: response.content },
            goto: goto
        })
    } catch (error) {
        console.error('Error writing response:', error);
        return new Command({
            update: { draftResponse: 'Unable to generate a response at this time.' },
            goto: 'human_review'
        })
    }
}
function humanReview(state: typeof EmailStateDefinition.State) {
    console.log("Human reviewing draft response:", state.draftResponse);
    
    const classification = state.classification ?? {
        intent: "question",
        topic: "general",
        urgency: "medium",
        summary: "No classification available."
    }

    const humanDecision = interrupt({
        ...state,
        action: `Please review and approve/edit this response.`,
    })

    if (humanDecision.approved) {
        const editedResponse = humanDecision.editedResponse ?? state.draftResponse;
        return new Command({
            update: { draftResponse: editedResponse },
            goto: 'send_reply'
        })
    }

    return new Command({
        update: {},
        goto: END
    })
}

function sendReply(state: typeof EmailStateDefinition.State) {
    const preview = state.draftResponse?.substring(0,60) + "...";
    console.log("Reply preview:", preview);
    return {}
}

const memory = new MemorySaver()

export const graph = new StateGraph(EmailStateDefinition)
    .addNode('read_email', readEmail)
    .addNode('classify_intent', classifyIntent)
    .addNode('bug_tracking', bugTracking)
    .addNode('search_documentation', searchDocumentation)
    .addNode('write_response', writeResponse, { ends: ['human_review', 'send_reply'] })
    .addNode('human_review', humanReview, { ends: ['send_reply', END ] })
    .addNode('send_reply', sendReply)

    .addEdge(START, 'read_email')
    .addEdge('read_email', 'classify_intent')
    .addEdge('classify_intent', 'bug_tracking')
    .addEdge('classify_intent', 'search_documentation')
    .addEdge('bug_tracking', 'write_response')
    .addEdge('search_documentation', 'write_response')
    .addEdge('write_response', 'human_review')
    .addEdge('send_reply', END)
    .compile({
        checkpointer: memory,
    })