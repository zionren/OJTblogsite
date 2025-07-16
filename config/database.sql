-- ...existing tables...

-- MAC Address Bans Table
CREATE TABLE IF NOT EXISTS mac_bans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mac_address VARCHAR(17) NOT NULL,
    reason TEXT,
    banned_by VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_mac_address (mac_address),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
);
