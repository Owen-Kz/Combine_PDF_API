-- ===========================================================================
-- support_team_credentials  –  stores dashboard support / tech-ops logins
-- email_error_logs          –  stores every failed automated email send
-- ===========================================================================
-- Run this once against the database named in process.env.D_NAME
-- (asfirj_submissions).  On Hostinger / phpMyAdmin:
--
--   1. Open phpMyAdmin
--   2. Select the target database (asfirj_submissions)
--   3. Click SQL  →  paste this entire file  →  click Go
--
-- The seed account is:
--   email    : support@asfirj.org
--   password : Asfi@Support#2026
--   (change immediately after first login)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS `support_team_credentials` (
    `id`                 INT          AUTO_INCREMENT PRIMARY KEY,
    `email`              VARCHAR(255) NOT NULL UNIQUE,
    `password_hash`      VARCHAR(100) NOT NULL,
    `fullname`           VARCHAR(255) DEFAULT NULL,
    `role`               VARCHAR(50)  NOT NULL DEFAULT 'support',
    `is_active`          TINYINT(1)   NOT NULL DEFAULT 1,
    `last_login_at`      DATETIME     DEFAULT NULL,
    `reset_token`        VARCHAR(255) DEFAULT NULL,
    `reset_token_expiry` DATETIME     DEFAULT NULL,
    `created_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional migration for an already-provisioned table (safe to run, no-ops if columns exist)
ALTER TABLE `support_team_credentials`
    ADD COLUMN `reset_token`        VARCHAR(255) DEFAULT NULL AFTER `last_login_at`,
    ADD COLUMN `reset_token_expiry` DATETIME     DEFAULT NULL AFTER `reset_token`;

CREATE TABLE IF NOT EXISTS `email_error_logs` (
    `id`                INT          AUTO_INCREMENT PRIMARY KEY,
    `recipient`         VARCHAR(255) DEFAULT NULL,
    `subject`           VARCHAR(500) DEFAULT NULL,
    `source`            VARCHAR(255) DEFAULT NULL,
    `email_payload`     LONGTEXT     NULL,
    `error_message`     TEXT         NULL,
    `error_code`        VARCHAR(100) DEFAULT NULL,
    `permanent_failure` TINYINT(1)   NOT NULL DEFAULT 0,
    `attempts`          INT          NOT NULL DEFAULT 1,
    `max_attempts`      INT          NOT NULL DEFAULT 3,
    `status`            VARCHAR(20)  NOT NULL DEFAULT 'pending',
    `next_retry_at`     DATETIME     DEFAULT NULL,
    `first_failed_at`   DATETIME     DEFAULT NULL,
    `last_attempt_at`   DATETIME     DEFAULT NULL,
    `alert_sent`        TINYINT(1)   NOT NULL DEFAULT 0,
    `resolved_at`       DATETIME     DEFAULT NULL,
    `created_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_status_next_retry` (`status`, `next_retry_at`),
    KEY `idx_first_failed`     (`first_failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed support account
INSERT INTO `support_team_credentials`
    (`email`, `password_hash`, `fullname`, `role`, `is_active`)
VALUES
    ('support@asfirj.org',
     '$2a$10$H8a.Rfrv/XHDFlrhEJC6GuKBODTU6P4fUiPgVD.6z8ADSBiRuBloC',
     'ASFIRJ Support Team',
     'support',
     1)
ON DUPLICATE KEY UPDATE
    `fullname` = VALUES(`fullname`),
    `role`      = VALUES(`role`);