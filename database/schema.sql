-- Multi-tenant ERP Database Schema
-- PostgreSQL/Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table (role-based access control)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) UNIQUE NOT NULL,
    access_hr BOOLEAN DEFAULT FALSE,
    access_finance BOOLEAN DEFAULT FALSE,
    access_it BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_role FOREIGN KEY (role) REFERENCES permissions(role) ON DELETE RESTRICT
);

-- Create indexes for better performance
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_companies_company_code ON companies(company_code);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Password verification function (requires pgcrypto extension)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to verify user password
CREATE OR REPLACE FUNCTION verify_user_password(
    user_email VARCHAR,
    user_company_id UUID,
    plain_password VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stored_hash VARCHAR;
BEGIN
    -- Get the password hash for the user
    SELECT password_hash INTO stored_hash
    FROM users
    WHERE email = user_email
      AND company_id = user_company_id;

    -- If user not found, return false
    IF stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verify password using crypt (bcrypt)
    -- Note: This assumes passwords are hashed using bcrypt
    -- Adjust the verification method based on your hashing algorithm
    RETURN crypt(plain_password, stored_hash) = stored_hash;
END;
$$;

-- Function to generate a user token (simplified - use JWT in production)
-- Note: For production, use Supabase's built-in JWT or a proper JWT library
CREATE OR REPLACE FUNCTION generate_user_token(
    user_id UUID,
    user_email VARCHAR,
    company_id UUID,
    user_role VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_payload JSON;
BEGIN
    -- Create token payload
    -- In production, use Supabase's JWT signing or a proper JWT library
    token_payload := json_build_object(
        'userId', user_id,
        'email', user_email,
        'companyId', company_id,
        'role', user_role,
        'iat', extract(epoch from now()),
        'exp', extract(epoch from now() + interval '24 hours')
    );

    RETURN token_payload;
END;
$$;

-- Function to hash password for user creation
CREATE OR REPLACE FUNCTION hash_password(plain_password VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Hash password using bcrypt (pgcrypto crypt function)
    -- Generate a salt and hash the password
    RETURN crypt(plain_password, gen_salt('bf', 10));
END;
$$;

-- IT Assets Table (CMDB - Configuration Management Database)
CREATE TABLE it_assets (
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
CREATE TABLE knowledge_articles (
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
CREATE TABLE it_tickets (
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
CREATE TABLE sla_metrics (
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

-- Create indexes for better performance
CREATE INDEX idx_assets_company_id ON it_assets(company_id);
CREATE INDEX idx_assets_asset_tag ON it_assets(asset_tag);
CREATE INDEX idx_assets_assigned_to ON it_assets(assigned_to_user_id);
CREATE INDEX idx_assets_status ON it_assets(status);
CREATE INDEX idx_knowledge_company_id ON knowledge_articles(company_id);
CREATE INDEX idx_knowledge_published ON knowledge_articles(is_published);
CREATE INDEX idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX idx_tickets_company_id ON it_tickets(company_id);
CREATE INDEX idx_tickets_status ON it_tickets(status);
CREATE INDEX idx_tickets_requester ON it_tickets(requester_user_id);
CREATE INDEX idx_tickets_assigned_to ON it_tickets(assigned_to_user_id);
CREATE INDEX idx_sla_ticket_id ON sla_metrics(ticket_id);

-- Add triggers for updated_at
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON it_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_updated_at BEFORE UPDATE ON knowledge_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON it_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate ticket number
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

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_sequence START 1;

