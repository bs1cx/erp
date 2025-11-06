-- Additional Tables for IT Service Management Module
-- Run this script if you've already created the base tables (companies, users, permissions)
-- This script only creates the new ITSM tables and functions

-- IT Assets Table (CMDB - Configuration Management Database)
CREATE TABLE IF NOT EXISTS it_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- Laptop, Monitor, Software License, etc.
    assigned_to_user_id UUID,
    purchase_date DATE,
    warranty_end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Stock', -- In Use, Stock, Retired
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_asset_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_asset_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_asset_type CHECK (type IN ('Laptop', 'Monitor', 'Software License', 'Desktop', 'Printer', 'Server', 'Network Equipment', 'Other')),
    CONSTRAINT chk_asset_status CHECK (status IN ('In Use', 'Stock', 'Retired', 'Maintenance'))
);

-- Knowledge Articles Table (Knowledge Base)
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100), -- VPN Setup, Software Installation, etc.
    author_user_id UUID NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_article_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_article_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- IT Support Tickets Table
CREATE TABLE IF NOT EXISTS it_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Open', -- Open, In Progress, Resolved, Closed
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium', -- Low, Medium, High, Critical
    requester_user_id UUID NOT NULL,
    assigned_to_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_ticket_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_requester FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_assignee FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_ticket_status CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    CONSTRAINT chk_ticket_priority CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'))
);

-- SLA Metrics Table
CREATE TABLE IF NOT EXISTS sla_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL,
    company_id UUID NOT NULL,
    time_to_first_response_minutes INTEGER,
    time_to_resolve_minutes INTEGER,
    target_resolution_minutes INTEGER DEFAULT 480, -- 8 hours default SLA
    sla_met BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sla_ticket FOREIGN KEY (ticket_id) REFERENCES it_tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_sla_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Create indexes for better performance (IF NOT EXISTS doesn't work for indexes, so we check first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_company_id') THEN
        CREATE INDEX idx_assets_company_id ON it_assets(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_asset_tag') THEN
        CREATE INDEX idx_assets_asset_tag ON it_assets(asset_tag);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_assigned_to') THEN
        CREATE INDEX idx_assets_assigned_to ON it_assets(assigned_to_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assets_status') THEN
        CREATE INDEX idx_assets_status ON it_assets(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_company_id') THEN
        CREATE INDEX idx_knowledge_company_id ON knowledge_articles(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_published') THEN
        CREATE INDEX idx_knowledge_published ON knowledge_articles(is_published);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_knowledge_category') THEN
        CREATE INDEX idx_knowledge_category ON knowledge_articles(category);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_company_id') THEN
        CREATE INDEX idx_tickets_company_id ON it_tickets(company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_status') THEN
        CREATE INDEX idx_tickets_status ON it_tickets(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_requester') THEN
        CREATE INDEX idx_tickets_requester ON it_tickets(requester_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_assigned_to') THEN
        CREATE INDEX idx_tickets_assigned_to ON it_tickets(assigned_to_user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sla_ticket_id') THEN
        CREATE INDEX idx_sla_ticket_id ON sla_metrics(ticket_id);
    END IF;
END $$;

-- Add triggers for updated_at (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assets_updated_at') THEN
        CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON it_assets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_knowledge_updated_at') THEN
        CREATE TRIGGER update_knowledge_updated_at BEFORE UPDATE ON knowledge_articles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tickets_updated_at') THEN
        CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON it_tickets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Function to generate ticket number (CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    ticket_num VARCHAR;
BEGIN
    ticket_num := 'TICK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('ticket_sequence')::text, 6, '0');
    RETURN ticket_num;
END;
$$;

-- Create sequence for ticket numbers (IF NOT EXISTS)
CREATE SEQUENCE IF NOT EXISTS ticket_sequence START 1;


