import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { UserSlice, createUserSlice } from './slices/userSlice';
import { QuestSlice, createQuestSlice } from './slices/questSlice';
import { SkillSlice, createSkillSlice } from './slices/skillSlice';
import { ShopItem, Achievement, Domain, DomainProgress } from '../types';
import { initializeShopItems } from './utils';

export type ProdigyState = AuthSlice & UserSlice & QuestSlice & SkillSlice & {
  shopItems: ShopItem[];
  achievements: Achievement[];
  initializeShop: () => void;
  getDomainProgress: (domain: Domain) => DomainProgress;
  unlockAchievement: (id: string, userId?: string) => void;
};

export const useProdigyStore = create<ProdigyState>()(
  persist(
    (set, get, api) => ({
      ...createAuthSlice(set, get, api),
      ...createUserSlice(set, get, api),
      ...createQuestSlice(set, get, api),
      ...createSkillSlice(set, get, api),
      
      shopItems: [],
      achievements: [],

      initializeShop: () => {
        const { shopItems } = get();
        if (shopItems.length === 0) {
          set({ shopItems: initializeShopItems() });
        }
      },

      getDomainProgress: (domain: Domain) => {
        const { skills, quests } = get();
        const domainSkills = skills.filter((skill) => skill.domain === domain);
        const domainQuests = quests.filter((quest) => quest.domain === domain);
        const completedQuests = domainQuests.filter((quest) => quest.completed).length;

        if (domainSkills.length === 0) {
          return {
            domain,
            level: 1,
            xp: 0,
            xpToNextLevel: 100,
            completedQuests,
            totalQuests: domainQuests.length,
            averageScore: 0
          };
        }

        const totalXp = domainSkills.reduce((sum, skill) => sum + skill.xp, 0);
        const averageLevel = Math.round(
          domainSkills.reduce((sum, skill) => sum + skill.level, 0) / domainSkills.length
        );
        const averageProgress = domainSkills.reduce((sum, skill) => {
          if (skill.xpToNextLevel <= 0) return sum;
          return sum + Math.min(100, (skill.xp / skill.xpToNextLevel) * 100);
        }, 0) / domainSkills.length;

        return {
          domain,
          level: Math.max(1, averageLevel),
          xp: totalXp,
          xpToNextLevel: domainSkills.reduce((sum, skill) => sum + skill.xpToNextLevel, 0),
          completedQuests,
          totalQuests: domainQuests.length,
          averageScore: Math.round(averageProgress)
        };
      },

      unlockAchievement: (id: string, userId?: string) => {
        set((state: ProdigyState) => ({
          achievements: state.achievements.map(a => 
            a.id === id && !a.dateUnlocked 
              ? { ...a, dateUnlocked: new Date() } 
              : a
          )
        }));
        if (userId) {
          // Sync logic placeholder
        }
      }
    }),
    {
      name: 'prodigy-protocol-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: ProdigyState) => ({
        user: state.user,
        skills: state.skills,
        quests: state.quests,
        shopItems: state.shopItems,
        achievements: state.achievements
      })
    }
  )
);
