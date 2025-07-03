import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { Character, ChatMessage } from '@/lib/types/character';
import { buildContextForChat } from '@/lib/services/context-management';
import { storeRawContext } from '@/lib/database/character-context';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RequestBody {
  userMessage: string;
  character: Character;
  chatHistory: ChatMessage[];
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Chat API called');
    
    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Verify user authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: RequestBody = await request.json();
    const { userMessage, character, chatHistory, sessionId } = body;

    if (!userMessage || !character) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build enhanced context using the context management system
    const enhancedContext = await buildContextForChat(
      user.id,
      character.id,
      1500 // Reserve tokens for system prompt and conversation
    );

    // Build conversation context with enhanced long-term memory
    let systemPrompt = character.systemPrompt;
    
    if (enhancedContext) {
      systemPrompt += '\n\n## Context and Background:\n' + enhancedContext;
    }
    
    systemPrompt += '\n\nあなたは今、ユーザーとリアルタイムでチャットしています。上記のコンテキストを参考にしながら、自然な会話を心がけ、相手の気持ちに寄り添った返答をしてください。返答は100文字程度で簡潔にお願いします。';

    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add recent chat history for context (limit to last 10 messages to manage token usage)
    const recentHistory = chatHistory.slice(-10);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.senderType === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Generate response using OpenAI
    console.log('Calling OpenAI API with messages:', messages.length);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 150,
      temperature: 0.8,
    });

    console.log('OpenAI API response received');
    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      throw new Error('Empty response generated');
    }

    // Store the chat interaction in context system for future reference
    try {
      const chatContent = `User: ${userMessage}\nCharacter: ${response}`;
      await storeRawContext(
        user.id,
        character.id,
        'chat',
        chatContent,
        {
          session_id: sessionId,
          timestamp: new Date().toISOString()
        }
      );
    } catch (contextError) {
      console.error('Error storing chat context:', contextError);
      // Don't fail the request if context storage fails
    }

    return NextResponse.json(
      { response },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error generating chat response:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate response',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}