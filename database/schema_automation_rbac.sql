-- Automation Engine and Enhanced RBAC Schema
-- Run this script to add automation and granular permissions

-- Enhanced Permissions Table (add granular CRUD permissions)
-- First, add new columns to existing permissions table
DO $$
BEGIN
    -- Add HR module permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_hr_read') THEN
        ALTER TABLE permissions ADD COLUMN module_hr_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_hr_write') THEN
        ALTER TABLE permissions ADD COLUMN module_hr_write BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add Finance module permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_finance_read') THEN
        ALTER TABLE permissions ADD COLUMN module_finance_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_finance_write') THEN
        ALTER TABLE permissions ADD COLUMN module_finance_write BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add IT module permissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_it_read') THEN
        ALTER TABLE permissions ADD COLUMN module_it_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_it_write') THEN
        ALTER TABLE permissions ADD COLUMN module_it_write BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Automation Rules Table
CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100) NOT NULL, -- USER_CREATED, ASSET_STATUS_CHANGE, TICKET_CREATED, etc.
    action VARCHAR(100) NOT NULL, -- CREATE_TICKET, SEND_NOTIFICATION, UPDATE_ASSET, etc.
    action_config JSONB, -- Flexible JSON configuration for action parameters
    conditions JSONB, -- Optional conditions for when to trigger (e.g., {"priority": "High"})
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_automation_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_automation_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_trigger_event CHECK (trigger_event IN (
        'USER_CREATED',
        'USER_UPDATED',
        'ASSET_CREATED',
        'ASSET_STATUS_CHANGE',
        'ASSET_ASSIGNED',
        'TICKET_CREATED',
        'TICKET_STATUS_CHANGE',
        'TICKET_PRIORITY_CHANGE',
        'ARTICLE_PUBLISHED',
        'WARRANTY_EXPIRING'
    )),
    CONSTRAINT chk_action CHECK (action IN (
        'CREATE_TICKET',
        'SEND_NOTIFICATION',
        'UPDATE_ASSET',
        'ASSIGN_USER',
        'CREATE_REMINDER',
        'UPDATE_STATUS',
        'EXECUTE_WORKFLOW'
    ))
);

-- Automation Execution Log (for auditing and debugging)
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    rule_id UUID NOT NULL,
    trigger_event VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    execution_status VARCHAR(50) NOT NULL, -- SUCCESS, FAILED, SKIPPED
    execution_result JSONB, -- Result data from the action
    error_message TEXT,
    triggered_by_data JSONB, -- The data that triggered this automation
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_automation_log_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_automation_log_rule FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    CONSTRAINT chk_execution_status CHECK (execution_status IN ('SUCCESS', 'FAILED', 'SKIPPED'))
);

-- Create indexes for automation tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_company_id') THEN
        CREATE INDEX idx_automation_company_id ON automation_rules(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_trigger_event') THEN
        CREATE INDEX idx_automation_trigger_event ON automation_rules(trigger_event);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_active') THEN
        CREATE INDEX idx_automation_active ON automation_rules(is_active);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_log_company_id') THEN
        CREATE INDEX idx_automation_log_company_id ON automation_logs(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_log_rule_id') THEN
        CREATE INDEX idx_automation_log_rule_id ON automation_logs(rule_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_log_executed_at') THEN
        CREATE INDEX idx_automation_log_executed_at ON automation_logs(executed_at);
    END IF;
END $$;

-- Add trigger for updated_at on automation_rules
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_updated_at') THEN
        CREATE TRIGGER update_automation_updated_at BEFORE UPDATE ON automation_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Update existing permissions with default granular access
-- IT_ADMIN gets full access, others get read-only initially
UPDATE permissions 
SET 
    module_hr_read = CASE WHEN role = 'IT_ADMIN' THEN TRUE ELSE access_hr END,
    module_hr_write = CASE WHEN role = 'IT_ADMIN' THEN TRUE ELSE FALSE END,
    module_finance_read = CASE WHEN role = 'IT_ADMIN' THEN TRUE ELSE access_finance END,
    module_finance_write = CASE WHEN role = 'IT_ADMIN' THEN TRUE ELSE FALSE END,
    module_it_read = CASE WHEN role = 'IT_ADMIN' THEN TRUE ELSE access_it END,
    module_it_write = CASE WHEN role = 'IT_ADMIN' THEN TRUE ELSE access_it END
WHERE role IN ('IT_ADMIN', 'HR_USER', 'FINANCE_MANAGER');


