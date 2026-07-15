import { AIMessage, BaseMessage, HumanMessage, RemoveMessage } from "@langchain/core/messages";
import { addMessages, Annotation, END, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";
import { writeFile } from "node:fs/promises";

// const GraphState = Annotation.Root({
//     foo: Annotation<number[]>({
//         reducer: (existingList, newListItems) => existingList.concat(newListItems)
//     })
// })

// function node1(state: typeof GraphState.State) {
//     console.log("Node 1");
//     const lastElement = state.foo.at(-1) ?? 0; 
//     return {
//         foo: [lastElement + 1] 
//     };
// }

// function node2(state: typeof GraphState.State) {
//     console.log("Node 2");
//     const lastElement = state.foo.at(-1) ?? 0;
//     return {
//         foo: [lastElement + 1]
//     };
// }

// function node3(state: typeof GraphState.State) {
//     console.log("Node 3");
//     const lastElement = state.foo.at(-1) ?? 0;
//     return {
//         foo: [lastElement + 1]
//     };
// }

//Default

// export const graph = new StateGraph(GraphState)
//     .addNode("node1", node1)
//     .addEdge(START, "node1")
//     .addEdge("node1", END)
//     .compile()


// export const graph = new StateGraph(GraphState)
//     .addNode("node1", node1)
//     .addNode("node2", node2)
//     .addNode("node3", node3)
    
//     .addEdge(START, "node1")
//     .addEdge("node1", "node2")
//     .addEdge("node1", "node3")
//     .addEdge("node2", END)
//     .addEdge("node3", END)
//     .compile()

// const drawableGraph = await graph.getGraphAsync();
// const png = await drawableGraph.drawMermaidPng();

// await writeFile(
//     "./preview/state-reducer-graph-2.png",
//     Buffer.from(await png.arrayBuffer())
// );

// async function run() {
  
//     const initialState = {
//         foo: []
//     };

//     try{
//         const result = await graph.invoke(initialState);
//         console.log(`Result: ${JSON.stringify(result, null, 2)}`);
//     } catch (error) {
//         console.log(error)
//     }
   
// }

// run();

// export const StateAnnotation = Annotation.Root({
//   messages: Annotation<BaseMessage[]>({
//     reducer: messagesStateReducer, // <-- This is 'add_messages'
//     default: () => [],
//   })
// })

// const messages = [
//     new AIMessage({ content: "Hello how can I assist you?", name: "Model" }),
//     new HumanMessage({content: "I am looking for information about AI", name: "User"})
// ]

// const newMessage = [
//   new HumanMessage({ content: "Can you help me write a graph?" })
// ];

// const combinedMessages = addMessages(messages, newMessage);

// console.log(combinedMessages);

//Re-writing
// const messages = [
//     new AIMessage({ content: "Hello how can I assist you?", name: "Model", id:"1" }),
//     new HumanMessage({content: "I am looking for information about AI", name: "User", id:"2"})
// ]

// const newMessage = [
//   new HumanMessage({ content: "Can you help me write a graph?", id:"2"})
// ];

// const combinedMessages = addMessages(messages, newMessage);

// console.log(combinedMessages);

// //Removal
const messages2 = [
    new AIMessage({ content: "Hello how can I assist you?", name: "Model", id: "1" }),
    new HumanMessage({ content: "I am looking for information about AI", name: "User", id: "2" })
];

const updates = [
    new HumanMessage({ content: "Can you help me write a graph?" }), 
    new RemoveMessage({ id: "1" })  
];

const combinedMessages2 = addMessages(messages2, updates);

console.log(combinedMessages2);