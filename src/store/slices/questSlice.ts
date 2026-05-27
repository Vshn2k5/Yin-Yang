import { StateCreator } from 'zustand';
import { Quest, QuestChain } from '../../types';
import { gamificationAPI } from '../../services/gamification';
import { ProdigyState } from '../index';
import { generateDailyQuests, generateDailyQuestsFromTemplates, getStreakMultiplier } from '../utils';

export interface QuestSlice {
  quests: Quest[];
  questChains: QuestChain[];
  addQuest: (quest: Quest) => Promise<void>;
  completeQuest: (id: string, userId?: string) => Promise<void>;
  failQuest: (id: string) => Promise<void>;
  fetchQuests: (userId: string) => Promise<void>;
  refreshDailyQuests: () => void;
  setQuests: (quests: Quest[]) => void;
}

export const createQuestSlice: StateCreator<ProdigyState, [], [], QuestSlice> = (set, get) => ({
  quests: [],
  questChains: [],

  setQuests: (quests: Quest[]) => set({ quests }),

  addQuest: async (quest: Quest) => {
    set((state: ProdigyState) => ({
      quests: [...state.quests, quest]
    }));

    const userId = get().authUser?.id;
    if (userId && userId !== 'guest') {
      try {
        await gamificationAPI.upsertUserQuest(userId, {
          ...quest,
          status: quest.status || 'active',
          completedAt: quest.completed ? (quest.completedAt ?? new Date()) : undefined
        });
      } catch (error) {
        console.error('Error syncing new quest:', error);
      }
    }
  },

  completeQuest: async (id: string, userId?: string) => {
    const state = get();
    const quest = state.quests.find((q: Quest) => q.id === id);
    const resolvedUserId = userId ?? (state.authUser?.id !== 'guest' ? state.authUser?.id : undefined);
    
    if (!quest || quest.completed) return;

    if (resolvedUserId) {
      try {
        const result = await gamificationAPI.completeQuestRPC(resolvedUserId, quest);
        if (result.success) {
          // Mark quest completed locally
          set((state: ProdigyState) => ({
            quests: state.quests.map((q: Quest) => 
              q.id === id ? {
                ...q,
                completed: true,
                status: 'completed' as const,
                completedAt: new Date()
              } : q
            ),
            user: {
              ...state.user,
              progressRings: {
                ...state.user.progressRings,
                daily: { ...state.user.progressRings.daily, current: state.user.progressRings.daily.current + 1 },
                weekly: { ...state.user.progressRings.weekly, current: state.user.progressRings.weekly.current + 1 },
                monthly: { ...state.user.progressRings.monthly, current: state.user.progressRings.monthly.current + 1 }
              }
            }
          }));

          // Fetch fresh stats from server to avoid double-counting coins/XP
          // (The RPC already updated coins and XP server-side)
          await state.fetchUserData(resolvedUserId);

          // Award XP to skills locally for UI feedback
          const domainSkills = state.skills.filter(s => s.domain === quest.domain);
          if (domainSkills.length > 0) {
            await state.addXp(domainSkills[0].id, result.xp_earned, resolvedUserId);
          }
        }
      } catch (error) {
        console.error('Error completing quest:', error);
      }
    } else {
      // Offline/Guest fallback
      const streakMultiplier = getStreakMultiplier(state.user.streak.current);
      const penaltyMultiplier = 1 - (state.user.penalties.coinEarningPenalty / 100);
      const coinBoost = state.user.activeBoosts.find(b => b.effect.type === 'coin_multiplier');
      
      let finalCoinReward = quest.coinReward * streakMultiplier * penaltyMultiplier;
      if (coinBoost) finalCoinReward *= coinBoost.effect.value;
      finalCoinReward = Math.floor(finalCoinReward);

      set((state: ProdigyState) => ({
        quests: state.quests.map((q: Quest) => 
          q.id === id ? {
            ...q,
            completed: true,
            status: 'completed' as const,
            completedAt: new Date()
          } : q
        ),
        user: {
          ...state.user,
          coins: state.user.coins + finalCoinReward,
          progressRings: {
            ...state.user.progressRings,
            daily: { ...state.user.progressRings.daily, current: state.user.progressRings.daily.current + 1 },
            weekly: { ...state.user.progressRings.weekly, current: state.user.progressRings.weekly.current + 1 },
            monthly: { ...state.user.progressRings.monthly, current: state.user.progressRings.monthly.current + 1 }
          }
        }
      }));
    }
  },

  failQuest: async (id: string) => {
    const state = get();
    const quest = state.quests.find((q: Quest) => q.id === id);
    const userId = state.authUser?.id !== 'guest' ? state.authUser?.id : undefined;

    set((state: ProdigyState) => ({
      quests: state.quests.map(q => 
        q.id === id ? {
          ...q,
          status: 'failed' as const
        } : q
      )
    }));

    if (userId && quest) {
      try {
        await gamificationAPI.upsertUserQuest(userId, {
          ...quest,
          status: 'failed',
          completed: false
        });
      } catch (error) {
        console.error('Error syncing failed quest:', error);
      }
    }
    
    await get().applyPenalties();
  },

  fetchQuests: async (userId: string) => {
    try {
      const [dbQuests, templateQuests] = await Promise.all([
        gamificationAPI.getUserQuests(userId),
        gamificationAPI.getQuestTemplates('daily')
      ]);
      const localQuestById = new Map(get().quests.map((quest) => [quest.id, quest]));
      const dbQuestById = new Map(dbQuests.map((quest) => [quest.quest_id, quest]));
      const dailyQuests = templateQuests.length > 0
        ? generateDailyQuestsFromTemplates(templateQuests)
        : generateDailyQuests();

      const hydratedDailyQuests: Quest[] = dailyQuests.map((dailyQuest) => {
        const dbQuest = dbQuestById.get(dailyQuest.id);
        if (!dbQuest) {
          return dailyQuest;
        }

        const localQuest = localQuestById.get(dbQuest.quest_id);
        const fallbackDifficulty: Quest['difficulty'] =
          dbQuest.xp_reward >= 75 ? 'Hard' : dbQuest.xp_reward >= 50 ? 'Medium' : 'Easy';

        return {
          ...dailyQuest,
          title: dbQuest.title,
          domain: dbQuest.domain,
          difficulty: localQuest?.difficulty ?? fallbackDifficulty,
          xpReward: dbQuest.xp_reward,
          coinReward: dbQuest.coin_reward,
          status: dbQuest.status,
          completed: dbQuest.status === 'completed',
          completedAt: dbQuest.completed_at ? new Date(dbQuest.completed_at) : undefined,
          createdAt: dbQuest.created_at ? new Date(dbQuest.created_at) : dailyQuest.createdAt,
          description: localQuest?.description ?? dailyQuest.description,
          completionCriteria: localQuest?.completionCriteria ?? dailyQuest.completionCriteria
        };
      });

      const customPersistedQuests: Quest[] = dbQuests
        .filter((dbQuest) => !dbQuest.quest_id.startsWith('daily-'))
        .map((dbQuest) => {
          const localQuest = localQuestById.get(dbQuest.quest_id);
          const inferredType: Quest['type'] = dbQuest.quest_id.startsWith('weekly-')
            ? 'weekly'
            : dbQuest.quest_id.startsWith('monthly-')
              ? 'monthly'
              : dbQuest.quest_id.startsWith('chain-')
                ? 'chain'
                : 'daily';
          const fallbackDifficulty: Quest['difficulty'] =
            dbQuest.xp_reward >= 75 ? 'Hard' : dbQuest.xp_reward >= 50 ? 'Medium' : 'Easy';

          return {
            id: dbQuest.quest_id,
            title: dbQuest.title,
            description: localQuest?.description ?? 'No description provided.',
            domain: dbQuest.domain,
            difficulty: localQuest?.difficulty ?? fallbackDifficulty,
            type: localQuest?.type ?? inferredType,
            xpReward: dbQuest.xp_reward,
            coinReward: dbQuest.coin_reward,
            completed: dbQuest.status === 'completed',
            status: dbQuest.status,
            deadline: localQuest?.deadline,
            createdAt: dbQuest.created_at ? new Date(dbQuest.created_at) : new Date(),
            completedAt: dbQuest.completed_at ? new Date(dbQuest.completed_at) : undefined,
            chainId: localQuest?.chainId,
            chainPosition: localQuest?.chainPosition,
            completionCriteria: localQuest?.completionCriteria ?? ['Complete this quest.'],
            timeLimit: localQuest?.timeLimit,
            metrics: localQuest?.metrics
          };
        });

      const newResetTime = new Date();
      newResetTime.setHours(24, 0, 0, 0);
      const completedDailyCount = hydratedDailyQuests.filter((quest) => quest.completed).length;

      set((state: ProdigyState) => ({
        quests: [...customPersistedQuests, ...hydratedDailyQuests],
        user: {
          ...state.user,
          progressRings: {
            ...state.user.progressRings,
            daily: {
              ...state.user.progressRings.daily,
              current: completedDailyCount,
              target: hydratedDailyQuests.length || state.user.progressRings.daily.target,
              resetTime: newResetTime
            }
          }
        }
      }));
    } catch (error) {
      console.error('Error fetching quests:', error);
    }
  },

  refreshDailyQuests: () => {
    const state = get();
    const userId = state.authUser?.id;
    const resolvedUserId = userId && userId !== 'guest' ? userId : undefined;
    const hasDailyQuests = state.quests.some((quest) => quest.type === 'daily');
    const now = new Date();
    const lastReset = new Date(state.user.progressRings.daily.resetTime);
    const isNewDay = now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth();

    if (!hasDailyQuests || isNewDay) {
      if (resolvedUserId) {
        void get().fetchQuests(resolvedUserId);
        return;
      }

      const nonDailyQuests = state.quests.filter(q => q.type !== 'daily');
      const newDailyQuests = generateDailyQuests();
      
      const newResetTime = new Date();
      newResetTime.setHours(24, 0, 0, 0);
      
      set((state: ProdigyState) => ({
        quests: [...nonDailyQuests, ...newDailyQuests],
        user: {
          ...state.user,
          progressRings: {
            ...state.user.progressRings,
            daily: {
              current: 0,
              target: newDailyQuests.length,
              resetTime: newResetTime
            }
          }
        }
      }));
    }
  },
});
