-- Ticket Messages Table for Conversation Logging
-- Run this script to add messaging functionality to tickets

-- Ticket Messages Table (conversation log)
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL,
    user_id UUID NOT NULL,
    message_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- TRUE for private notes visible only to IT staff
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_ticket FOREIGN KEY (ticket_id) REFERENCES it_tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_messages_ticket_id') THEN
        CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_messages_user_id') THEN
        CREATE INDEX idx_ticket_messages_user_id ON ticket_messages(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_messages_created_at') THEN
        CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(created_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_messages_internal') THEN
        CREATE INDEX idx_ticket_messages_internal ON ticket_messages(is_internal);
    END IF;
END $$;


