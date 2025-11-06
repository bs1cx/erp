-- Leave Control and Advanced Performance Management
-- Addresses compliance, leave control, and performance goals

-- Create leave_types table for defining leave rules per company
CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'Annual Leave', 'Sick Leave', 'Personal Leave'
    max_days_per_year INTEGER NOT NULL DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_types_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT unique_company_leave_type UNIQUE (company_id, name)
);

-- Add trigger for updated_at column to leave_types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_leave_types') THEN
        CREATE TRIGGER set_updated_at_leave_types
        BEFORE UPDATE ON leave_types
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create index for leave_types
CREATE INDEX IF NOT EXISTS idx_leave_types_company_id ON leave_types(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_active ON leave_types(company_id, is_active) WHERE is_active = TRUE;

-- Create performance_goals table (separate from performance_reviews)
CREATE TABLE IF NOT EXISTS performance_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID REFERENCES performance_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    goal_description TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 0, -- Percentage of total score (0-100)
    employee_rating INTEGER, -- Rating given by employee (1-5 or similar scale)
    manager_rating INTEGER, -- Rating given by manager (1-5 or similar scale)
    employee_notes TEXT,
    manager_notes TEXT,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Reviewed, Completed
    target_date DATE,
    completion_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_performance_goals_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_performance_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT check_weight_range CHECK (weight >= 0 AND weight <= 100),
    CONSTRAINT check_rating_range CHECK (
        (employee_rating IS NULL OR (employee_rating >= 1 AND employee_rating <= 5)) AND
        (manager_rating IS NULL OR (manager_rating >= 1 AND manager_rating <= 5))
    )
);

-- Add trigger for updated_at column to performance_goals
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_performance_goals') THEN
        CREATE TRIGGER set_updated_at_performance_goals
        BEFORE UPDATE ON performance_goals
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create indexes for performance_goals
CREATE INDEX IF NOT EXISTS idx_performance_goals_review_id ON performance_goals(review_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_user_id ON performance_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_company_id ON performance_goals(company_id);
CREATE INDEX IF NOT EXISTS idx_performance_goals_status ON performance_goals(company_id, status);

-- Function to calculate available leave days based on leave type and user tenure
CREATE OR REPLACE FUNCTION calculate_available_leave_days(
    p_user_id UUID,
    p_leave_type_name VARCHAR,
    p_company_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_days INTEGER;
    v_annual_leave_days INTEGER;
    v_used_leave_days INTEGER;
    v_available_days INTEGER;
    v_user_created_at TIMESTAMP WITH TIME ZONE;
    v_tenure_years NUMERIC;
BEGIN
    -- Get max days for the leave type
    SELECT max_days_per_year INTO v_max_days
    FROM leave_types
    WHERE company_id = p_company_id
      AND name = p_leave_type_name
      AND is_active = TRUE
    LIMIT 1;

    -- If no leave type found, use default from users table
    IF v_max_days IS NULL THEN
        SELECT annual_leave_days INTO v_annual_leave_days
        FROM users
        WHERE id = p_user_id AND company_id = p_company_id;
        
        SELECT used_leave_days INTO v_used_leave_days
        FROM users
        WHERE id = p_user_id AND company_id = p_company_id;
        
        RETURN COALESCE(v_annual_leave_days, 20) - COALESCE(v_used_leave_days, 0);
    END IF;

    -- Get user's annual leave days and used days
    SELECT annual_leave_days, used_leave_days, created_at
    INTO v_annual_leave_days, v_used_leave_days, v_user_created_at
    FROM users
    WHERE id = p_user_id AND company_id = p_company_id;

    -- Calculate tenure (years)
    v_tenure_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_user_created_at));

    -- For annual leave, consider tenure-based increases (optional: can be customized)
    -- For now, use the max_days_per_year from leave_types
    -- In the future, this can be enhanced with tenure-based rules
    
    v_available_days := v_max_days - COALESCE(v_used_leave_days, 0);
    
    -- Ensure non-negative
    IF v_available_days < 0 THEN
        v_available_days := 0;
    END IF;

    RETURN v_available_days;
END;
$$;

-- Ensure users table has annual_leave_days and used_leave_days (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='annual_leave_days') THEN
        ALTER TABLE users ADD COLUMN annual_leave_days INTEGER DEFAULT 20;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='used_leave_days') THEN
        ALTER TABLE users ADD COLUMN used_leave_days INTEGER DEFAULT 0;
    END IF;
END $$;

