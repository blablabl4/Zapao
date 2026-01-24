-- Hub Surveys Table
CREATE TABLE IF NOT EXISTS hub_surveys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    q1_answer VARCHAR(255),
    q2_answer VARCHAR(255),
    q3_answer VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_hub_surveys_created_at ON hub_surveys(created_at);
