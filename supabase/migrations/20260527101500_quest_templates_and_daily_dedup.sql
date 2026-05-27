/*
  # Quest Templates Catalog + Daily Duplicate Guard

  1. New Table
    - `quest_templates` stores canonical quest metadata for server-authoritative generation.
    - Includes domain, difficulty, quest type, rewards, and completion criteria.

  2. Security
    - RLS enabled.
    - Authenticated users can read active templates.

  3. Data
    - Seeds default daily quest templates.

  4. Logic Hardening
    - Updates `complete_quest` RPC to prevent duplicate daily rewards
      within 24 hours even if quest ID format changes.
*/

CREATE TABLE IF NOT EXISTS quest_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  domain domain_type NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  quest_type text NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'monthly', 'chain')),
  base_xp_reward integer NOT NULL DEFAULT 0,
  base_coin_reward integer NOT NULL DEFAULT 0,
  completion_criteria text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quest_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quest_templates'
      AND policyname = 'Authenticated users can read quest templates'
  ) THEN
    CREATE POLICY "Authenticated users can read quest templates"
      ON quest_templates
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_quest_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_quest_templates_updated_at
      BEFORE UPDATE ON quest_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_gamification_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quest_templates_type_active_sort
  ON quest_templates (quest_type, is_active, sort_order);

INSERT INTO quest_templates (
  template_key,
  title,
  description,
  domain,
  difficulty,
  quest_type,
  base_xp_reward,
  base_coin_reward,
  completion_criteria,
  is_active,
  sort_order
)
VALUES
  (
    'morning-workout',
    'Morning Workout',
    'Complete a 30-minute exercise session',
    'Physical',
    'Medium',
    'daily',
    50,
    35,
    ARRAY['Warm up for 5 minutes', 'Complete main workout', 'Cool down and stretch'],
    true,
    10
  ),
  (
    'learn-something-new',
    'Learn Something New',
    'Spend 1 hour learning a new skill or concept',
    'Mental',
    'Easy',
    'daily',
    25,
    15,
    ARRAY['Choose learning material', 'Study for 60 minutes', 'Take notes or practice'],
    true,
    20
  ),
  (
    'code-review',
    'Code Review',
    'Review and improve existing code or learn new programming concepts',
    'Technical',
    'Hard',
    'daily',
    75,
    60,
    ARRAY['Identify code to review', 'Analyze and document improvements', 'Implement changes'],
    true,
    30
  ),
  (
    'creative-expression',
    'Creative Expression',
    'Spend time on a creative project or artistic endeavor',
    'Creative',
    'Medium',
    'daily',
    50,
    35,
    ARRAY['Set up workspace', 'Work on project for 45 minutes', 'Document progress'],
    true,
    40
  )
ON CONFLICT (template_key) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  domain = EXCLUDED.domain,
  difficulty = EXCLUDED.difficulty,
  quest_type = EXCLUDED.quest_type,
  base_xp_reward = EXCLUDED.base_xp_reward,
  base_coin_reward = EXCLUDED.base_coin_reward,
  completion_criteria = EXCLUDED.completion_criteria,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Harden daily duplicate detection in case daily quest IDs evolve.
CREATE OR REPLACE FUNCTION complete_quest(
  p_user_id UUID,
  p_quest_id TEXT,
  p_title TEXT,
  p_domain TEXT,
  p_xp_reward INTEGER,
  p_coin_reward INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_streak_current INTEGER;
  v_multiplier NUMERIC;
  v_penalty_multiplier NUMERIC;
  v_coin_earning_penalty INTEGER;
  v_final_coins INTEGER;
BEGIN
  -- Prevent duplicate completion and reward issuance:
  -- 1) exact quest_id match (always)
  -- 2) same daily title+domain within 24h (guards legacy/new daily ID formats)
  IF EXISTS (
    SELECT 1
    FROM user_quests
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND completed_at > (NOW() - INTERVAL '1 day')
      AND (
        quest_id = p_quest_id
        OR (
          p_quest_id LIKE 'daily-%'
          AND quest_id LIKE 'daily-%'
          AND title = p_title
          AND domain = p_domain::domain_type
        )
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quest already completed');
  END IF;

  SELECT COALESCE(current_streak, 0) INTO v_streak_current
  FROM user_streaks WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    v_streak_current := 0;
  END IF;

  SELECT COALESCE(coin_earning_penalty, 0) INTO v_coin_earning_penalty
  FROM user_stats WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    v_coin_earning_penalty := 0;
  END IF;

  v_multiplier := 1.0;
  IF v_streak_current >= 100 THEN v_multiplier := 1.5;
  ELSIF v_streak_current >= 30 THEN v_multiplier := 1.25;
  ELSIF v_streak_current >= 7 THEN v_multiplier := 1.1;
  END IF;

  v_penalty_multiplier := 1.0 - (v_coin_earning_penalty / 100.0);
  v_final_coins := FLOOR(p_coin_reward * v_multiplier * v_penalty_multiplier);

  INSERT INTO user_quests (user_id, quest_id, title, domain, status, xp_reward, coin_reward, completed_at)
  VALUES (p_user_id, p_quest_id, p_title, p_domain::domain_type, 'completed', p_xp_reward, v_final_coins, NOW())
  ON CONFLICT (user_id, quest_id) DO UPDATE
  SET status = 'completed', completed_at = NOW(), coin_reward = v_final_coins;

  UPDATE user_stats
  SET coins = coins + v_final_coins,
      total_xp = total_xp + p_xp_reward,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE user_streaks
  SET current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_updated = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'coins_earned', v_final_coins,
    'xp_earned', p_xp_reward
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
