<?php
declare(strict_types=1);
// Put config.php in ~/hokm-private, not in public_html.
$configFile = dirname(__DIR__).'/hokm-private/config.php';
if (!is_file($configFile)) { http_response_code(500); exit('Configuration missing'); }
$config = require $configFile;
if (!is_array($config) || empty($config['bot_token']) || empty($config['webhook_secret']) || empty($config['state_file']) || $config['webhook_secret']==='REPLACE_WITH_RANDOM_SECRET' || $config['bot_token']==='YOUR_BOT_TOKEN') { http_response_code(500); exit('Configuration invalid'); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
$secret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
if (!hash_equals($config['webhook_secret'], $secret)) { http_response_code(403); exit; }
$raw = file_get_contents('php://input', false, null, 0, 1048577);
if ($raw === false || strlen($raw)>1048576) { http_response_code(400); exit; }
$update=json_decode($raw,true);
if (!is_array($update) || !isset($update['update_id']) || !is_int($update['update_id'])) { http_response_code(400); exit; }
require __DIR__.'/bot.php';
$path=$config['state_file'];
$lock=fopen($path.'.lock','c');
if ($lock===false || !flock($lock,LOCK_EX)) { http_response_code(500); exit('State lock failed'); }
try {
    if (is_file($path)) {
        $state=json_decode((string)file_get_contents($path),true);
        if (!is_array($state) || !isset($state['tables'],$state['stats'],$state['inline'],$state['updates'])) throw new RuntimeException('Invalid state file');
    } else $state=['tables'=>[],'stats'=>['tables'=>0,'started'=>0,'finished'=>0],'inline'=>[],'updates'=>[]];
    if (!in_array($update['update_id'],$state['updates'],true)) {
        foreach ($state['inline'] as $id=>$item) if (time()-$item['created']>86400 && !isset($state['tables'][$id])) unset($state['inline'][$id]);
        handle($update,$state);
        $state['updates'][]=$update['update_id']; $state['updates']=array_slice($state['updates'],-500);
        $json=json_encode($state,JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $temp=tempnam(dirname($path),'hokm-');
        if ($temp===false || file_put_contents($temp,$json,LOCK_EX)===false || !rename($temp,$path)) { if ($temp && is_file($temp)) unlink($temp); throw new RuntimeException('Cannot save state'); }
        chmod($path,0600);
    }
} catch (Throwable $e) { error_log('Hokm webhook error: '.$e->getMessage()); http_response_code(500); }
finally { flock($lock,LOCK_UN); fclose($lock); }
