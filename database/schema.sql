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

