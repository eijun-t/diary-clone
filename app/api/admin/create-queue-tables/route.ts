import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    // Development only
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const supabase = createClient();

    // SQLファイルを読み込み
    const sqlPath = join(process.cwd(), 'lib', 'database', 'feedback-queue-schema.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    // SQLを実行（複数のステートメントを分割）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    const results = [];
    
    for (const statement of statements) {
      try {
        if (statement.includes('CREATE TABLE') || 
            statement.includes('CREATE POLICY') || 
            statement.includes('ALTER TABLE') ||
            statement.includes('CREATE OR REPLACE FUNCTION') ||
            statement.includes('CREATE INDEX')) {
          
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql_statement: statement 
          });
          
          if (error) {
            console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
            console.error('Error:', error);
            results.push({
              statement: statement.substring(0, 100) + '...',
              success: false,
              error: error.message
            });
          } else {
            results.push({
              statement: statement.substring(0, 100) + '...',
              success: true
            });
          }
        }
      } catch (err) {
        console.error('Exception executing statement:', err);
        results.push({
          statement: statement.substring(0, 100) + '...',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      message: `Queue tables creation completed: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('Error creating queue tables:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create queue tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    message: 'Queue tables creation endpoint is ready',
    sqlFile: 'lib/database/feedback-queue-schema.sql',
    environment: process.env.NODE_ENV
  });
}