-- HR Calendar/Planner Events Table
-- Provides scheduling and event management for HR activities

CREATE TABLE IF NOT EXISTS hr_calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) DEFAULT 'General', -- 'General', 'Meeting', 'Training', 'Interview', 'Review', etc.
    location VARCHAR(255),
    is_all_day BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50), -- 'None', 'Daily', 'Weekly', 'Monthly', 'Yearly'
    recurrence_end_date DATE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_calendar_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT chk_calendar_datetime CHECK (end_datetime >= start_datetime)
);

-- Create indexes for better query performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_company_id') THEN
        CREATE INDEX idx_calendar_company_id ON hr_calendar_events(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_assigned_user') THEN
        CREATE INDEX idx_calendar_assigned_user ON hr_calendar_events(assigned_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_datetime') THEN
        CREATE INDEX idx_calendar_datetime ON hr_calendar_events(company_id, start_datetime, end_datetime);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_calendar_event_type') THEN
        CREATE INDEX idx_calendar_event_type ON hr_calendar_events(event_type);
    END IF;
END $$;

-- Add trigger for updated_at column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_calendar') THEN
        CREATE TRIGGER set_updated_at_calendar
        BEFORE UPDATE ON hr_calendar_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

