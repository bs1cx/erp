-- Time & Attendance Tracking System (Devam/Yoklama Takibi)
-- Records user login/logout times and provides detailed session-based reports

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE, -- Indicates currently logged in session
    session_duration_minutes INTEGER, -- Calculated duration in minutes
    ip_address VARCHAR(45), -- IPv4 or IPv6 address
    user_agent TEXT, -- Browser/client information
    notes TEXT, -- Optional notes (e.g., 'Auto-logout', 'Manual logout')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_records_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add trigger for updated_at column to attendance_records
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_attendance_records') THEN
        CREATE TRIGGER set_updated_at_attendance_records
        BEFORE UPDATE ON attendance_records
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_company_id ON attendance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_login_time ON attendance_records(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_is_active ON attendance_records(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attendance_records_date_range ON attendance_records(company_id, login_time);

-- Function to calculate session duration when logout_time is set
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Calculate duration in minutes when logout_time is set
    IF NEW.logout_time IS NOT NULL AND NEW.login_time IS NOT NULL THEN
        NEW.session_duration_minutes := EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time)) / 60;
    ELSE
        NEW.session_duration_minutes := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Add trigger to automatically calculate session duration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_attendance_duration') THEN
        CREATE TRIGGER calculate_attendance_duration
        BEFORE INSERT OR UPDATE ON attendance_records
        FOR EACH ROW
        WHEN (NEW.logout_time IS NOT NULL)
        EXECUTE FUNCTION calculate_session_duration();
    END IF;
END $$;

-- Function to get daily attendance summary for a user
CREATE OR REPLACE FUNCTION get_daily_attendance_summary(
    p_user_id UUID,
    p_company_id UUID,
    p_date DATE
)
RETURNS TABLE(
    total_minutes INTEGER,
    session_count INTEGER,
    first_login TIMESTAMP WITH TIME ZONE,
    last_logout TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(session_duration_minutes), 0)::INTEGER AS total_minutes,
        COUNT(*)::INTEGER AS session_count,
        MIN(login_time) AS first_login,
        MAX(logout_time) AS last_logout
    FROM attendance_records
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND DATE(login_time) = p_date
      AND logout_time IS NOT NULL
      AND is_active = FALSE;
END;
$$;

-- Function to get monthly attendance summary for a user
CREATE OR REPLACE FUNCTION get_monthly_attendance_summary(
    p_user_id UUID,
    p_company_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS TABLE(
    total_minutes INTEGER,
    total_days INTEGER,
    average_daily_minutes INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(session_duration_minutes), 0)::INTEGER AS total_minutes,
        COUNT(DISTINCT DATE(login_time))::INTEGER AS total_days,
        CASE
            WHEN COUNT(DISTINCT DATE(login_time)) > 0 THEN
                (COALESCE(SUM(session_duration_minutes), 0) / COUNT(DISTINCT DATE(login_time)))::INTEGER
            ELSE 0
        END AS average_daily_minutes
    FROM attendance_records
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND EXTRACT(YEAR FROM login_time) = p_year
      AND EXTRACT(MONTH FROM login_time) = p_month
      AND logout_time IS NOT NULL
      AND is_active = FALSE;
END;
$$;

