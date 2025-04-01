DROP TABLE IF EXISTS users;
CREATE TABLE apf_users (
    username    VARCHAR(50) PRIMARY KEY,
    password    VARCHAR(60) NOT NULL
);