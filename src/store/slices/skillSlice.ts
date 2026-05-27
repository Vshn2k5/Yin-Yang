import { StateCreator } from 'zustand';
import { Domain, Skill, Rank } from '../../types';
import { gamificationAPI } from '../../services/gamification';
import { ProdigyState } from '../index';

export interface SkillSlice {
  skills: Skill[];
  domainRanks: Record<Domain, Rank>;
  addSkill: (skill: Skill) => Promise<void>;
  updateSkill: (id: string, updates: Partial<Skill>) => Promise<void>;
  addXp: (skillId: string, amount: number, userId?: string) => Promise<void>;
  calculateRank: (domain: Domain) => Rank;
  fetchSkills: (userId: string) => Promise<void>;
  setSkills: (skills: Skill[]) => void;
}

export const createSkillSlice: StateCreator<ProdigyState, [], [], SkillSlice> = (set, get) => ({
  skills: [],
  domainRanks: {
    Physical: 'E',
    Mental: 'E',
    Technical: 'E',
    Creative: 'E',
  },

  setSkills: (skills: Skill[]) => set({ skills }),

  addSkill: async (skill: Skill) => {
    set((state: ProdigyState) => ({
      skills: [...state.skills, skill]
    }));

    const resolvedUserId = get().authUser?.id;
    if (resolvedUserId && resolvedUserId !== 'guest') {
      try {
        await gamificationAPI.upsertUserSkill(resolvedUserId, skill);
      } catch (error) {
        console.error('Error syncing new skill:', error);
      }
    }
  },

  updateSkill: async (id: string, updates: Partial<Skill>) => {
    set((state: ProdigyState) => ({
      skills: state.skills.map(skill => 
        skill.id === id ? { ...skill, ...updates } : skill
      )
    }));
  },

  addXp: async (skillId: string, amount: number, userId?: string) => {
    const { skills, updateSkill } = get();
    const skill = skills.find((s: Skill) => s.id === skillId);
    
    if (!skill) return;
    
    const newXp = skill.xp + amount;
    const levelUps = Math.floor(newXp / skill.xpToNextLevel);
    const remainingXp = newXp % skill.xpToNextLevel;
    const newLevel = skill.level + levelUps;
    const newXpToNextLevel = skill.xpToNextLevel * (levelUps > 0 ? 1.5 : 1);
    
    await updateSkill(skillId, {
      xp: remainingXp,
      level: newLevel,
      xpToNextLevel: newXpToNextLevel,
    });

    const resolvedUserId = userId ?? get().authUser?.id;
    if (resolvedUserId && resolvedUserId !== 'guest') {
      try {
        await gamificationAPI.upsertUserSkill(resolvedUserId, {
          id: skillId,
          name: skill.name,
          domain: skill.domain,
          level: newLevel,
          xp: remainingXp,
          xpToNextLevel: newXpToNextLevel
        });
      } catch (error) {
        console.error('Error syncing skill XP:', error);
      }
    }

    // Refresh domain ranks
    const domain = skill.domain;
    const domainRank = get().calculateRank(domain);

    set((state: ProdigyState) => ({
      domainRanks: {
        ...state.domainRanks,
        [domain]: domainRank
      }
    }));
  },

  calculateRank: (domain: Domain) => {
    const { skills } = get();
    const domainSkills = skills.filter((s: Skill) => s.domain === domain);
    const domainXpTotal = domainSkills.reduce((sum: number, s: Skill) => sum + s.xp, 0);
    
    if (domainXpTotal >= 10000) return 'SSS';
    if (domainXpTotal >= 7500) return 'SS';
    if (domainXpTotal >= 5000) return 'S';
    if (domainXpTotal >= 3000) return 'A';
    if (domainXpTotal >= 1500) return 'B';
    if (domainXpTotal >= 750) return 'C';
    if (domainXpTotal >= 250) return 'D';
    return 'E';
  },

  fetchSkills: async (userId: string) => {
    try {
      const dbSkills = await gamificationAPI.getUserSkills(userId);
      if (dbSkills) {
        const skills: Skill[] = dbSkills.map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain as Domain,
          level: s.level,
          xp: s.xp,
          xpToNextLevel: s.xp_to_next_level
        }));
        set({ skills });

        // Recalculate all domain ranks
        const domains: Domain[] = ['Physical', 'Mental', 'Technical', 'Creative'];
        const domainRanks: Record<Domain, Rank> = { ...get().domainRanks };
        domains.forEach(d => {
          domainRanks[d] = get().calculateRank(d);
        });
        set({ domainRanks });
      }
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  }
});
