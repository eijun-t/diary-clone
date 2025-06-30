'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { 
  createChatSession, 
  createChatMessage, 
  getChatMessages, 
  getCharacterById 
} from '@/lib/database/character';
import { ChatMessage, ChatSession, Character } from '@/lib/types/character';

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const feedbackId = searchParams.get('feedbackId');
  const characterId = searchParams.get('characterId');
  const characterName = searchParams.get('characterName');

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          setError(`認証エラー: ${authError.message}`);
          return;
        }
        
        if (!user) {
          router.push('/auth/login');
          return;
        }

        if (!characterId) {
          setError('キャラクターIDが指定されていません');
          return;
        }

        setUser(user);

        // Load character data
        const characterData = await getCharacterById(characterId);
        if (!characterData) {
          setError('キャラクターが見つかりません');
          return;
        }
        setCharacter(characterData);

        // Create or load chat session
        const sessionTitle = feedbackId 
          ? `${characterData.name}とのチャット (フィードバックから)`
          : `${characterData.name}とのチャット`;

        const newSession = await createChatSession({
          userId: user.id,
          characterId: characterId,
          feedbackId: feedbackId || undefined,
          title: sessionTitle,
          isActive: true,
          lastMessageAt: new Date()
        });

        setChatSession(newSession);

        // Load existing messages
        const existingMessages = await getChatMessages(newSession.id);
        setMessages(existingMessages);

      } catch (err) {
        console.error('Chat page error:', err);
        
        let errorMessage = 'チャットの読み込みに失敗しました';
        
        if (err instanceof Error) {
          // Check if it's a table not found error
          if (err.message.includes('relation') && err.message.includes('does not exist')) {
            errorMessage = 'チャット機能のデータベースが設定されていません。管理者にお問い合わせください。';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(`エラー: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router, characterId, feedbackId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !chatSession || !character || isSending) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      console.log('Step 1: Creating user message...');
      // Add user message
      const userMessage = await createChatMessage({
        chatSessionId: chatSession.id,
        senderId: user.id,
        senderType: 'user',
        content: messageContent
      });
      console.log('Step 1 completed: User message created', userMessage);

      setMessages(prev => [...prev, userMessage]);

      console.log('Step 2: Generating character response...');
      // Generate character response using OpenAI
      const characterResponse = await generateCharacterResponse(messageContent, character, messages);
      console.log('Step 2 completed: Character response generated', characterResponse);
      
      console.log('Step 3: Creating character message...');
      const characterMessage = await createChatMessage({
        chatSessionId: chatSession.id,
        senderId: user.id, // Use user.id for sender_id since it's UUID, store actual sender info in senderType
        senderType: 'character',
        content: characterResponse
      });
      console.log('Step 3 completed: Character message created', characterMessage);

      setMessages(prev => [...prev, characterMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        stringified: JSON.stringify(error),
        typeof: typeof error
      });
      setError(`メッセージの送信に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const generateCharacterResponse = async (
    userMessage: string, 
    character: Character, 
    chatHistory: ChatMessage[]
  ): Promise<string> => {
    try {
      const response = await fetch('/api/chat/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage,
          character,
          chatHistory: chatHistory.slice(-10) // Only send last 10 messages for context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API response error:', errorData);
        throw new Error(`Failed to generate response: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error generating character response:', error);
      return `${character.name}からの返信でエラーが発生しました。もう一度お試しください。`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!user || !character) {
    return null;
  }

  return (
    <div className="min-h-screen muute-gradient flex flex-col">
      <div className="container mx-auto max-w-lg flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm border-b border-border/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: character.backgroundColor }}
            >
              {character.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-medium text-foreground">{character.name}</h1>
              <p className="text-sm text-muted-foreground">{character.role}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="muute-card p-6 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4"
                style={{ backgroundColor: character.backgroundColor }}
              >
                {character.name.charAt(0)}
              </div>
              <h3 className="text-lg font-medium mb-2 text-foreground">
                {character.name}とのチャット
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                何でも気軽に話しかけてください！
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.senderType === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/80 text-foreground border border-border/20'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <p className={`text-xs mt-1 ${
                    message.senderType === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {message.createdAt.toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-border/20">
          <div className="flex gap-3 items-end">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`${character.name}にメッセージを送る...`}
              className="flex-1 min-h-[44px] max-h-32 resize-none border-border/40 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={isSending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="muute-button bg-primary hover:bg-primary/90 text-white p-3"
            >
              {isSending ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}