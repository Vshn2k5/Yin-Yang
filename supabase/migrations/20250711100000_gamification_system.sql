/*
  # Gamification System Schema

  1. New Tables
    - `user_stats` - Core user progress (XP, Coins, Level, Rank)
    - `user_skills` - Domain-specific progress tracking
    - `user_quests` - Tracking quest status and history
    - `user_inventory` - Managing owned items and active boosts
    - `user_streaks` - Consistent activity tracking
    - `user_achievements` - Milestone awards

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own data

  3. Features
    - Automatic updated_at timestamps
    - Triggers for level-up logic
*/

-- Create Enums if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quest_status') THEN
    CREATE TYPE quest_status AS ENUM ('active', 'completed', 'failed', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'domain_type') THEN
    CREATE TYPE domain_type AS ENUM ('Physical', 'Mental', 'Technical', 'Creative');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rank_type') THEN
    CREATE TYPE rank_type AS ENUM ('E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS');
  END IF;
END $$;

-- User Stats Table
CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  title text DEFAULT 'Novice Explorer',
  rank rank_type DEFAULT 'E',
  level integer DEFAULT 1,
  total_xp integer DEFAULT 0,
  coins integer DEFAULT 1000,
  coin_earning_penalty integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Skills Table
CREATE TABLE IF NOT EXISTS user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain domain_type NOT NULL,
  level integer DEFAULT 1,
  xp integer DEFAULT 0,
  xp_to_next_level integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- User Quests Table
CREATE TABLE IF NOT EXISTS user_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  title text NOT NULL,
  domain domain_type NOT NULL,
  status quest_status DEFAULT 'active',
  xp_reward integer NOT NULL,
  coin_reward integer NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quest_id)
);

-- User Inventory Table
CREATE TABLE IF NOT EXISTS user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  item_name text NOT NULL,
  item_type text NOT NULL,
  is_active boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Streaks Table
CREATE TABLE IF NOT EXISTS user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  freeze_active boolean DEFAULT false,
  freeze_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User Achievements Table
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  title text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own stats" ON user_stats FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own skills" ON user_skills FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own quests" ON user_quests FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own inventory" ON user_inventory FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own streaks" ON user_streaks FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own achievements" ON user_achievements FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Functions & Triggers
CREATE OR REPLACE FUNCTION update_gamification_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();
CREATE TRIGGER update_user_skills_updated_at BEFORE UPDATE ON user_skills FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();
CREATE TRIGGER update_user_quests_updated_at BEFORE UPDATE ON user_quests FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();
CREATE TRIGGER update_user_inventory_updated_at BEFORE UPDATE ON user_inventory FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();
CREATE TRIGGER update_user_streaks_updated_at BEFORE UPDATE ON user_streaks FOR EACH ROW EXECUTE FUNCTION update_gamification_updated_at();

-- Trigger function to automatically create user_stats and user_streaks on signup
CREATE OR REPLACE FUNCTION handle_new_user_gamification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_stats (user_id) VALUES (NEW.id);
  INSERT INTO user_streaks (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created_gamification
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_gamification();

-- Level logic trigger
CREATE OR REPLACE FUNCTION calculate_level_and_rank()
RETURNS trigger AS $$
DECLARE
  new_level integer;
  new_rank rank_type;
BEGIN
  new_level := floor(NEW.total_xp / 100) + 1;
  
  IF NEW.total_xp >= 10000 THEN new_rank := 'SSS';
  ELSIF NEW.total_xp >= 7500 THEN new_rank := 'SS';
  ELSIF NEW.total_xp >= 5000 THEN new_rank := 'S';
  ELSIF NEW.total_xp >= 3000 THEN new_rank := 'A';
  ELSIF NEW.total_xp >= 1500 THEN new_rank := 'B';
  ELSIF NEW.total_xp >= 750 THEN new_rank := 'C';
  ELSIF NEW.total_xp >= 250 THEN new_rank := 'D';
  ELSE new_rank := 'E';
  END IF;

  NEW.level := new_level;
  NEW.rank := new_rank;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_user_stats_update_level_rank
  BEFORE UPDATE OF total_xp ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION calculate_level_and_rank();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_domain ON user_skills(domain);
CREATE INDEX IF NOT EXISTS idx_user_quests_user_id ON user_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_status ON user_quests(status);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
