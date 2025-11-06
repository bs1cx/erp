-- HR Employee Details (Sensitive Data) Schema
-- This table holds highly sensitive personal information

-- Update users table with name fields
DO $$
BEGIN
    -- Add first_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
    END IF;
    
    -- Add last_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
    END IF;
END $$;

-- Create departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_department_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT unique_department_per_company UNIQUE (company_id, name)
);

-- Create employee_details table (Sensitive Data)
-- This table holds highly sensitive information and must be strictly joined by user_id
CREATE TABLE IF NOT EXISTS employee_details (
    user_id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    date_of_birth DATE,
    marital_status VARCHAR(50), -- Single, Married, Divorced, Widowed
    driving_license_status VARCHAR(50), -- Yes, No, Expired, or BOOLEAN equivalent
    military_service_status VARCHAR(100), -- Completed, Exempt, Pending, Not Applicable
    medical_conditions TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relationship VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_details_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_employee_details_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_first_name') THEN
        CREATE INDEX idx_users_first_name ON users(first_name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_last_name') THEN
        CREATE INDEX idx_users_last_name ON users(last_name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_departments_company_id') THEN
        CREATE INDEX idx_departments_company_id ON departments(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_employee_details_company_id') THEN
        CREATE INDEX idx_employee_details_company_id ON employee_details(company_id);
    END IF;
END $$;

-- Add triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_departments_updated_at'
    ) THEN
        CREATE TRIGGER update_departments_updated_at
            BEFORE UPDATE ON departments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_employee_details_updated_at'
    ) THEN
        CREATE TRIGGER update_employee_details_updated_at
            BEFORE UPDATE ON employee_details
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Function to calculate age from date of birth
CREATE OR REPLACE FUNCTION calculate_age(date_of_birth DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF date_of_birth IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth));
END;
$$;


