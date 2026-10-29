<?php
declare(strict_types=1);

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function api(string $method, array $args): ?array {
    global $config, $telegramError;
    $telegramError = null;
    $ch = curl_init('https://api.telegram.org/bot'.$config['bot_token'].'/'.$method);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($args, JSON_UNESCAPED_UNICODE), CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12]);
    $raw = curl_exec($ch);
    $result = $raw === false ? null : json_decode($raw, true);
    if (!is_array($result) || empty($result['ok'])) {
        $telegramError = $result['description'] ?? 'network error';
        // Never log the request URL, which contains the bot token.
        error_log('Telegram '.$method.' failed: '.($result['description'] ?? 'network error'));
        return null;
    }
    return $result['result'] ?? [];
}
function button(string $text, string $data): array { return ['text'=>$text, 'callback_data'=>$data]; }
function target(array $t): array {
    return isset($t['inline_id']) ? ['inline_message_id'=>$t['inline_id']] : ['chat_id'=>$t['chat_id'], 'message_id'=>$t['message_id']];
}
function tableText(array $t): string {
    global $config;
    $names = [];
    foreach ($t['players'] as $i => $p) $names[] = ($i+1).':'.($p['name'] ?? '—');
    $s = "🎴 میز حکم «{$t['title']}»\nشناسه: {$t['id']}\n".implode(' | ', $names)."\n";
    if ($t['finished']) $s .= $t['winner'] === null ? 'بازی متوقف شد.' : '🏁 برنده: تیم '.($t['winner']+1);
    elseif (!$t['started']) $s .= 'در انتظار بازیکنان و شروع';
    elseif ($t['trump'] === null) $s .= 'حاکم: '.$t['players'][$t['hakem']]['name'].' — انتخاب حکم';
    else {
        $s .= 'حکم: '.$t['trump'].' | نوبت: '.$t['players'][$t['turn']]['name']."\nتریک‌ها: {$t['tricks'][0]} – {$t['tricks'][1]}";
        foreach ($t['plays'] as $seat=>$card) $s .= "\n".$t['players'][$seat]['name'].': '.$card[0].$card[1];
    }
    return $s."\nست‌ها: {$t['sets'][0]} – {$t['sets'][1]} (تا {$config['sets_to_win']})";
}
function tableKeyboard(array $t): array {
    $id = $t['id']; $rows = [];
    if (!$t['started'] && !$t['finished']) {
        for ($i=0;$i<4;$i+=2) {
            $row=[]; for ($j=$i;$j<$i+2;$j++) $row[]=button('صندلی '.($j+1).' '.($t['players'][$j]['name'] ?? '➕'), "join|$id|$j");
            $rows[]=$row;
        }
        $rows[]=[button('شروع ▶️',"start|$id"),button('خروج 🚪',"leave|$id")];
        $rows[]=[button('لغو ❌',"cancel|$id")];
    } elseif ($t['finished']) $rows[]=[button('بستن میز',"close_finished|$id")];
    else {
        if ($t['trump'] === null) { $row=[]; foreach (SUITS as $s) $row[]=button($s,"trump|$id|$s"); $rows[]=$row; }
        $rows[]=[button('خروج از بازی 🚪',"leave|$id")];
    }
    return ['inline_keyboard'=>$rows];
}
function refresh(array $t): void { api('editMessageText', target($t)+['text'=>tableText($t), 'reply_markup'=>tableKeyboard($t)]); }
function newTable(string $id, string $title, int $creator, array $target): array {
    return $target+['id'=>$id,'title'=>$title,'creator'=>$creator,'players'=>array_fill(0,4,null),'started'=>false,'finished'=>false,'winner'=>null,'hakem'=>null,'trump'=>null,'turn'=>null,'deck'=>[],'hands'=>[[],[],[],[]],'plays'=>[],'lead'=>null,'leader'=>0,'tricks'=>[0,0],'sets'=>[0,0],'dm'=>[],'created'=>time(),'activity'=>time()];
}
function startHand(array &$t): void {
    $deck=[]; foreach (SUITS as $s) foreach (RANKS as $r) $deck[]=[$r,$s];
    // Fisher-Yates with a cryptographically secure random source.
    for ($i=count($deck)-1;$i>0;$i--) { $j=random_int(0,$i); [$deck[$i],$deck[$j]]=[$deck[$j],$deck[$i]]; }
    $t['deck']=$deck; $t['hands']=[[],[],[],[]];
    for ($i=0;$i<5;$i++) $t['hands'][$t['hakem']][]=array_pop($t['deck']);
    $t['trump']=null; $t['turn']=$t['hakem']; $t['leader']=$t['hakem']; $t['lead']=null; $t['plays']=[]; $t['tricks']=[0,0];
}
function legal(array $t, int $seat): array {
    $hand=$t['hands'][$seat];
    if ($t['lead'] === null) return $hand;
    $follow=array_values(array_filter($hand, fn($c)=>$c[1]===$t['lead']));
    return $follow ?: $hand;
}
function sendHands(array &$t): void {
    global $telegramError;
    foreach ($t['players'] as $seat=>$p) {
        if (!$p) continue;
        $text="🎴 میز «{$t['title']}» | صندلی ".($seat+1)."\n"; $rows=[];
        if ($t['finished']) $text .= $t['winner'] === null ? 'بازی متوقف شد.' : '🏁 برنده: تیم '.($t['winner']+1);
        elseif ($t['trump'] === null) $text .= $seat === $t['hakem'] ? '۵ کارت اولیه شما؛ حکم را روی میز انتخاب کنید.' : 'در انتظار انتخاب حکم.';
        else $text .= 'حکم: '.$t['trump'].($seat === $t['turn'] ? ' | نوبت شماست' : ' | منتظر بمانید');
        if (!$t['finished']) {
            $text.="\nدست شما: "; foreach ($t['hands'][$seat] as $c) $text.=$c[0].$c[1].' ';
            if ($t['trump'] !== null && $seat === $t['turn']) {
                $buttons=[]; foreach (legal($t,$seat) as $c) $buttons[]=button($c[0].$c[1], 'play|'.$t['id'].'|'.$seat.'|'.$c[0].'_'.$c[1]);
                $rows=array_chunk($buttons,5);
            }
        }
        $args=['chat_id'=>$p['id'],'text'=>$text,'reply_markup'=>['inline_keyboard'=>$rows]];
        if (isset($t['dm'][$p['id']])) {
            $res=api('editMessageText', $args+['message_id'=>$t['dm'][$p['id']]]);
            // Replace a deleted or uneditable message, but not a transient failure or unchanged message.
            if ($res === null && $telegramError !== null && (str_contains($telegramError, 'message to edit not found') || str_contains($telegramError, "message can't be edited"))) {
                unset($t['dm'][$p['id']]);
            }
        }
        if (!isset($t['dm'][$p['id']])) { $res=api('sendMessage',$args); if (isset($res['message_id'])) $t['dm'][$p['id']]=$res['message_id']; }
    }
}
function cleanup(array &$state, bool $force=false): int {
    global $config; $count=0;
    foreach ($state['tables'] as $id=>$t) if ((!$t['started'] && ($force || time()-$t['created']>$config['inactive_timeout'])) || ($t['finished'] && time()-$t['activity']>$config['inactive_timeout'])) {
        api('editMessageText',target($t)+['text'=>'🎴 میز «'.$t['title'].'» بسته شد.']); unset($state['tables'][$id]); $count++;
    }
    return $count;
}
function handle(array $u, array &$state): void {
    global $config;
    if (isset($u['inline_query'])) {
        $q=$u['inline_query']; $id=bin2hex(random_bytes(8));
        // Store title server-side; callback data must stay below Telegram's 64-byte limit.
        $title=trim($q['query'] ?? '') ?: 'میز جدید حکم'; $title=mb_substr($title,0,80);
        $state['inline'][$id]=['title'=>$title,'created'=>time()];
        api('answerInlineQuery',['inline_query_id'=>$q['id'],'cache_time'=>0,'is_personal'=>true,'results'=>[['type'=>'article','id'=>$id,'title'=>'ایجاد میز: '.$title,'input_message_content'=>['message_text'=>'🎴 ایجاد میز حکم: «'.$title.'»'],'reply_markup'=>['inline_keyboard'=>[[button('ساخت میز',"inline_create|$id")]]]]]]); return;
    }
    if (isset($u['message']['text'])) {
        $m=$u['message']; $chat=$m['chat']['id']; $uid=$m['from']['id'] ?? 0;
        if (!preg_match('~^/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$~isu',trim($m['text']),$match)) return;
        $cmd=strtolower($match[1]); $arg=trim($match[2] ?? ''); $text='';
        if ($cmd==='table') {
            cleanup($state); if (count($state['tables']) >= $config['max_tables']) $text='سقف میزها پر است.';
            else {
                do { $id=strtoupper(bin2hex(random_bytes(4))); } while (isset($state['tables'][$id]));
                $t=newTable($id,mb_substr($arg ?: 'میز جدید حکم',0,80),$uid,['chat_id'=>$chat,'message_id'=>0]);
                $msg=api('sendMessage',['chat_id'=>$chat,'text'=>tableText($t),'reply_markup'=>tableKeyboard($t)]);
                if (isset($msg['message_id'])) { $t['message_id']=$msg['message_id']; $state['tables'][$id]=$t; $state['stats']['tables']++; }
                return;
            }
        } elseif ($cmd==='id') $text="🆔 User ID: $uid";
        elseif (in_array($cmd,['start','help','rules'],true)) $text="🎴 بازی حکم\n/table عنوان — ساخت میز\n/id — شناسه شما\n/rules — قوانین\nچهار بازیکن روی صندلی‌ها بنشینند؛ صندلی‌های روبرو هم‌تیمی هستند. همه باید ابتدا ربات را در پیام خصوصی /start کنند. حاکم پنج کارت می‌بیند و حکم را انتخاب می‌کند. پیروی از خال اجباری است؛ حکم بر خال‌های دیگر برتری دارد. پس از ۱۳ تریک تیم برنده یک ست می‌گیرد.";
        elseif (in_array($cmd,['admin','close','cleanup','broadcast'],true)) {
            if (!in_array($uid,$config['admins'],true)) $text='دسترسی ندارید.';
            elseif ($cmd==='admin') { $text="📊 میزها: ".count($state['tables'])."\nساخته‌شده: {$state['stats']['tables']} | شروع: {$state['stats']['started']} | پایان: {$state['stats']['finished']}"; foreach (array_slice($state['tables'],0,30) as $t) $text.="\n{$t['id']} | {$t['title']}"; $text.="\n/close ID | /cleanup | /broadcast متن"; }
            elseif ($cmd==='cleanup') $text='میزهای پاک‌شده: '.cleanup($state,true);
            elseif ($cmd==='close') { $id=strtoupper($arg); if (!isset($state['tables'][$id])) $text='میز یافت نشد.'; else { api('editMessageText',target($state['tables'][$id])+['text'=>'میز توسط ادمین بسته شد.']); unset($state['tables'][$id]); $text='میز بسته شد.'; } }
            elseif ($arg==='') $text='استفاده: /broadcast متن';
            else { $chats=[]; foreach ($state['tables'] as $t) if (isset($t['chat_id'])) $chats[$t['chat_id']]=true; $ok=0; foreach (array_keys($chats) as $c) if (api('sendMessage',['chat_id'=>$c,'text'=>"📢 پیام ادمین:\n".$arg]) !== null) $ok++; $text="ارسال‌شده: $ok از ".count($chats); }
        } else return;
        api('sendMessage',['chat_id'=>$chat,'text'=>$text]); return;
    }
    if (!isset($u['callback_query'])) return;
    $q=$u['callback_query']; $parts=explode('|',$q['data'] ?? ''); $action=$parts[0]; $id=$parts[1] ?? ''; $uid=$q['from']['id'];
    $answer=function(string $text='', bool $alert=false) use ($q): void { api('answerCallbackQuery',['callback_query_id'=>$q['id'],'text'=>$text,'show_alert'=>$alert]); };
    if ($action==='inline_create') {
        if (!isset($state['inline'][$id])) { $answer('این دعوت منقضی شده است.',true); return; }
        if (!isset($state['tables'][$id])) {
            cleanup($state); if (count($state['tables']) >= $config['max_tables']) { $answer('سقف میزها پر است.',true); return; }
            if (isset($q['inline_message_id'])) $where=['inline_id'=>$q['inline_message_id']];
            elseif (isset($q['message'])) $where=['chat_id'=>$q['message']['chat']['id'],'message_id'=>$q['message']['message_id']];
            else { $answer('پیام نامعتبر است.',true); return; }
            $state['tables'][$id]=newTable($id,$state['inline'][$id]['title'],$uid,$where); $state['stats']['tables']++;
        }
        $answer('میز ساخته شد.'); refresh($state['tables'][$id]); return;
    }
    if (!isset($state['tables'][$id])) { $answer('میز وجود ندارد.',true); return; }
    $t=&$state['tables'][$id]; $seat=null; foreach ($t['players'] as $i=>$p) if ($p && $p['id']===$uid) $seat=$i;
    $error=''; $hands=false; $notice='';
    if ($action==='join') {
        $n=filter_var($parts[2] ?? null,FILTER_VALIDATE_INT);
        if ($t['started'] || $t['finished'] || $n===false || $n<0 || $n>3) $error='صندلی نامعتبر است.';
        elseif ($t['players'][$n] && $t['players'][$n]['id']!==$uid) $error='صندلی پر است.';
        else { if ($seat!==null) $t['players'][$seat]=null; $t['players'][$n]=['id'=>$uid,'name'=>mb_substr($q['from']['first_name'] ?? 'بازیکن',0,40)]; }
    } elseif ($action==='leave') {
        if ($seat===null) $error='شما روی صندلی نیستید.'; else { $t['players'][$seat]=null; if ($t['started'] && !$t['finished']) { $t['finished']=true; $hands=true; } }
    } elseif ($action==='cancel' || $action==='close_finished') {
        if ($action==='cancel' && ($t['started'] || ($uid!==$t['creator'] && !in_array($uid,$config['admins'],true)))) $error='اجازه لغو ندارید.';
        elseif ($action==='close_finished' && !$t['finished']) $error='بازی تمام نشده است.';
        else { api('editMessageText',target($t)+['text'=>'🎴 میز بسته شد.']); unset($state['tables'][$id]); $answer('میز بسته شد.'); return; }
    } elseif ($action==='start') {
        if ($t['started'] || $t['finished'] || count(array_filter($t['players']))!==4 || $seat===null) $error='چهار بازیکن لازم است.';
        else { $t['started']=true; $t['hakem']=random_int(0,3); startHand($t); $state['stats']['started']++; $hands=true; }
    } elseif ($action==='trump') {
        $s=$parts[2] ?? ''; if (!$t['started'] || $t['finished'] || $t['trump']!==null || $seat!==$t['hakem'] || !in_array($s,SUITS,true)) $error='انتخاب حکم مجاز نیست.';
        else { $t['trump']=$s; while ($t['deck']) for ($i=0;$i<4 && $t['deck'];$i++) if (count($t['hands'][$i])<13) $t['hands'][$i][]=array_pop($t['deck']); $hands=true; }
    } elseif ($action==='play') {
        $n=filter_var($parts[2] ?? null,FILTER_VALIDATE_INT); $card=explode('_',$parts[3] ?? '');
        if (!$t['started'] || $t['finished'] || $t['trump']===null || $n===false || $n<0 || $n>3 || $seat!==$n || $t['turn']!==$n || count($card)!==2 || !in_array($card,legal($t,$n),true)) $error='کارت یا نوبت نامعتبر است.';
        else {
            $idx=array_search($card,$t['hands'][$n],true); array_splice($t['hands'][$n],$idx,1); $t['plays'][$n]=$card; if ($t['lead']===null) $t['lead']=$card[1]; $t['turn']=($n+1)%4;
            if (count($t['plays'])===4) {
                $best=-1; $winner=$t['leader']; foreach ($t['plays'] as $pseat=>$c) { $value=($c[1]===$t['trump'] ? 26 : ($c[1]===$t['lead'] ? 13 : 0))+array_search($c[0],RANKS,true); if ($value>$best) { $best=$value; $winner=(int)$pseat; } }
                $t['tricks'][$winner%2]++; $t['plays']=[]; $t['lead']=null; $t['leader']=$winner; $t['turn']=$winner;
                if (array_sum($t['tricks'])===13) { $team=$t['tricks'][0]>$t['tricks'][1] ? 0 : 1; $score=$t['tricks'][$team]; $t['sets'][$team]++; $notice='✅ تیم '.($team+1).' دست را با '.$score.' تریک برد.'; if ($t['sets'][$team]>=$config['sets_to_win']) { $t['finished']=true; $t['winner']=$team; $state['stats']['finished']++; } else { $t['hakem']=$winner; startHand($t); } }
            }
            $hands=true;
        }
    } else $error='درخواست نامعتبر.';
    if ($error!=='') { $answer($error,true); return; }
    $t['activity']=time(); $answer('✅'); refresh($t); if ($notice!=='' && isset($t['chat_id'])) api('sendMessage',['chat_id'=>$t['chat_id'],'text'=>$notice]); if ($hands) sendHands($t);
}
