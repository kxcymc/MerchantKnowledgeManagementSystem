import { Message, ChatSession, User, Attachment } from '../types';

// Simulated delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Data Storage
let mockSessions: ChatSession[] = [
  {
    id: '1',
    title: 'React Performance Optimization',
    updatedAt: Date.now(),
    createdAt: Date.now() - 86400000,
  },
  {
    id: '2',
    title: 'How to cook pasta',
    updatedAt: Date.now() - 86400000,
    createdAt: Date.now() - 172800000,
  },
  {
    id: '3',
    title: 'Travel itinerary for Japan',
    updatedAt: Date.now() - 172800000,
    createdAt: Date.now() - 259200000,
  },
];

const mockMessages: Map<string, Message[]> = new Map([
  ['1', []],
  ['2', []],
  ['3', []],
]);

const MOCK_USER: User = {
  id: 'u-1',
  username: 'Developer',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DevUser',
};

// Simulated AI Responses
const AI_RESPONSES: Record<string, string> = {
  default: `I appreciate your question! Here's a comprehensive response:

**Key Points:**
1. **Understanding the fundamentals** - This is crucial for building a strong foundation
2. **Practical application** - Theory is great, but practice makes perfect
3. **Continuous learning** - Stay updated with latest practices and tools
4. **Best practices** - Follow established patterns and conventions

\`\`\`typescript
// Example code
const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};

// Usage
console.log(greet('World')); // Output: Hello, World!
\`\`\`

Feel free to ask follow-up questions or explore other topics. I'm here to help!`,

  react: `React is a powerful JavaScript library for building user interfaces with reusable components.

**Core Concepts:**
- **Components** - Reusable UI building blocks
- **Props** - Pass data to components
- **State** - Manage component data
- **Hooks** - Add state and lifecycle features

\`\`\`typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
\`\`\`

React is wonderful for building complex, interactive UIs efficiently.`,

  hello: `Hello! I'm your AI assistant, similar to Doubao. I'm here to help you with:
- Code and programming questions
- Writing and creative tasks
- Learning and explanations
- Problem-solving and brainstorming

Feel free to ask me anything! What would you like to know today?`,
};

// Helper to generate AI response based on user input
function generateResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('react') || lowerMessage.includes('component')) {
    return AI_RESPONSES.react;
  } else if (
    lowerMessage.includes('hello') ||
    lowerMessage.includes('hi') ||
    lowerMessage.includes('hey')
  ) {
    return AI_RESPONSES.hello;
  }

  return AI_RESPONSES.default;
}

export const mockApi = {
  /**
   * Mock login
   */
  login: async (username: string, _password: string): Promise<User> => {
    await delay(1000);
    if (!username || username.trim() === '') {
      throw new Error('Username is required');
    }

    // Store token
    localStorage.setItem('auth_token', 'mock_token_' + Date.now());

    return {
      ...MOCK_USER,
      username: username,
    };
  },

  /**
   * Get all chat sessions
   */
  getHistory: async (): Promise<ChatSession[]> => {
    await delay(500);
    return mockSessions.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  /**
   * Create a new chat session
   */
  createNewSession: async (): Promise<ChatSession> => {
    await delay(300);
    const newSession: ChatSession = {
      id: 'session_' + Date.now(),
      title: 'New Chat',
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    mockSessions.push(newSession);
    mockMessages.set(newSession.id, []);
    return newSession;
  },

  /**
   * Delete a chat session
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    await delay(300);
    mockSessions = mockSessions.filter((s) => s.id !== sessionId);
    mockMessages.delete(sessionId);
  },

  /**
   * Get messages for a session
   */
  getSessionMessages: async (sessionId: string): Promise<Message[]> => {
    await delay(400);
    return mockMessages.get(sessionId) || [];
  },

  /**
   * Rename a chat session
   */
  renameSession: async (sessionId: string, newTitle: string): Promise<ChatSession> => {
    await delay(300);
    const session = mockSessions.find((s) => s.id === sessionId);
    if (session) {
      session.title = newTitle;
      session.updatedAt = Date.now();
    }
    return session || ({} as ChatSession);
  },

  /**
   * Send a message and get streaming response
   */
  sendMessage: async (
    sessionId: string,
    userMessage: string,
    attachments: Attachment[] = [],
    onChunk: (chunk: string) => void,
    onComplete: (fullMessage: string) => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    try {
      // Create and store user message
      const userMsg: Message = {
        id: 'msg_' + Date.now(),
        sessionId,
        role: 'user',
        content: userMessage,
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp: Date.now(),
      };

      const sessionMessages = mockMessages.get(sessionId) || [];
      sessionMessages.push(userMsg);

      // Update session
      const session = mockSessions.find((s) => s.id === sessionId);
      if (session) {
        session.updatedAt = Date.now();
        // Update title if it's still "New Chat"
        if (session.title === 'New Chat' && userMessage.length > 0) {
          session.title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
        }
      }

      // Simulate network latency before AI response
      await delay(800);

      // Generate AI response
      const aiResponseText = generateResponse(userMessage);
      const words = aiResponseText.split(/(\s+)/);
      let fullResponse = '';

      // Simulate streaming
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        fullResponse += word;
        onChunk(word);

        // Variable delay for more natural streaming
        await delay(Math.random() * 30 + 20);
      }

      // Store AI response
      const aiMsg: Message = {
        id: 'msg_' + (Date.now() + 1),
        sessionId,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      };
      sessionMessages.push(aiMsg);
      mockMessages.set(sessionId, sessionMessages);

      onComplete(fullResponse);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMsg);
    }
  },

  /**
   * Upload file (mock)
   */
  uploadFile: async (file: File): Promise<Attachment> => {
    await delay(1000);

    return {
      id: 'file_' + Date.now(),
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      size: file.size,
    };
  },

  /**
   * Logout
   */
  logout: async (): Promise<void> => {
    await delay(300);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('doubao_user');
  },
};
