-- ============================================================
-- J-STORE: Policies and Legal Agreements
-- Migration: 20260920_policies_and_agreements
-- ============================================================

-- Policy types for the platform
DO $$ BEGIN
  CREATE TYPE policy_type AS ENUM (
    'terms_and_conditions',
    'privacy_policy',
    'seller_agreement',
    'marketplace_rules',
    'cod_policy',
    'return_policy',
    'shipping_policy'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies table - stores legal documents and agreements
CREATE TABLE IF NOT EXISTS policies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type           policy_type NOT NULL UNIQUE,
  title          text NOT NULL,
  content        text NOT NULL,
  version        text NOT NULL DEFAULT '1.0',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- User policy acceptances - track when users accept policies
CREATE TABLE IF NOT EXISTS policy_acceptances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_type    policy_type NOT NULL,
  policy_version text NOT NULL,
  accepted_at    timestamptz NOT NULL DEFAULT now(),
  ip_address     text,
  user_agent     text,
  UNIQUE(user_id, policy_type, policy_version)
);

CREATE INDEX IF NOT EXISTS policy_acceptances_user_idx ON policy_acceptances(user_id);
CREATE INDEX IF NOT EXISTS policy_acceptances_type_idx ON policy_acceptances(policy_type);

-- ── RLS Policies ──────────────────────────────────────────────

-- Policies: Public can read, only super_admin can manage
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view policies" ON policies;
CREATE POLICY "Public can view policies" ON policies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admins manage policies" ON policies;
CREATE POLICY "Super admins manage policies" ON policies
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Policy acceptances: Users can read their own, insert their own
ALTER TABLE policy_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own acceptances" ON policy_acceptances;
CREATE POLICY "Users can view own acceptances" ON policy_acceptances
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can record acceptances" ON policy_acceptances;
CREATE POLICY "Users can record acceptances" ON policy_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all acceptances" ON policy_acceptances;
CREATE POLICY "Admins view all acceptances" ON policy_acceptances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ── Initial Policy Content ────────────────────────────────────

