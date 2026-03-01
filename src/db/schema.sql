-- USERS
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PLAYERS
CREATE TABLE IF NOT EXISTS players (
  player_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  team VARCHAR(10),
  position VARCHAR(10),
  headshot_url TEXT,
  blitz_credit INT DEFAULT 1,
  duel_rating_A INT DEFAULT 70,
  duel_rating_B INT DEFAULT 70,
  height VARCHAR(20),
  weight VARCHAR(20),
  birthdate VARCHAR(20),
  experience VARCHAR(50),
  country VARCHAR(50)
);

-- POOLS
CREATE TABLE IF NOT EXISTS pools (
  pool_id INT AUTO_INCREMENT PRIMARY KEY,
  pool_type ENUM("BLITZ","DUEL") NOT NULL,
  name VARCHAR(50) NOT NULL,
  player_count INT NOT NULL,
  salary_cap INT NOT NULL,
  lock_time DATETIME NOT NULL,
  status ENUM("OPEN","LOCKED","CLOSED") DEFAULT "OPEN",
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ENTRIES
CREATE TABLE IF NOT EXISTS entries (
  entry_id INT AUTO_INCREMENT PRIMARY KEY,
  pool_id INT NOT NULL,
  user_id INT NOT NULL,
  total_salary INT NOT NULL,
  total_score FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pool_id) REFERENCES pools(pool_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- LINEUPS (supports 5 or 2 players)
CREATE TABLE IF NOT EXISTS lineup (
  lineup_id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  player_id INT NOT NULL,
  FOREIGN KEY(entry_id) REFERENCES entries(entry_id),
  FOREIGN KEY(player_id) REFERENCES players(player_id)
);
