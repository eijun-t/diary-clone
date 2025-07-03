// Character context management types

export interface CharacterContextRaw {
  id: string;
  user_id: string;
  character_id: number;
  content_type: 'chat' | 'diary' | 'feedback';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CharacterContextSummary {
  id: string;
  user_id: string;
  character_id: number;
  summary_type: 'weekly' | 'super_weekly';
  period_start: string;
  period_end: string;
  summary_content: string;
  source_count: number;
  created_at: string;
}

export interface ContextData {
  chat?: string;
  diary?: string;
  feedback?: string;
  metadata?: Record<string, any>;
}

export interface ContextTimeWindow {
  start: Date;
  end: Date;
}

export type ContentType = 'chat' | 'diary' | 'feedback';