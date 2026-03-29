CREATE TABLE `ai_credits` (
	`telegram_user_id` text PRIMARY KEY NOT NULL,
	`credits` integer DEFAULT 10 NOT NULL,
	`total_used` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`telegram_user_id` text PRIMARY KEY NOT NULL,
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
CREATE TABLE `user_watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_user_id` text NOT NULL,
	`instrument` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_watchlist_user_instrument_idx` ON `user_watchlist` (`telegram_user_id`,`instrument`);