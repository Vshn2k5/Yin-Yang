import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { Quest, QuestTemplate, QuestType, Skill, ShopItem, Achievement } from '../types';

// DB row types from the Database interface
type UserStatsRow = Database['public']['Tables']['user_stats']['Row'];
type UserStatsUpdate = Database['public']['Tables']['user_stats']['Update'];
type UserSkillsRow = Database['public']['Tables']['user_skills']['Row'];
type UserQuestsRow = Database['public']['Tables']['user_quests']['Row'];
type QuestTemplateRow = Database['public']['Tables']['quest_templates']['Row'];
type UserStreaksRow = Database['public']['Tables']['user_streaks']['Row'];
type UserInventoryRow = Database['public']['Tables']['user_inventory']['Row'];
type UserAchievementsRow = Database['public']['Tables']['user_achievements']['Row'];

export const gamificationAPI = {
  // User Stats
  async getUserStats(userId: string): Promise<UserStatsRow | null> {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateUserStats(userId: string, updates: UserStatsUpdate): Promise<UserStatsRow | null> {
    const { data, error } = await supabase
      .from('user_stats')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // User Skills
  async getUserSkills(userId: string): Promise<UserSkillsRow[]> {
    const { data, error } = await supabase
      .from('user_skills')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  },

  async upsertUserSkill(userId: string, skill: Partial<Skill>): Promise<UserSkillsRow | null> {
    const { data, error } = await supabase
      .from('user_skills')
      .upsert({
        user_id: userId,
        name: skill.name!,
        domain: skill.domain!,
        level: skill.level,
        xp: skill.xp,
        xp_to_next_level: skill.xpToNextLevel,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, name' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // User Quests
  async getUserQuests(userId: string): Promise<UserQuestsRow[]> {
    const { data, error } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  },

  async upsertUserQuest(userId: string, quest: Partial<Quest>): Promise<UserQuestsRow | null> {
    const { data, error } = await supabase
      .from('user_quests')
      .upsert({
        user_id: userId,
        quest_id: quest.id!,
        title: quest.title!,
        domain: quest.domain!,
        status: quest.status,
        xp_reward: quest.xpReward!,
        coin_reward: quest.coinReward!,
        completed_at: quest.completedAt?.toISOString() ?? null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getQuestTemplates(questType?: QuestType): Promise<QuestTemplate[]> {
    let query = supabase
      .from('quest_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (questType) {
      query = query.eq('quest_type', questType);
    }

    const { data, error } = await query;

    if (error) {
      // Backward-compatible fallback when migration is not yet applied.
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    return (data as QuestTemplateRow[]).map((row) => ({
      key: row.template_key,
      title: row.title,
      description: row.description,
      domain: row.domain,
      difficulty: row.difficulty,
      type: row.quest_type,
      xpReward: row.base_xp_reward,
      coinReward: row.base_coin_reward,
      completionCriteria: row.completion_criteria
    }));
  },

  // User Streaks
  async getUserStreak(userId: string): Promise<UserStreaksRow | null> {
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateUserStreak(userId: string, updates: Partial<UserStreaksRow>): Promise<UserStreaksRow | null> {
    const { data, error } = await supabase
      .from('user_streaks')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // User Inventory
  async getUserInventory(userId: string): Promise<UserInventoryRow[]> {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  },

  async addInventoryItem(userId: string, item: Partial<ShopItem>): Promise<UserInventoryRow | null> {
    const { data, error } = await supabase
      .from('user_inventory')
      .insert({
        user_id: userId,
        item_id: item.id!,
        item_name: item.name!,
        item_type: item.category!,
        is_active: item.active || false,
        expires_at: item.expiresAt?.toISOString() ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // User Achievements
  async getUserAchievements(userId: string): Promise<UserAchievementsRow[]> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  },

  // Secure Actions (RPC)
  async completeQuestRPC(userId: string, quest: Partial<Quest>): Promise<{ success: boolean; message?: string; coins_earned: number; xp_earned: number }> {
    const { data, error } = await supabase.rpc('complete_quest', {
      p_user_id: userId,
      p_quest_id: quest.id!,
      p_title: quest.title!,
      p_domain: quest.domain!,
      p_xp_reward: quest.xpReward!,
      p_coin_reward: quest.coinReward!
    });

    if (error) throw error;
    return data as { success: boolean; message?: string; coins_earned: number; xp_earned: number };
  },

  async purchaseItemRPC(userId: string, item: ShopItem): Promise<{ success: boolean; message?: string; remaining_coins: number }> {
    const { data, error } = await supabase.rpc('purchase_item', {
      p_user_id: userId,
      p_item_id: item.id,
      p_item_name: item.name,
      p_item_type: item.category,
      p_price: item.price
    });

    if (error) throw error;
    return data as { success: boolean; message?: string; remaining_coins: number };
  },

  async unlockAchievement(userId: string, achievement: Partial<Achievement>): Promise<UserAchievementsRow | null> {
    const { data, error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievement.id!,
        title: achievement.title!,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
