-- Job Titles Table and Users Table Update
-- Run this script to add job title management functionality

-- Job Titles Table
CREATE TABLE IF NOT EXISTS job_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    title_name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    level VARCHAR(50), -- Manager, Specialist, Senior, Junior, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_title_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Add job_title_id column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'job_title_id'
    ) THEN
        ALTER TABLE users ADD COLUMN job_title_id UUID;
        ALTER TABLE users ADD CONSTRAINT fk_user_job_title 
            FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_titles_company_id') THEN
        CREATE INDEX idx_job_titles_company_id ON job_titles(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_titles_department') THEN
        CREATE INDEX idx_job_titles_department ON job_titles(department);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_job_title_id') THEN
        CREATE INDEX idx_users_job_title_id ON users(job_title_id);
    END IF;
END $$;

-- Add trigger for updated_at on job_titles
CREATE OR REPLACE FUNCTION update_job_titles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_job_titles_updated_at'
    ) THEN
        CREATE TRIGGER update_job_titles_updated_at
            BEFORE UPDATE ON job_titles
            FOR EACH ROW
            EXECUTE FUNCTION update_job_titles_updated_at();
    END IF;
END $$;


