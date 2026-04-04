ALTER TABLE `sessions` RENAME TO `sessions_legacy`;
--> statement-breakpoint
CREATE TABLE `sessions` (
	`actor_id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`request_token` text,
	`access_token` text,
	`public_token` text,
	`kite_user_id` text,
	`user_name` text,
	`avatar_url` text,
	`login_time` integer,
	`expires_at` integer
);
--> statement-breakpoint
INSERT INTO `sessions` (`actor_id`, `platform`, `platform_user_id`, `request_token`, `access_token`, `public_token`, `kite_user_id`, `user_name`, `avatar_url`, `login_time`, `expires_at`)
SELECT 'telegram:' || `telegram_user_id`, 'telegram', `telegram_user_id`, `request_token`, `access_token`, `public_token`, `kite_user_id`, `user_name`, `avatar_url`, `login_time`, `expires_at`
FROM `sessions_legacy`;
--> statement-breakpoint
DROP TABLE `sessions_legacy`;
--> statement-breakpoint
ALTER TABLE `ai_credits` RENAME TO `ai_credits_legacy`;
--> statement-breakpoint
CREATE TABLE `ai_credits` (
	`actor_id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`credits` integer DEFAULT 10 NOT NULL,
	`total_used` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `ai_credits` (`actor_id`, `platform`, `platform_user_id`, `credits`, `total_used`, `created_at`, `updated_at`)
SELECT 'telegram:' || `telegram_user_id`, 'telegram', `telegram_user_id`, `credits`, `total_used`, `created_at`, `updated_at`
FROM `ai_credits_legacy`;
--> statement-breakpoint
DROP TABLE `ai_credits_legacy`;
--> statement-breakpoint
ALTER TABLE `user_watchlist` RENAME TO `user_watchlist_legacy`;
--> statement-breakpoint
CREATE TABLE `user_watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`instrument` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `user_watchlist` (`id`, `actor_id`, `platform`, `platform_user_id`, `instrument`, `created_at`)
SELECT `id`, 'telegram:' || `telegram_user_id`, 'telegram', `telegram_user_id`, `instrument`, `created_at`
FROM `user_watchlist_legacy`;
--> statement-breakpoint
DROP TABLE `user_watchlist_legacy`;
--> statement-breakpoint
CREATE UNIQUE INDEX `user_watchlist_user_instrument_idx` ON `user_watchlist` (`actor_id`,`instrument`);
--> statement-breakpoint
ALTER TABLE `portfolio_snapshot` RENAME TO `portfolio_snapshot_legacy`;
--> statement-breakpoint
CREATE TABLE `portfolio_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`mf_invested` integer NOT NULL,
	`mf_current` integer NOT NULL,
	`eq_invested` integer NOT NULL,
	`eq_current` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `portfolio_snapshot` (`id`, `actor_id`, `platform`, `platform_user_id`, `mf_invested`, `mf_current`, `eq_invested`, `eq_current`, `created_at`)
SELECT `id`, 'telegram:' || `telegram_user_id`, 'telegram', `telegram_user_id`, `mf_invested`, `mf_current`, `eq_invested`, `eq_current`, `created_at`
FROM `portfolio_snapshot_legacy`;
--> statement-breakpoint
DROP TABLE `portfolio_snapshot_legacy`;
