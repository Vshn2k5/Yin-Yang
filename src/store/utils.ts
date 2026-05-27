import { Rank, Quest, QuestTemplate, ShopItem } from '../types';

export const calculateRankFromXp = (xp: number): Rank => {
  if (xp >= 10000) return 'SSS';
  if (xp >= 7500) return 'SS';
  if (xp >= 5000) return 'S';
  if (xp >= 3000) return 'A';
  if (xp >= 1500) return 'B';
  if (xp >= 750) return 'C';
  if (xp >= 250) return 'D';
  return 'E';
};

export const calculateLevelFromXp = (xp: number): number => {
  return Math.floor(xp / 100) + 1;
};

export const getStreakMultiplier = (streak: number): number => {
  if (streak >= 100) return 1.5;
  if (streak >= 30) return 1.25;
  if (streak >= 7) return 1.1;
  return 1.0;
};

const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDailyResetTime = (date: Date): Date => {
  const resetAt = new Date(date);
  resetAt.setHours(24, 0, 0, 0);
  return resetAt;
};

const getRewardsByDifficulty = (difficulty: Quest['difficulty']): { xp: number; coins: number } => {
  if (difficulty === 'Easy') return { xp: 25, coins: 15 };
  if (difficulty === 'Medium') return { xp: 50, coins: 35 };
  return { xp: 75, coins: 60 };
};

export const buildDailyQuestId = (templateKey: string, date: Date = new Date()): string => {
  return `daily-${getLocalDateKey(date)}-${templateKey}`;
};

export const generateDailyQuestsFromTemplates = (
  templates: QuestTemplate[],
  date: Date = new Date()
): Quest[] => {
  const resetAt = getDailyResetTime(date);

  return templates
    .filter((template) => template.type === 'daily')
    .map((template) => {
      const fallbackRewards = getRewardsByDifficulty(template.difficulty);
      return {
        id: buildDailyQuestId(template.key, date),
        title: template.title,
        description: template.description,
        domain: template.domain,
        difficulty: template.difficulty,
        type: template.type,
        xpReward: template.xpReward ?? fallbackRewards.xp,
        coinReward: template.coinReward ?? fallbackRewards.coins,
        completed: false,
        status: 'active' as const,
        deadline: resetAt,
        createdAt: new Date(date),
        completionCriteria: template.completionCriteria
      };
    });
};

export const generateDailyQuests = (date: Date = new Date()): Quest[] => {
  const questTemplates: QuestTemplate[] = [
    {
      key: 'morning-workout',
      title: 'Morning Workout',
      description: 'Complete a 30-minute exercise session',
      domain: 'Physical',
      difficulty: 'Medium' as const,
      type: 'daily',
      completionCriteria: ['Warm up for 5 minutes', 'Complete main workout', 'Cool down and stretch']
    },
    {
      key: 'learn-something-new',
      title: 'Learn Something New',
      description: 'Spend 1 hour learning a new skill or concept',
      domain: 'Mental',
      difficulty: 'Easy' as const,
      type: 'daily',
      completionCriteria: ['Choose learning material', 'Study for 60 minutes', 'Take notes or practice']
    },
    {
      key: 'code-review',
      title: 'Code Review',
      description: 'Review and improve existing code or learn new programming concepts',
      domain: 'Technical',
      difficulty: 'Hard' as const,
      type: 'daily',
      completionCriteria: ['Identify code to review', 'Analyze and document improvements', 'Implement changes']
    },
    {
      key: 'creative-expression',
      title: 'Creative Expression',
      description: 'Spend time on a creative project or artistic endeavor',
      domain: 'Creative',
      difficulty: 'Medium' as const,
      type: 'daily',
      completionCriteria: ['Set up workspace', 'Work on project for 45 minutes', 'Document progress']
    }
  ];

  return generateDailyQuestsFromTemplates(questTemplates, date);
};

export const initializeShopItems = (): ShopItem[] => [
  // Streak Protection
  {
    id: 'streak-freeze-1',
    name: 'Streak Freezer (1 Day)',
    description: 'Protects your streak for 1 day if you miss your quests',
    category: 'protection',
    price: 500,
    effect: { type: 'streak_freeze', value: 1 }
  },
  {
    id: 'streak-freeze-7',
    name: 'Streak Freezer (7 Days)',
    description: 'Protects your streak for 7 days if you miss your quests',
    category: 'protection',
    price: 2000,
    effect: { type: 'streak_freeze', value: 7 }
  },
  
  // XP Boosters
  {
    id: 'xp-boost-1h',
    name: '2x XP Booster (1 Hour)',
    description: 'Double XP gains for 1 hour',
    category: 'booster',
    price: 300,
    effect: { type: 'xp_multiplier', value: 2, duration: 1 }
  },
  {
    id: 'xp-boost-24h',
    name: '2x XP Booster (24 Hours)',
    description: 'Double XP gains for 24 hours',
    category: 'booster',
    price: 1500,
    effect: { type: 'xp_multiplier', value: 2, duration: 24 }
  },
  
  // Coin Multipliers
  {
    id: 'coin-boost-1h',
    name: '1.5x Coin Multiplier (1 Hour)',
    description: 'Increase coin earnings by 50% for 1 hour',
    category: 'booster',
    price: 400,
    effect: { type: 'coin_multiplier', value: 1.5, duration: 1 }
  },
  {
    id: 'coin-boost-24h',
    name: '1.5x Coin Multiplier (24 Hours)',
    description: 'Increase coin earnings by 50% for 24 hours',
    category: 'booster',
    price: 2000,
    effect: { type: 'coin_multiplier', value: 1.5, duration: 24 }
  },
  
  // Badges
  {
    id: 'bronze-badge',
    name: 'Bronze Achievement Badge',
    description: 'Show off your dedication with a bronze badge',
    category: 'cosmetic',
    price: 1000,
    effect: { type: 'badge', value: 1 }
  },
  {
    id: 'silver-badge',
    name: 'Silver Achievement Badge',
    description: 'Display your commitment with a silver badge',
    category: 'cosmetic',
    price: 3000,
    effect: { type: 'badge', value: 2 }
  },
  
  // Profile Frames
  {
    id: 'basic-frame',
    name: 'Animated Profile Frame',
    description: 'Add a subtle glow to your profile',
    category: 'cosmetic',
    price: 800,
    effect: { type: 'frame', value: 1 }
  },
  {
    id: 'premium-frame',
    name: 'Premium Animated Frame',
    description: 'Stand out with a premium animated frame',
    category: 'cosmetic',
    price: 2500,
    effect: { type: 'frame', value: 2 }
  }
];
