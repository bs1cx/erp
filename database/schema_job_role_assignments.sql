-- Job Title-Role Assignments (Bridge Table)
-- This table creates a many-to-many relationship between job_titles and permissions (roles)

-- Create job_role_assignments bridge table
CREATE TABLE IF NOT EXISTS job_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_title_id UUID NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_role_job_title FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE CASCADE,
    CONSTRAINT fk_job_role_permission FOREIGN KEY (role_name) REFERENCES permissions(role) ON DELETE CASCADE,
    CONSTRAINT unique_job_role_assignment UNIQUE (job_title_id, role_name)
);

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_role_assignments_job_title') THEN
        CREATE INDEX idx_job_role_assignments_job_title ON job_role_assignments(job_title_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_role_assignments_role') THEN
        CREATE INDEX idx_job_role_assignments_role ON job_role_assignments(role_name);
    END IF;
END $$;

-- Pre-populate permissions table with granular roles
-- First, ensure the permissions table has the granular access columns
DO $$
BEGIN
    -- Add granular permission columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_hr_read') THEN
        ALTER TABLE permissions ADD COLUMN module_hr_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_hr_write') THEN
        ALTER TABLE permissions ADD COLUMN module_hr_write BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_finance_read') THEN
        ALTER TABLE permissions ADD COLUMN module_finance_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_finance_write') THEN
        ALTER TABLE permissions ADD COLUMN module_finance_write BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_it_read') THEN
        ALTER TABLE permissions ADD COLUMN module_it_read BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'module_it_write') THEN
        ALTER TABLE permissions ADD COLUMN module_it_write BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Insert/Update granular system roles
-- HR_MANAGER: Full HR Write/Read access
INSERT INTO permissions (role, access_hr, access_finance, access_it, module_hr_read, module_hr_write, module_finance_read, module_finance_write, module_it_read, module_it_write)
VALUES ('HR_MANAGER', TRUE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO UPDATE SET
    access_hr = TRUE,
    access_finance = FALSE,
    access_it = FALSE,
    module_hr_read = TRUE,
    module_hr_write = TRUE,
    module_finance_read = FALSE,
    module_finance_write = FALSE,
    module_it_read = FALSE,
    module_it_write = FALSE;

-- FINANCE_USER: Read access for Finance, no Write
INSERT INTO permissions (role, access_hr, access_finance, access_it, module_hr_read, module_hr_write, module_finance_read, module_finance_write, module_it_read, module_it_write)
VALUES ('FINANCE_USER', FALSE, TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO UPDATE SET
    access_hr = FALSE,
    access_finance = TRUE,
    access_it = FALSE,
    module_hr_read = FALSE,
    module_hr_write = FALSE,
    module_finance_read = TRUE,
    module_finance_write = FALSE,
    module_it_read = FALSE,
    module_it_write = FALSE;

-- EMPLOYEE: Basic Read access for HR (own profile), no Write
INSERT INTO permissions (role, access_hr, access_finance, access_it, module_hr_read, module_hr_write, module_finance_read, module_finance_write, module_it_read, module_it_write)
VALUES ('EMPLOYEE', TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role) DO UPDATE SET
    access_hr = TRUE,
    access_finance = FALSE,
    access_it = FALSE,
    module_hr_read = TRUE,
    module_hr_write = FALSE,
    module_finance_read = FALSE,
    module_finance_write = FALSE,
    module_it_read = FALSE,
    module_it_write = FALSE;

-- Ensure existing roles still have their permissions
-- IT_ADMIN should have full IT access
UPDATE permissions SET
    module_it_read = TRUE,
    module_it_write = TRUE
WHERE role = 'IT_ADMIN';

-- HR_USER should have HR read/write
UPDATE permissions SET
    module_hr_read = TRUE,
    module_hr_write = TRUE
WHERE role = 'HR_USER';

-- FINANCE_MANAGER should have Finance read/write
UPDATE permissions SET
    module_finance_read = TRUE,
    module_finance_write = TRUE
WHERE role = 'FINANCE_MANAGER';


