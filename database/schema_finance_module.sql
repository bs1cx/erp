-- Finance Module: Turkish Payroll Export Compliance & Invoice Management
-- Supports integration with Turkish accounting software (Logo Payroll, Mikro Jump, etc.)

-- Create payroll_integrations table for external service connections
CREATE TABLE IF NOT EXISTS payroll_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL, -- e.g., 'Logo Payroll', 'Mikro Jump', 'Netsis', 'Parasoft'
    api_url VARCHAR(500),
    api_key_hash VARCHAR(255), -- Encrypted/hashed API key
    api_username VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_date TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'Not Synced', -- 'Not Synced', 'Syncing', 'Success', 'Failed'
    sync_error_message TEXT,
    configuration JSONB, -- Additional service-specific configuration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payroll_integrations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT unique_company_service UNIQUE (company_id, service_name)
);

-- Add trigger for updated_at column to payroll_integrations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_payroll_integrations') THEN
        CREATE TRIGGER set_updated_at_payroll_integrations
        BEFORE UPDATE ON payroll_integrations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create indexes for payroll_integrations
CREATE INDEX IF NOT EXISTS idx_payroll_integrations_company_id ON payroll_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_integrations_service_name ON payroll_integrations(service_name);
CREATE INDEX IF NOT EXISTS idx_payroll_integrations_active ON payroll_integrations(company_id, is_active) WHERE is_active = TRUE;

-- Update users table with Turkish compliance fields
DO $$
BEGIN
    -- Add TC Identity Number (Turkish National ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tc_identity_number') THEN
        ALTER TABLE users ADD COLUMN tc_identity_number VARCHAR(11) UNIQUE;
    END IF;
    
    -- Add SGK Registration Number (Social Security Institution)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='sgk_registration_number') THEN
        ALTER TABLE users ADD COLUMN sgk_registration_number VARCHAR(20);
    END IF;
END $$;

-- Create indexes for Turkish compliance fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_tc_identity') THEN
        CREATE INDEX idx_users_tc_identity ON users(tc_identity_number) WHERE tc_identity_number IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_sgk_registration') THEN
        CREATE INDEX idx_users_sgk_registration ON users(sgk_registration_number) WHERE sgk_registration_number IS NOT NULL;
    END IF;
END $$;

-- Create invoice_records table for invoice and vendor management
CREATE TABLE IF NOT EXISTS invoice_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_tax_id VARCHAR(50), -- Turkish Tax ID (Vergi No)
    vendor_address TEXT,
    vendor_contact_email VARCHAR(255),
    vendor_contact_phone VARCHAR(50),
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TRY', -- Turkish Lira
    invoice_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Paid', 'Overdue', 'Cancelled'
    payment_date DATE,
    payment_method VARCHAR(100), -- 'Bank Transfer', 'Cash', 'Check', etc.
    payment_reference VARCHAR(255),
    description TEXT,
    category VARCHAR(100), -- 'Office Supplies', 'Services', 'Equipment', etc.
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    tax_rate DECIMAL(5, 2) DEFAULT 0.00, -- VAT rate (KDV)
    total_amount DECIMAL(12, 2) NOT NULL, -- amount + tax_amount
    notes TEXT,
    attachment_url VARCHAR(500), -- Link to invoice document
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_records_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT unique_company_invoice_number UNIQUE (company_id, invoice_number)
);

-- Add trigger for updated_at column to invoice_records
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_invoice_records') THEN
        CREATE TRIGGER set_updated_at_invoice_records
        BEFORE UPDATE ON invoice_records
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create indexes for invoice_records
CREATE INDEX IF NOT EXISTS idx_invoice_records_company_id ON invoice_records(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_status ON invoice_records(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_records_invoice_date ON invoice_records(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_records_vendor_name ON invoice_records(company_id, vendor_name);
CREATE INDEX IF NOT EXISTS idx_invoice_records_due_date ON invoice_records(due_date) WHERE status = 'Pending';

-- Function to calculate total amount (amount + tax)
CREATE OR REPLACE FUNCTION calculate_invoice_total(
    p_amount DECIMAL,
    p_tax_rate DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
    v_tax_amount DECIMAL;
    v_total DECIMAL;
BEGIN
    v_tax_amount := p_amount * (p_tax_rate / 100);
    v_total := p_amount + v_tax_amount;
    RETURN v_total;
END;
$$;

