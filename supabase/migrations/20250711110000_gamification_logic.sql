-- Stored Procedure for Completing a Quest Safely
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
  -- 1. Check if quest already completed today (prevent double-submit)
  IF EXISTS (
    SELECT 1 FROM user_quests 
    WHERE user_id = p_user_id 
    AND quest_id = p_quest_id 
    AND status = 'completed'
    AND completed_at > (NOW() - INTERVAL '1 day')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quest already completed');
  END IF;

  -- 2. Get User Streak (with null guard)
  SELECT COALESCE(current_streak, 0) INTO v_streak_current 
  FROM user_streaks WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    v_streak_current := 0;
  END IF;

  -- 3. Get Penalty Info from user_stats (coin_earning_penalty column)
  SELECT COALESCE(coin_earning_penalty, 0) INTO v_coin_earning_penalty 
  FROM user_stats WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    v_coin_earning_penalty := 0;
  END IF;

  -- 4. Calculate Multipliers (Mirroring src/store/utils.ts)
  v_multiplier := 1.0;
  IF v_streak_current >= 100 THEN v_multiplier := 1.5;
  ELSIF v_streak_current >= 30 THEN v_multiplier := 1.25;
  ELSIF v_streak_current >= 7 THEN v_multiplier := 1.1;
  END IF;

  v_penalty_multiplier := 1.0 - (v_coin_earning_penalty / 100.0);
  
  -- 5. Calculate Final Rewards
  v_final_coins := FLOOR(p_coin_reward * v_multiplier * v_penalty_multiplier);

  -- 6. Atomic Update: User Quests
  INSERT INTO user_quests (user_id, quest_id, title, domain, status, xp_reward, coin_reward, completed_at)
  VALUES (p_user_id, p_quest_id, p_title, p_domain::domain_type, 'completed', p_xp_reward, v_final_coins, NOW())
  ON CONFLICT (user_id, quest_id) DO UPDATE 
  SET status = 'completed', completed_at = NOW(), coin_reward = v_final_coins;

  -- 7. Atomic Update: User Stats (XP trigger will handle levels/ranks)
  UPDATE user_stats 
  SET coins = coins + v_final_coins,
      total_xp = total_xp + p_xp_reward,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 8. Update User Streak
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

-- Stored Procedure for Purchasing an Item Safely
CREATE OR REPLACE FUNCTION purchase_item(
  p_user_id UUID,
  p_item_id TEXT,
  p_item_name TEXT,
  p_item_type TEXT,
  p_price INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_user_coins INTEGER;
BEGIN
  -- 1. Check User Balance (with row lock to prevent race conditions)
  SELECT coins INTO v_user_coins 
  FROM user_stats 
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF v_user_coins < p_price THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;

  -- 2. Deduct Coins
  UPDATE user_stats 
  SET coins = coins - p_price,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 3. Add to Inventory
  INSERT INTO user_inventory (user_id, item_id, item_name, item_type, is_active)
  VALUES (p_user_id, p_item_id, p_item_name, p_item_type, true);

  RETURN jsonb_build_object('success', true, 'remaining_coins', v_user_coins - p_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Background Worker Simulation: Streak Decay (Call this via pg_cron or Edge Function Scheduler)
CREATE OR REPLACE FUNCTION process_streak_decay() RETURNS VOID AS $$
BEGIN
  -- Reset streaks for users who haven't completed a quest in > 48 hours
  -- Unless they have an active freeze
  UPDATE user_streaks
  SET current_streak = 0,
      last_updated = NOW()
  WHERE last_updated < (NOW() - INTERVAL '48 hours')
  AND (freeze_active = false OR freeze_expires_at < NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
