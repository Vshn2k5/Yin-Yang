import { StateCreator } from 'zustand';
import { 
  UserProfile, 
  PersonalProfile, 
  HealthMetrics, 
  ProfessionalGoals, 
  LearningPreferences, 
  AccountabilitySettings, 
  CommunicationPreferences,
  ShopItem
} from '../../types';
import { gamificationAPI } from '../../services/gamification';
import { ProdigyState } from '../index';

export interface UserSlice {
  user: UserProfile;
  updateUser: (updates: Partial<UserProfile>) => void;
  updatePersonalProfile: (profile: PersonalProfile) => void;
  updateHealthMetrics: (metrics: HealthMetrics) => void;
  updateProfessionalGoals: (goals: ProfessionalGoals) => void;
  updateLearningPreferences: (prefs: LearningPreferences) => void;
  updateAccountabilitySettings: (settings: AccountabilitySettings) => void;
  updateCommunicationPreferences: (prefs: CommunicationPreferences) => void;
  addProgressEntry: (metrics: Record<string, number>, notes: string) => void;
  updateStreak: () => Promise<void>;
  applyPenalties: () => Promise<void>;
  purchaseItem: (itemId: string) => Promise<void>;
  fetchUserData: (userId: string) => Promise<void>;
  syncUserStats: () => Promise<void>;
}

