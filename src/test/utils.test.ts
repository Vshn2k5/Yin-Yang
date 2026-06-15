import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateRankFromXp, calculateLevelFromXp, getStreakMultiplier, generateDailyQuests, generateDailyQuestsFromTemplates, buildDailyQuestId, initializeShopItems } from '../store/utils';
import type { QuestTemplate } from '../../types';

describe('store/utils', () => {
  describe('calculateRankFromXp', () => {
    it('should return E rank for XP less than 250', () => {
      expect(calculateRankFromXp(0)).toBe('E');
      expect(calculateRankFromXp(100)).toBe('E');
      expect(calculateRankFromXp(249)).toBe('E');
    });

    it('should return D rank for XP between 250 and 749', () => {
      expect(calculateRankFromXp(250)).toBe('D');
      expect(calculateRankFromXp(500)).toBe('D');
      expect(calculateRankFromXp(749)).toBe('D');
    });

    it('should return C rank for XP between 750 and 1499', () => {
      expect(calculateRankFromXp(750)).toBe('C');
      expect(calculateRankFromXp(1000)).toBe('C');
      expect(calculateRankFromXp(1499)).toBe('C');
    });

    it('should return B rank for XP between 1500 and 2999', () => {
      expect(calculateRankFromXp(1500)).toBe('B');
      expect(calculateRankFromXp(2000)).toBe('B');
      expect(calculateRankFromXp(2999)).toBe('B');
    });

    it('should return A rank for XP between 3000 and 4999', () => {
      expect(calculateRankFromXp(3000)).toBe('A');
      expect(calculateRankFromXp(4000)).toBe('A');
      expect(calculateRankFromXp(4999)).toBe('A');
    });

    it('should return S rank for XP between 5000 and 7499', () => {
      expect(calculateRankFromXp(5000)).toBe('S');
      expect(calculateRankFromXp(6000)).toBe('S');
      expect(calculateRankFromXp(7499)).toBe('S');
    });

    it('should return SS rank for XP between 7500 and 9999', () => {
      expect(calculateRankFromXp(7500)).toBe('SS');
      expect(calculateRankFromXp(8500)).toBe('SS');
      expect(calculateRankFromXp(9999)).toBe('SS');
    });

    it('should return SSS rank for XP 10000 or more', () => {
      expect(calculateRankFromXp(10000)).toBe('SSS');
      expect(calculateRankFromXp(15000)).toBe('SSS');
    });
  });

  describe('calculateLevelFromXp', () => {
    it('should return level 1 for XP 0-99', () => {
      expect(calculateLevelFromXp(0)).toBe(1);
      expect(calculateLevelFromXp(50)).toBe(1);
      expect(calculateLevelFromXp(99)).toBe(1);
    });

    it('should return level 2 for XP 100-199', () => {
      expect(calculateLevelFromXp(100)).toBe(2);
      expect(calculateLevelFromXp(150)).toBe(2);
      expect(calculateLevelFromXp(199)).toBe(2);
    });

    it('should return correct level for higher XP values', () => {
      expect(calculateLevelFromXp(500)).toBe(6);
      expect(calculateLevelFromXp(1000)).toBe(11);
      expect(calculateLevelFromXp(5000)).toBe(51);
    });
  });

  describe('getStreakMultiplier', () => {
    it('should return 1.0 for streak less than 7', () => {
      expect(getStreakMultiplier(0)).toBe(1.0);
      expect(getStreakMultiplier(1)).toBe(1.0);
      expect(getStreakMultiplier(6)).toBe(1.0);
    });

    it('should return 1.1 for streak between 7 and 29', () => {
      expect(getStreakMultiplier(7)).toBe(1.1);
      expect(getStreakMultiplier(15)).toBe(1.1);
      expect(getStreakMultiplier(29)).toBe(1.1);
    });

    it('should return 1.25 for streak between 30 and 99', () => {
      expect(getStreakMultiplier(30)).toBe(1.25);
      expect(getStreakMultiplier(50)).toBe(1.25);
      expect(getStreakMultiplier(99)).toBe(1.25);
    });

    it('should return 1.5 for streak 100 or more', () => {
      expect(getStreakMultiplier(100)).toBe(1.5);
      expect(getStreakMultiplier(200)).toBe(1.5);
    });
  });

  describe('buildDailyQuestId', () => {
    it('should build quest ID with current date by default', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedPrefix = `daily-${year}-${month}-${day}`;
      
      const result = buildDailyQuestId('test-quest');
      expect(result).toContain(expectedPrefix);
      expect(result).toBe(`${expectedPrefix}-test-quest`);
    });

    it('should build quest ID with custom date', () => {
      const customDate = new Date('2024-06-15');
      const result = buildDailyQuestId('workout', customDate);
      expect(result).toBe('daily-2024-06-15-workout');
    });
  });

  describe('generateDailyQuestsFromTemplates', () => {
    it('should generate quests from templates', () => {
      const templates: QuestTemplate[] = [
        {
          key: 'test-quest',
          title: 'Test Quest',
          description: 'A test quest',
          domain: 'Physical',
          difficulty: 'Easy',
          type: 'daily',
          completionCriteria: ['Complete the quest']
        }
      ];

      const result = generateDailyQuestsFromTemplates(templates, new Date('2024-06-15'));
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('daily-2024-06-15-test-quest');
      expect(result[0].title).toBe('Test Quest');
      expect(result[0].domain).toBe('Physical');
      expect(result[0].difficulty).toBe('Easy');
      expect(result[0].type).toBe('daily');
      expect(result[0].completed).toBe(false);
      expect(result[0].status).toBe('active');
    });

    it('should use template rewards if provided', () => {
      const templates: QuestTemplate[] = [
        {
          key: 'custom-rewards',
          title: 'Custom Rewards',
          description: 'Quest with custom rewards',
          domain: 'Mental',
          difficulty: 'Medium',
          type: 'daily',
          xpReward: 100,
          coinReward: 75,
          completionCriteria: ['Complete it']
        }
      ];

      const result = generateDailyQuestsFromTemplates(templates);
      
      expect(result[0].xpReward).toBe(100);
      expect(result[0].coinReward).toBe(75);
    });

    it('should use default rewards when not provided', () => {
      const templates: QuestTemplate[] = [
        {
          key: 'default-rewards',
          title: 'Default Rewards',
          description: 'Quest with default rewards',
          domain: 'Technical',
          difficulty: 'Hard',
          type: 'daily',
          completionCriteria: ['Do it']
        }
      ];

      const result = generateDailyQuestsFromTemplates(templates);
      
      // Hard difficulty defaults: xp: 75, coins: 60
      expect(result[0].xpReward).toBe(75);
      expect(result[0].coinReward).toBe(60);
    });

    it('should filter out non-daily templates', () => {
      const templates: QuestTemplate[] = [
        {
          key: 'daily-quest',
          title: 'Daily',
          description: 'Daily quest',
          domain: 'Physical',
          difficulty: 'Easy',
          type: 'daily',
          completionCriteria: ['Do it']
        },
        {
          key: 'weekly-quest',
          title: 'Weekly',
          description: 'Weekly quest',
          domain: 'Mental',
          difficulty: 'Medium',
          type: 'weekly',
          completionCriteria: ['Do it']
        }
      ] as QuestTemplate[];

      const result = generateDailyQuestsFromTemplates(templates);
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Daily');
    });
  });

  describe('generateDailyQuests', () => {
    it('should generate 4 default daily quests', () => {
      const result = generateDailyQuests(new Date('2024-06-15'));
      
      expect(result).toHaveLength(4);
      expect(result.map(q => q.type)).toEqual(['daily', 'daily', 'daily', 'daily']);
    });

    it('should include quests for all domains', () => {
      const result = generateDailyQuests();
      const domains = result.map(q => q.domain);
      
      expect(domains).toContain('Physical');
      expect(domains).toContain('Mental');
      expect(domains).toContain('Technical');
      expect(domains).toContain('Creative');
    });

    it('should have appropriate difficulties', () => {
      const result = generateDailyQuests();
      
      const easyQuest = result.find(q => q.difficulty === 'Easy');
      const mediumQuests = result.filter(q => q.difficulty === 'Medium');
      const hardQuest = result.find(q => q.difficulty === 'Hard');
      
      expect(easyQuest).toBeDefined();
      expect(mediumQuests).toHaveLength(2);
      expect(hardQuest).toBeDefined();
    });
  });

  describe('initializeShopItems', () => {
    it('should return shop items array', () => {
      const result = initializeShopItems();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include items from all categories', () => {
      const result = initializeShopItems();
      const categories = result.map(item => item.category);
      
      expect(categories).toContain('protection');
      expect(categories).toContain('booster');
      expect(categories).toContain('cosmetic');
    });

    it('should have unique IDs for all items', () => {
      const result = initializeShopItems();
      const ids = result.map(item => item.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid effect structures', () => {
      const result = initializeShopItems();
      
      result.forEach(item => {
        expect(item.effect).toBeDefined();
        expect(item.effect.type).toBeDefined();
        expect(item.effect.value).toBeDefined();
      });
    });
  });
});
