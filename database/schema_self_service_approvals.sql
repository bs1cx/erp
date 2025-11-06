-- Self-Service Portal and Hierarchical Approval Workflows
-- Enables employee self-service and two-level approval system (Manager → HR)

-- Update users table to add manager_id for reporting structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='manager_id') THEN
        ALTER TABLE users ADD COLUMN manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for manager_id lookups
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_manager_id') THEN
        CREATE INDEX idx_users_manager_id ON users(manager_id);
    END IF;
END $$;

-- Update leave_requests table to support hierarchical approvals
DO $$
BEGIN
    -- Add manager approval fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='manager_approval_status') THEN
        ALTER TABLE leave_requests ADD COLUMN manager_approval_status VARCHAR(50) DEFAULT 'Pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='manager_approval_user_id') THEN
        ALTER TABLE leave_requests ADD COLUMN manager_approval_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='manager_approval_date') THEN
        ALTER TABLE leave_requests ADD COLUMN manager_approval_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='manager_approval_notes') THEN
        ALTER TABLE leave_requests ADD COLUMN manager_approval_notes TEXT;
    END IF;
    
    -- Add HR final approval fields (if not already present)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='hr_approval_user_id') THEN
        ALTER TABLE leave_requests ADD COLUMN hr_approval_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='hr_approval_date') THEN
        ALTER TABLE leave_requests ADD COLUMN hr_approval_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create indexes for approval queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_manager_approval') THEN
        CREATE INDEX idx_leave_manager_approval ON leave_requests(manager_approval_status, manager_approval_user_id) WHERE manager_approval_status = 'Pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_hr_approval') THEN
        CREATE INDEX idx_leave_hr_approval ON leave_requests(status, manager_approval_status) WHERE status = 'Pending' AND manager_approval_status = 'Approved';
    END IF;
END $$;

-- Function to get employee's manager
CREATE OR REPLACE FUNCTION get_employee_manager(employee_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    manager_id UUID;
BEGIN
    SELECT u.manager_id INTO manager_id
    FROM users u
    WHERE u.id = employee_user_id;
    
    RETURN manager_id;
END;
$$;

