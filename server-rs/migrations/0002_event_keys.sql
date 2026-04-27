ALTER TABLE raw_events ADD COLUMN IF NOT EXISTS event_key TEXT;

ALTER TABLE nav_points ADD COLUMN IF NOT EXISTS event_key TEXT;

ALTER TABLE trade_events ADD COLUMN IF NOT EXISTS event_key TEXT;

ALTER TABLE status_events ADD COLUMN IF NOT EXISTS event_key TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'raw_events_event_key_key'
    ) THEN
        ALTER TABLE raw_events ADD CONSTRAINT raw_events_event_key_key UNIQUE (event_key);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nav_points_event_key_key'
    ) THEN
        ALTER TABLE nav_points ADD CONSTRAINT nav_points_event_key_key UNIQUE (event_key);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trade_events_event_key_key'
    ) THEN
        ALTER TABLE trade_events ADD CONSTRAINT trade_events_event_key_key UNIQUE (event_key);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'status_events_event_key_key'
    ) THEN
        ALTER TABLE status_events ADD CONSTRAINT status_events_event_key_key UNIQUE (event_key);
    END IF;
END $$;
