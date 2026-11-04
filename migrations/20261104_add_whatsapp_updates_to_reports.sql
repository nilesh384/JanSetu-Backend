-- Existing and new reports default to no WhatsApp messages.
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS whatsapp_updates BOOLEAN NOT NULL DEFAULT FALSE;