export const createUserSlice: StateCreator<ProdigyState, [], [], UserSlice> = (set, get) => ({
  user: {
    name: 'Hunter',
    title: 'Novice Explorer',
    rank: 'E',
    level: 1,
    totalXp: 0,
    coins: 1000,
    joinDate: new Date(),
    streak: {
      current: 0,
      longest: 0,
      lastUpdated: new Date(),
      freezeActive: false,
      milestones: []
    },
    lastActive: new Date(),
    penalties: {
      consecutiveMissedDays: 0,
      coinEarningPenalty: 0,
      streakDecayRate: 0,
      redemptionTasksRequired: 0,
      redemptionTasksCompleted: 0
    },
    progressRings: {
      daily: { current: 0, target: 3, resetTime: new Date() },
      weekly: { current: 0, target: 15, resetTime: new Date() },
      monthly: { current: 0, target: 60, resetTime: new Date() }
    },
    ownedItems: [],
    activeBoosts: [],
    badges: [],
    progressHistory: [],
  },

  updateUser: (updates: Partial<UserProfile>) => {
    set((state: ProdigyState) => ({
      user: { ...state.user, ...updates }
    }));
  },

  updatePersonalProfile: (profile: PersonalProfile) =>
    set((state: ProdigyState) => ({
      user: { ...state.user, personalProfile: profile }
    })),

  updateHealthMetrics: (metrics: HealthMetrics) =>
    set((state: ProdigyState) => ({
      user: { ...state.user, healthMetrics: metrics }
    })),

  updateProfessionalGoals: (goals: ProfessionalGoals) =>
    set((state: ProdigyState) => ({
      user: { ...state.user, professionalGoals: goals }
    })),

  updateLearningPreferences: (prefs: LearningPreferences) =>
    set((state: ProdigyState) => ({
      user: { ...state.user, learningPreferences: prefs }
    })),

  updateAccountabilitySettings: (settings: AccountabilitySettings) =>
    set((state: ProdigyState) => ({
      user: { ...state.user, accountabilitySettings: settings }
    })),

  updateCommunicationPreferences: (prefs: CommunicationPreferences) =>
    set((state: ProdigyState) => ({
      user: { ...state.user, communicationPreferences: prefs }
    })),

  addProgressEntry: (metrics: Record<string, number>, notes: string) =>
    set((state: ProdigyState) => ({
      user: {
        ...state.user,
        progressHistory: [
          ...state.user.progressHistory,
          {
            date: new Date(),
            metrics,
            notes
          }
        ]
      }
    })),

  updateStreak: async () => {
    const { user } = get();
    const now = new Date();
    const lastUpdate = new Date(user.streak.lastUpdated);
    
    if (now.getDate() !== lastUpdate.getDate() || now.getMonth() !== lastUpdate.getMonth()) {
      const newStreak = user.streak.current + 1;
      const updatedStreak = {
        ...user.streak,
        current: newStreak,
        longest: Math.max(newStreak, user.streak.longest),
        lastUpdated: now
      };

      set((state: ProdigyState) => ({
        user: { ...state.user, streak: updatedStreak }
      }));
    }
  },

  applyPenalties: async () => {
    set((state: ProdigyState) => ({
      user: {
        ...state.user,
        penalties: {
          ...state.user.penalties,
          consecutiveMissedDays: state.user.penalties.consecutiveMissedDays + 1,
          coinEarningPenalty: Math.min(50, state.user.penalties.coinEarningPenalty + 5),
          streakDecayRate: Math.min(15, state.user.penalties.streakDecayRate + 3),
          lastMissedDate: new Date(),
          redemptionTasksRequired: 3,
          redemptionTasksCompleted: 0
        }
      }
    }));

    const userId = get().authUser?.id;
    if (userId && userId !== 'guest') {
      await get().syncUserStats();
    }
  },

  purchaseItem: async (itemId: string) => {
    const state = get();
    const item = state.shopItems.find((i: ShopItem) => i.id === itemId);
    const userId = state.authUser?.id;
    
    if (!item || state.user.coins < item.price || item.owned) return;
    
    if (userId && userId !== 'guest') {
      try {
        const result = await gamificationAPI.purchaseItemRPC(userId, item);
        if (result.success) {
          // Local sync after server confirmation
          const updatedItem = { ...item, owned: true };
          
          if (item.effect.duration) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + item.effect.duration);
            updatedItem.active = true;
            updatedItem.expiresAt = expiresAt;

            set((state: ProdigyState) => ({
              user: {
                ...state.user,
                coins: result.remaining_coins,
                ownedItems: [...state.user.ownedItems, itemId],
                activeBoosts: [...state.user.activeBoosts, updatedItem]
              },
              shopItems: state.shopItems.map(i => i.id === itemId ? updatedItem : i)
            }));
          } else {
            set((state: ProdigyState) => ({
              user: {
                ...state.user,
                coins: result.remaining_coins,
                ownedItems: [...state.user.ownedItems, itemId]
              },
              shopItems: state.shopItems.map(i => i.id === itemId ? updatedItem : i)
            }));
          }
        }
      } catch (error) {
        console.error('Error purchasing item:', error);
      }
    } else {
      // Offline/Guest fallback
      const updatedItem = { ...item, owned: true };
      set((state: ProdigyState) => ({
        user: {
          ...state.user,
          coins: state.user.coins - item.price,
          ownedItems: [...state.user.ownedItems, itemId]
        },
        shopItems: state.shopItems.map(i => i.id === itemId ? updatedItem : i)
      }));
    }
  },

  fetchUserData: async (userId: string) => {
    try {
      if (get().shopItems.length === 0) {
        get().initializeShop();
      }

      const [stats, streak, inventory] = await Promise.all([
        gamificationAPI.getUserStats(userId),
        gamificationAPI.getUserStreak(userId),
        gamificationAPI.getUserInventory(userId)
      ]);

      if (stats) {
        set((state: ProdigyState) => ({
          user: {
            ...state.user,
            level: stats.level,
            rank: stats.rank,
            totalXp: stats.total_xp,
            coins: stats.coins,
            title: stats.title,
            penalties: {
              ...state.user.penalties,
              coinEarningPenalty: stats.coin_earning_penalty ?? 0
            }
          }
        }));
      }

      if (streak) {
        set((state: ProdigyState) => ({
          user: {
            ...state.user,
            streak: {
              current: streak.current_streak,
              longest: streak.longest_streak,
              lastUpdated: new Date(streak.last_updated),
              freezeActive: streak.freeze_active,
              freezeExpiresAt: streak.freeze_expires_at ? new Date(streak.freeze_expires_at) : undefined,
              milestones: state.user.streak.milestones
            }
          }
        }));
      }

      if (inventory) {
        const inventoryByItemId = new Map(inventory.map(i => [i.item_id, i]));
        const ownedItemIds = inventory.map(i => i.item_id);

        set((state: ProdigyState) => ({
          // Build active boosts from authoritative inventory rows.
          // Only booster/protection items can be active effects.
          shopItems: state.shopItems.map(item => {
            const dbItem = inventoryByItemId.get(item.id);
            if (!dbItem) {
              return { ...item, owned: false, active: false, expiresAt: undefined };
            }

            return {
              ...item,
              owned: true,
              active: dbItem.is_active,
              expiresAt: dbItem.expires_at ? new Date(dbItem.expires_at) : undefined
            };
          }),
          user: {
            ...state.user,
            ownedItems: ownedItemIds,
            activeBoosts: state.shopItems.reduce<ShopItem[]>((acc, item) => {
              const dbItem = inventoryByItemId.get(item.id);
              if (!dbItem || !dbItem.is_active) return acc;
              if (item.category !== 'booster' && item.category !== 'protection') return acc;

              acc.push({
                ...item,
                owned: true,
                active: true,
                expiresAt: dbItem.expires_at ? new Date(dbItem.expires_at) : undefined
              });
              return acc;
            }, []),
          },
        }));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  },

  syncUserStats: async () => {
    const state = get();
    const userId = state.authUser?.id;

    if (!userId || userId === 'guest') return;

    try {
      await gamificationAPI.updateUserStats(userId, {
        coin_earning_penalty: state.user.penalties.coinEarningPenalty,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error syncing user stats:', error);
    }
  }
});
