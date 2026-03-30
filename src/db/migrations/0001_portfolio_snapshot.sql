CREATE TABLE `portfolio_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_user_id` text NOT NULL,
	`mf_invested` integer NOT NULL,
	`mf_current` integer NOT NULL,
	`eq_invested` integer NOT NULL,
	`eq_current` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
