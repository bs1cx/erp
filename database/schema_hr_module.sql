-- HR Module Database Schema
-- Run this script to add HR-specific tables and columns

-- Update users table with HR-specific columns
DO $$
BEGIN
    -- Add department column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'department'
    ) THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(100);
    END IF;
    
    -- Add salary column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'salary'
    ) THEN
        ALTER TABLE users ADD COLUMN salary DECIMAL(12, 2);
    END IF;
    
    -- Add annual_leave_days column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'annual_leave_days'
    ) THEN
        ALTER TABLE users ADD COLUMN annual_leave_days INTEGER DEFAULT 20;
    END IF;
    
    -- Add used_leave_days column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'used_leave_days'
    ) THEN
        ALTER TABLE users ADD COLUMN used_leave_days INTEGER DEFAULT 0;
    END IF;
END $$;

-- Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type VARCHAR(50) NOT NULL, -- Annual, Sick, Personal, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    reason TEXT,
    approved_by_user_id UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_leave_type CHECK (type IN ('Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Other')),
    CONSTRAINT chk_leave_status CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

-- Job Postings Table (Recruitment)
CREATE TABLE IF NOT EXISTS job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    department VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Open', -- Open, Closed, On Hold
    posted_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closing_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID NOT NULL,
    CONSTRAINT fk_job_posting_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_job_posting_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_job_status CHECK (status IN ('Open', 'Closed', 'On Hold'))
);

-- Candidates Table (Recruitment)
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID NOT NULL,
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    resume_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Applied', -- Applied, Interview, Hired, Rejected
    notes TEXT,
    applied_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidate_job FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    CONSTRAINT fk_candidate_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT chk_candidate_status CHECK (status IN ('Applied', 'Interview', 'Hired', 'Rejected'))
);

-- Performance Reviews Table
CREATE TABLE IF NOT EXISTS performance_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    reviewer_user_id UUID NOT NULL,
    review_date DATE NOT NULL,
    rating INTEGER NOT NULL, -- 1-5 scale
    summary TEXT NOT NULL,
    goals TEXT,
    achievements TEXT,
    areas_for_improvement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_employee FOREIGN KEY (employee_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5)
);

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_user_id') THEN
        CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_company_id') THEN
        CREATE INDEX idx_leave_requests_company_id ON leave_requests(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_status') THEN
        CREATE INDEX idx_leave_requests_status ON leave_requests(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_postings_company_id') THEN
        CREATE INDEX idx_job_postings_company_id ON job_postings(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_postings_status') THEN
        CREATE INDEX idx_job_postings_status ON job_postings(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_candidates_job_posting_id') THEN
        CREATE INDEX idx_candidates_job_posting_id ON candidates(job_posting_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_candidates_company_id') THEN
        CREATE INDEX idx_candidates_company_id ON candidates(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_performance_reviews_employee') THEN
        CREATE INDEX idx_performance_reviews_employee ON performance_reviews(employee_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_performance_reviews_company_id') THEN
        CREATE INDEX idx_performance_reviews_company_id ON performance_reviews(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_department') THEN
        CREATE INDEX idx_users_department ON users(department);
    END IF;
END $$;

-- Add triggers for updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_leave_requests_updated_at'
    ) THEN
        CREATE TRIGGER update_leave_requests_updated_at
            BEFORE UPDATE ON leave_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_job_postings_updated_at'
    ) THEN
        CREATE TRIGGER update_job_postings_updated_at
            BEFORE UPDATE ON job_postings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_candidates_updated_at'
    ) THEN
        CREATE TRIGGER update_candidates_updated_at
            BEFORE UPDATE ON candidates
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_performance_reviews_updated_at'
    ) THEN
        CREATE TRIGGER update_performance_reviews_updated_at
            BEFORE UPDATE ON performance_reviews
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Function to calculate leave days
CREATE OR REPLACE FUNCTION calculate_leave_days(start_date DATE, end_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    days_count INTEGER := 0;
    iter_date DATE;
BEGIN
    iter_date := start_date;
    WHILE iter_date <= end_date LOOP
        -- Exclude weekends (Saturday = 6, Sunday = 0)
        IF EXTRACT(DOW FROM iter_date) NOT IN (0, 6) THEN
            days_count := days_count + 1;
        END IF;
        iter_date := iter_date + INTERVAL '1 day';
    END LOOP;
    RETURN days_count;
END;
$$;

