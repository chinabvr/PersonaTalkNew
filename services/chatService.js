// chatController.js
const { Configuration, OpenAIApi } = require("openai");
const Response = require("../models/response");
const Conversation = require("../models/conversation");
const Agent = require("../models/agent");

// Generate a response using OpenAI's GPT-3 model
async function generateResponse(username, agentName, message) {
  try {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const agent = await Agent.findOne({ agent_name: agentName });

    const userIntro = `You are talking to ${username}. It is currently ${new Date()}.`;

    const conversationContext = `${agent.persona}\n${userIntro}`;

    const conversationHistory = [];

    conversationHistory.push({
      role: "system",
      content: conversationContext,
    });

    // Fetch conversation history and add previous 5 interactions
    let conversation = await Conversation.findOne({
      username: username,
      agent_name: agentName,
    });

    if (conversation) {
      const messageLimit = 5;
      let messageThread = conversation.messages;
      if (messageThread.length >= messageLimit) {
        messageThread = messageThread.slice(-messageLimit);
      }
      messageThread.forEach((message) => {
        conversationHistory.push({
          role: "user",
          content: message.initial_message,
        });

        conversationHistory.push({
          role: "assistant",
          content: message.message_reply,
        });
      });
    } else {
      conversation = new Conversation({
        username: username,
        agent_name: agentName,
      });
    }

    conversationHistory.push({
      role: "user",
      content: message,
    });

    openai
      .createChatCompletion({
        model: agent.model,
        messages: conversationHistory,
        max_tokens: 100,
      })
      .then((response) => {
        // Save the response to the database
        const newResponse = new Response({
          username: username,
          agent_name: agentName,
          initial_message: message,
          message_reply: response.data.choices[0].message.content,
        });

        conversation.messages.push(newResponse);
        conversation.save().catch((err) => {
          console.error("Error updating conversation:", err);
          throw err;
        });

        newResponse
          .save()
          .then((savedResponse) => {
            return savedResponse;
          })
          .catch((err) => {
            console.error("Error saying chat response:", err);
            throw err;
          });
      })
      .catch((err) => {
        console.error("Error with OpenAI API:", err);
        throw err;
      });
  } catch (err) {
    console.error("Error generating chat response:", err);
    throw err;
  }
}

module.exports = {
  generateResponse,
};