-- Insert default policies if they don't exist
INSERT INTO policies (type, title, content, version, effective_date)
VALUES 
  (
    'terms_and_conditions',
    'Terms and Conditions',
    E'# Terms and Conditions for J-STORE\n\n**Effective Date:** ' || CURRENT_DATE || E'\n\n## 1. Acceptance of Terms\n\nBy accessing and using J-STORE.cm ("the Platform"), you accept and agree to be bound by these Terms and Conditions.\n\n## 2. Use of Service\n\nYou agree to use the Platform only for lawful purposes and in accordance with these Terms.\n\n## 3. Account Registration\n\n- You must provide accurate information\n- You are responsible for maintaining account security\n- You must be at least 18 years old to create an account\n\n## 4. User Conduct\n\nYou agree not to:\n- Violate any laws or regulations\n- Infringe on intellectual property rights\n- Post false, misleading, or fraudulent content\n- Interfere with the Platform\'s operation\n\n## 5. Limitation of Liability\n\nJ-STORE is a marketplace platform connecting buyers and sellers. We are not responsible for the quality, safety, or legality of products listed by sellers.\n\n## 6. Modifications\n\nWe reserve the right to modify these Terms at any time. Continued use constitutes acceptance of modified terms.\n\n## 7. Contact\n\nFor questions about these Terms, contact us at support@j-store.cm',
    '1.0',
    CURRENT_DATE
  ),
  (
    'privacy_policy',
    'Privacy Policy',
    E'# Privacy Policy for J-STORE\n\n**Effective Date:** ' || CURRENT_DATE || E'\n\n## 1. Information We Collect\n\n### Personal Information\n- Name, email address, phone number\n- Delivery address\n- Payment information (processed securely)\n\n### Usage Information\n- Browsing behavior on our Platform\n- Device information and IP address\n- Cookies and similar technologies\n\n## 2. How We Use Your Information\n\n- Process and fulfill orders\n- Communicate about products and services\n- Improve our Platform and user experience\n- Prevent fraud and ensure security\n\n## 3. Information Sharing\n\nWe share your information with:\n- Sellers (to fulfill orders)\n- Delivery partners (to ship orders)\n- Payment processors (to process transactions)\n- Legal authorities (when required by law)\n\n## 4. Data Security\n\nWe implement appropriate security measures to protect your personal information from unauthorized access, alteration, or disclosure.\n\n## 5. Your Rights\n\nYou have the right to:\n- Access your personal data\n- Correct inaccurate data\n- Request deletion of your data\n- Opt-out of marketing communications\n\n## 6. Contact Us\n\nFor privacy concerns, email privacy@j-store.cm',
    '1.0',
    CURRENT_DATE
  ),
  (
    'seller_agreement',
    'Seller Agreement',
    E'# J-STORE Seller Agreement\n\n**Effective Date:** ' || CURRENT_DATE || E'\n\n## 1. Seller Responsibilities\n\n### Product Listings\n- Provide accurate product descriptions\n- Use clear, authentic product images\n- Set fair and transparent pricing\n- Maintain adequate inventory\n\n### Order Fulfillment\n- Process orders within 24 hours\n- Pack products securely\n- Ship within promised timeframes\n- Provide tracking information\n\n### Customer Service\n- Respond to customer inquiries within 24 hours\n- Handle returns and refunds fairly\n- Resolve disputes professionally\n\n## 2. Prohibited Items\n\nSellers may not list:\n- Illegal or counterfeit goods\n- Weapons or dangerous materials\n- Stolen property\n- Items violating intellectual property rights\n\n## 3. Fees and Payments\n\n- Platform commission: [To be defined]\n- Payment processing fees apply\n- Payouts processed within [X] business days\n- Minimum withdrawal amount: 10,000 FCFA\n\n## 4. Seller Conduct\n\nSellers agree to:\n- Comply with all applicable laws\n- Not manipulate reviews or ratings\n- Not contact buyers outside the Platform\n- Maintain professional communication\n\n## 5. Account Suspension\n\nWe reserve the right to suspend or terminate seller accounts for:\n- Violation of this Agreement\n- Fraudulent activity\n- Poor seller performance metrics\n- Customer complaints\n\n## 6. Product Approval\n\nAll products are subject to admin approval before appearing on the marketplace.\n\n## 7. Contact\n\nSeller support: sellers@j-store.cm',
    '1.0',
    CURRENT_DATE
  ),
  (
    'marketplace_rules',
    'Marketplace Rules',
    E'# J-STORE Marketplace Rules\n\n**Effective Date:** ' || CURRENT_DATE || E'\n\n## For Buyers\n\n### 1. Account Usage\n- One account per person\n- No sharing of login credentials\n- Accurate information required\n\n### 2. Ordering\n- Review product details before purchasing\n- Provide correct delivery information\n- Be available for delivery attempts\n\n### 3. Payments\n- Valid payment method required\n- No fraudulent transactions\n- Report unauthorized charges immediately\n\n### 4. Reviews\n- Reviews must be honest and based on actual experience\n- No abusive or offensive language\n- No fake or incentivized reviews\n\n## For Sellers\n\n### 1. Product Listings\n- Accurate descriptions and images required\n- No misleading information\n- Competitive and fair pricing\n\n### 2. Order Management\n- Process orders promptly\n- Communicate delays proactively\n- Provide tracking information\n\n### 3. Quality Standards\n- Products must match descriptions\n- Items must be new unless stated otherwise\n- Secure packaging required\n\n### 4. Communication\n- Professional tone required\n- Respond to messages within 24 hours\n- No harassment or threats\n\n## Prohibited Activities\n\n- Price manipulation\n- Review manipulation\n- Selling counterfeit items\n- Fraudulent transactions\n- Harassment of users\n- Spam or unsolicited marketing\n\n## Enforcement\n\nViolations may result in:\n- Warning\n- Temporary suspension\n- Permanent ban\n- Legal action if applicable',
    '1.0',
    CURRENT_DATE
  ),
  (
    'cod_policy',
    'Cash on Delivery (COD) Policy',
    E'# Cash on Delivery (COD) Policy\n\n**Effective Date:** ' || CURRENT_DATE || E'\n\n## Availability\n\nCash on Delivery is available for orders shipped within:\n- Douala\n- Yaoundé\n- Bafoussam\n- Bamenda\n- Other major cities (subject to verification)\n\n## How COD Works\n\n### 1. Place Order\n- Select "Cash on Delivery" at checkout\n- Confirm your delivery address and phone number\n- Review order total (product + delivery fee)\n\n### 2. Delivery\n- Delivery partner will contact you before arrival\n- Be available at the provided address\n- Inspect the package before payment\n\n### 3. Payment\n- Pay the exact amount to the delivery partner\n- Get a receipt for your payment\n- Keep packaging for returns if needed\n\n## Order Limits\n\n- Maximum COD order value: 500,000 FCFA\n- First-time buyers: Maximum 100,000 FCFA\n- Verified accounts: Higher limits available\n\n## Important Notes\n\n### Inspection Rights\n- You may inspect the outer packaging\n- You may verify product quantity\n- Full product inspection allowed for electronics\n- Opened packages cannot be refused without valid reason\n\n### Delivery Fees\n- COD orders include delivery fee in total\n- Fees vary by location and order value\n- Free delivery on orders above 50,000 FCFA\n\n### Failed Deliveries\n\nIf you\'re not available:\n- Delivery partner will attempt contact\n- Second delivery attempt may incur extra fee\n- Order cancelled after 3 failed attempts\n- Buyer may be restricted from future COD orders\n\n## Refusal Policy\n\nYou may refuse delivery if:\n- Package is damaged or tampered with\n- Wrong product delivered\n- Product quantity doesn\'t match order\n\n## Seller Requirements\n\nSellers accepting COD must:\n- Package products securely\n- Include packing slip\n- Ship within 24 hours of order\n- Accept returns as per return policy\n\n## Contact\n\nCOD support: cod@j-store.cm or call +237 XXX XXX XXX',
    '1.0',
    CURRENT_DATE
  )
ON CONFLICT (type) DO NOTHING;
