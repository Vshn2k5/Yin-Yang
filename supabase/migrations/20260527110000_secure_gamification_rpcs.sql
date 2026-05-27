/*
  # Secure gamification RPCs

  The client calls these functions with the signed-in user's ID. Because the
  functions run as SECURITY DEFINER, they must verify that p_user_id matches
  auth.uid() before mutating rewards, stats, inventory, or streaks.
*/

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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  INSERT INTO user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_streaks (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

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
  FROM user_streaks
  WHERE user_id = p_user_id;

  SELECT COALESCE(coin_earning_penalty, 0) INTO v_coin_earning_penalty
  FROM user_stats
  WHERE user_id = p_user_id;

  v_multiplier := 1.0;
  IF v_streak_current >= 100 THEN
    v_multiplier := 1.5;
  ELSIF v_streak_current >= 30 THEN
    v_multiplier := 1.25;
  ELSIF v_streak_current >= 7 THEN
    v_multiplier := 1.1;
  END IF;

  v_penalty_multiplier := GREATEST(0, 1.0 - (v_coin_earning_penalty / 100.0));
  v_final_coins := FLOOR(p_coin_reward * v_multiplier * v_penalty_multiplier);

  INSERT INTO user_quests (user_id, quest_id, title, domain, status, xp_reward, coin_reward, completed_at)
  VALUES (p_user_id, p_quest_id, p_title, p_domain::domain_type, 'completed', p_xp_reward, v_final_coins, NOW())
  ON CONFLICT (user_id, quest_id) DO UPDATE
  SET status = 'completed',
      completed_at = NOW(),
      coin_reward = v_final_coins,
      updated_at = NOW();

  UPDATE user_stats
  SET coins = coins + v_final_coins,
      total_xp = total_xp + p_xp_reward,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE user_streaks
  SET current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_updated = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'coins_earned', v_final_coins,
    'xp_earned', p_xp_reward
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  INSERT INTO user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

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

  UPDATE user_stats
  SET coins = coins - p_price,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO user_inventory (user_id, item_id, item_name, item_type, is_active)
  VALUES (p_user_id, p_item_id, p_item_name, p_item_type, true);

  RETURN jsonb_build_object('success', true, 'remaining_coins', v_user_coins - p_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION process_streak_decay() RETURNS VOID AS $$
BEGIN
  UPDATE user_streaks
  SET current_streak = 0,
      last_updated = NOW(),
      updated_at = NOW()
  WHERE last_updated < (NOW() - INTERVAL '48 hours')
    AND (freeze_active = false OR freeze_expires_at < NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION complete_quest(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_quest(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION complete_quest(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION purchase_item(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION purchase_item(UUID, TEXT, TEXT, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION purchase_item(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION process_streak_decay() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION process_streak_decay() FROM anon;
REVOKE EXECUTE ON FUNCTION process_streak_decay() FROM authenticated;
GRANT EXECUTE ON FUNCTION process_streak_decay() TO service_role;
