-- User credits table
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Promo codes table
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER, -- NULL means unlimited
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track code redemptions
CREATE TABLE code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  credits_granted INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, promo_code_id) -- Each user can only redeem a code once
);

-- Credit transactions for history
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for credits added, negative for used
  type TEXT NOT NULL, -- 'promo_code', 'render', 'purchase', 'admin_grant'
  description TEXT,
  reference_id UUID, -- Can reference promo_code_id, render_job_id, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_credits_user ON user_credits(user_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_code_redemptions_user ON code_redemptions(user_id);
CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);

-- RLS policies
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all credits
CREATE POLICY "Service role can manage credits" ON user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- Anyone can view active promo codes (to validate before redeeming)
CREATE POLICY "Authenticated can view promo codes" ON promo_codes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage promo codes
CREATE POLICY "Service role can manage promo codes" ON promo_codes
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions" ON code_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage redemptions
CREATE POLICY "Service role can manage redemptions" ON code_redemptions
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage transactions
CREATE POLICY "Service role can manage transactions" ON credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Function to initialize credits for new user (3 free credits on signup)
CREATE OR REPLACE FUNCTION initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_credits (user_id, credits)
  VALUES (NEW.id, 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create credits on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_credits();







