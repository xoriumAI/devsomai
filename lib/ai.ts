import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: "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",
  dangerouslyAllowBrowser: true
});

interface QueueItem {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

class RateLimiter {
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 2000; // 2 seconds between requests
  private readonly maxRetries: number = 3;
  private readonly baseDelay: number = 2000;

  async enqueue(messages: { role: 'user' | 'assistant' | 'system'; content: string }[]): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, messages });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const now = Date.now();
    const timeToWait = Math.max(0, this.minRequestInterval - (now - this.lastRequestTime));

    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }

    const item = this.queue[0];
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const completion = await groq.chat.completions.create({
          messages: item.messages,
          model: "mixtral-8x7b-32768",
          temperature: 0.7,
          max_tokens: 1024,
        });

        if (!completion.choices?.[0]?.message?.content) {
          throw new Error("No response from AI");
        }

        this.lastRequestTime = Date.now();
        this.queue.shift();
        item.resolve(completion.choices[0].message.content);
        break;
      } catch (error) {
        retryCount++;
        
        if (error instanceof Error && error.message.includes('429')) {
          if (retryCount === this.maxRetries) {
            item.resolve("I'm currently experiencing high demand. Please try again in a minute.");
            this.queue.shift();
            break;
          }
          await new Promise(resolve => 
            setTimeout(resolve, this.baseDelay * Math.pow(2, retryCount))
          );
          continue;
        }
        
        item.reject(error instanceof Error ? error : new Error('Unknown error'));
        this.queue.shift();
        break;
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}

const rateLimiter = new RateLimiter();

export async function chatWithAI(messages: { role: 'user' | 'assistant' | 'system'; content: string }[]): Promise<string> {
  try {
    return await rateLimiter.enqueue(messages);
  } catch (error) {
    console.error('AI Chat Error:', error);
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        return "I'm currently handling too many requests. Please try again in a minute.";
      } else if (error.message.includes('timeout')) {
        return "The request took too long to process. Please try again.";
      }
      return `I encountered an error: ${error.message}. Please try again in a moment.`;
    }
    return "Sorry, I encountered an unexpected error while processing your request. Please try again later.";
  }
}