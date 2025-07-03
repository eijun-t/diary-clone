import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTemporaryFeedbacks, saveTemporaryFeedback } from '@/lib/database/feedback-queue';

/**
 * ユーザーの一時フィードバック一覧を取得
 * GET /api/feedbacks/temporary
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const characterId = searchParams.get('character_id');
    const isDisplayed = searchParams.get('is_displayed');
    
    // 一時フィードバックを取得
    const feedbacks = await getTemporaryFeedbacks(user.id, limit);
    
    // フィルタリング
    let filteredFeedbacks = feedbacks;
    
    if (characterId) {
      filteredFeedbacks = filteredFeedbacks.filter(f => f.character_id === characterId);
    }
    
    if (isDisplayed !== null) {
      const displayedFilter = isDisplayed === 'true';
      filteredFeedbacks = filteredFeedbacks.filter(f => f.is_displayed === displayedFilter);
    }
    
    // 統計情報
    const stats = {
      total: filteredFeedbacks.length,
      byCharacter: {} as Record<string, number>,
      displayed: filteredFeedbacks.filter(f => f.is_displayed).length,
      notDisplayed: filteredFeedbacks.filter(f => !f.is_displayed).length
    };
    
    filteredFeedbacks.forEach(feedback => {
      stats.byCharacter[feedback.character_name] = (stats.byCharacter[feedback.character_name] || 0) + 1;
    });
    
    return NextResponse.json({
      success: true,
      feedbacks: filteredFeedbacks,
      stats,
      pagination: {
        limit,
        returned: filteredFeedbacks.length,
        hasMore: feedbacks.length >= limit
      }
    });
    
  } catch (error) {
    console.error('Error fetching temporary feedbacks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch temporary feedbacks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * 一時フィードバックの表示状態を更新
 * PATCH /api/feedbacks/temporary
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { feedbackIds, isDisplayed } = body;
    
    if (!Array.isArray(feedbackIds) || typeof isDisplayed !== 'boolean') {
      return NextResponse.json({
        error: 'feedbackIds (array) and isDisplayed (boolean) are required'
      }, { status: 400 });
    }
    
    // 一時フィードバックの表示状態を更新
    const { data, error } = await supabase
      .from('temporary_feedbacks')
      .update({ is_displayed: isDisplayed })
      .eq('user_id', user.id)
      .in('id', feedbackIds)
      .select('id, character_name, is_displayed');
    
    if (error) {
      throw new Error(`Failed to update feedbacks: ${error.message}`);
    }
    
    console.log(`📝 Updated ${data?.length || 0} temporary feedbacks for user ${user.id}`);
    
    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      feedbacks: data
    });
    
  } catch (error) {
    console.error('Error updating temporary feedbacks:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update temporary feedbacks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * 一時フィードバックをお気に入りテーブルに移行
 * POST /api/feedbacks/temporary/favorite
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { temporaryFeedbackId } = body;
    
    if (!temporaryFeedbackId) {
      return NextResponse.json({
        error: 'temporaryFeedbackId is required'
      }, { status: 400 });
    }
    
    // 一時フィードバックを取得
    const { data: tempFeedback, error: selectError } = await supabase
      .from('temporary_feedbacks')
      .select('*')
      .eq('id', temporaryFeedbackId)
      .eq('user_id', user.id)
      .single();
    
    if (selectError || !tempFeedback) {
      return NextResponse.json({
        error: 'Temporary feedback not found'
      }, { status: 404 });
    }
    
    // お気に入りテーブルに保存
    const { data: savedFeedback, error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        user_id: user.id,
        character_id: tempFeedback.character_id,
        diary_entry_id: tempFeedback.diary_entry_id,
        content: tempFeedback.content,
        is_favorited: true,
        created_at: tempFeedback.generated_at
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to save feedback as favorite: ${insertError.message}`);
    }
    
    // 一時フィードバックを削除
    const { error: deleteError } = await supabase
      .from('temporary_feedbacks')
      .delete()
      .eq('id', temporaryFeedbackId)
      .eq('user_id', user.id);
    
    if (deleteError) {
      console.error('Warning: Failed to delete temporary feedback after favoriting:', deleteError);
      // お気に入り保存は成功しているので、エラーにはしない
    }
    
    console.log(`⭐ Favorited feedback ${temporaryFeedbackId} for user ${user.id}`);
    
    return NextResponse.json({
      success: true,
      message: 'Feedback favorited successfully',
      feedback: savedFeedback,
      temporaryFeedbackRemoved: !deleteError
    });
    
  } catch (error) {
    console.error('Error favoriting feedback:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to favorite feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}