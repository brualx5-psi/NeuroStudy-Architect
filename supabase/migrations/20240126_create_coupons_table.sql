-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security) - Optional but good practice
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to everyone (so the API can check it, or public if needed, 
-- but usually we check via Service Role in API so RLS doesn't block Admin).
-- For now, we'll leave it private and access via Service Role in the API.

-- Insert a test coupon (Optional - you can remove this line if you want)
INSERT INTO coupons (code, discount_percent, active) 
VALUES ('LANCAMENTO', 20, true)
ON CONFLICT (code) DO NOTHING;
