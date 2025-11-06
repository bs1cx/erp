-- Payroll and Benefits Management Tables
-- Provides comprehensive payroll tracking and employee benefits management

-- Payroll Records Table
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_salary DECIMAL(12, 2) NOT NULL,
    net_salary DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    contribution_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    deductions DECIMAL(12, 2) NOT NULL DEFAULT 0,
    bonuses DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Paid', 'Pending', 'Processing', 'Cancelled'
    payment_date DATE,
    payment_method VARCHAR(50), -- 'Bank Transfer', 'Check', 'Cash', etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID,
    CONSTRAINT fk_payroll_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_payroll_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_payroll_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_payroll_period CHECK (period_end >= period_start),
    CONSTRAINT chk_payroll_amounts CHECK (net_salary >= 0 AND gross_salary >= net_salary)
);

-- Employee Benefits Table
CREATE TABLE IF NOT EXISTS employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    benefit_type VARCHAR(100) NOT NULL, -- 'Meal Card', 'Transport', 'Private Health', 'Gym', 'Education', etc.
    monthly_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    annual_amount DECIMAL(10, 2) GENERATED ALWAYS AS (monthly_amount * 12) STORED,
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    provider VARCHAR(255), -- Provider company name
    policy_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID,
    CONSTRAINT fk_benefit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_benefit_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_benefit_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_benefit_end_date CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_benefit_amount CHECK (monthly_amount >= 0)
);

-- Create indexes for better query performance
DO $$
BEGIN
    -- Payroll indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payroll_user_id') THEN
        CREATE INDEX idx_payroll_user_id ON payroll_records(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payroll_company_id') THEN
        CREATE INDEX idx_payroll_company_id ON payroll_records(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payroll_period') THEN
        CREATE INDEX idx_payroll_period ON payroll_records(company_id, period_start, period_end);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payroll_status') THEN
        CREATE INDEX idx_payroll_status ON payroll_records(status);
    END IF;
    
    -- Benefits indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_benefits_user_id') THEN
        CREATE INDEX idx_benefits_user_id ON employee_benefits(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_benefits_company_id') THEN
        CREATE INDEX idx_benefits_company_id ON employee_benefits(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_benefits_active') THEN
        CREATE INDEX idx_benefits_active ON employee_benefits(company_id, is_active) WHERE is_active = true;
    END IF;
END $$;

-- Add trigger for updated_at columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_payroll') THEN
        CREATE TRIGGER set_updated_at_payroll
        BEFORE UPDATE ON payroll_records
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_benefits') THEN
        CREATE TRIGGER set_updated_at_benefits
        BEFORE UPDATE ON employee_benefits
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Function to calculate net salary from gross salary
-- This is a simplified calculation - in production, you'd integrate with tax calculation services
CREATE OR REPLACE FUNCTION calculate_net_salary(
    gross_salary DECIMAL,
    tax_rate DECIMAL DEFAULT 0.20,
    contribution_rate DECIMAL DEFAULT 0.10
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
    tax_amount DECIMAL;
    contribution_amount DECIMAL;
    net_salary DECIMAL;
BEGIN
    tax_amount := gross_salary * tax_rate;
    contribution_amount := gross_salary * contribution_rate;
    net_salary := gross_salary - tax_amount - contribution_amount;
    
    RETURN net_salary;
END;
$$;


