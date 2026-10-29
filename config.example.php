<?php
// Copy to config.php and keep it outside public access (see README).
return [
    'bot_token' => 'YOUR_BOT_TOKEN',
    'webhook_secret' => 'REPLACE_WITH_RANDOM_SECRET',
    'admins' => [123456789],
    // Must be writable by PHP and outside public_html.
    'state_file' => '/home/CPANEL_USER/hokm-private/state.json',
    'max_tables' => 50,
    'sets_to_win' => 7,
    'inactive_timeout' => 3600,
];
