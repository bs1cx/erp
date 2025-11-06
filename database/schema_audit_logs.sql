-- Audit Logs Table
-- Tracks all sensitive changes in the system for compliance and security

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'SALARY_UPDATED', 'USER_TERMINATED', 'EMPLOYEE_CREATED'
    module VARCHAR(50) NOT NULL, -- 'HR', 'IT', 'FINANCE', etc.
    old_data JSONB, -- Previous state of the data
    new_data JSONB, -- New state of the data
    ip_address VARCHAR(45), -- IPv4 or IPv6 address
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_company_id') THEN
        CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_user_id') THEN
        CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_action') THEN
        CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_module') THEN
        CREATE INDEX idx_audit_logs_module ON audit_logs(module);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_created_at') THEN
        CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
    END IF;
    
    -- Composite index for common queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_company_module') THEN
        CREATE INDEX idx_audit_logs_company_module ON audit_logs(company_id, module, created_at DESC);
    END IF;
END $$;

-- Function to automatically log audit entries
CREATE OR REPLACE FUNCTION log_audit_entry(
    p_company_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_module VARCHAR,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        company_id,
        user_id,
        action,
        module,
        old_data,
        new_data
    ) VALUES (
        p_company_id,
        p_user_id,
        p_action,
        p_module,
        p_old_data,
        p_new_data
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;


