<?php
declare(strict_types=1);
require __DIR__.'/../bot.php';
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$t = newTable('TEST','test',1,['chat_id'=>1,'message_id'=>1]);
$t['hakem']=2;
startHand($t);
check(count($t['hands'][2])===5 && count($t['deck'])===47, 'initial deal');
$t['trump']='♠';
while ($t['deck']) for ($i=0;$i<4 && $t['deck'];$i++) if (count($t['hands'][$i])<13) $t['hands'][$i][]=array_pop($t['deck']);
$cards=[];
foreach ($t['hands'] as $hand) { check(count($hand)===13, 'hand size'); foreach ($hand as $c) $cards[]=implode('', $c); }
check(count(array_unique($cards))===52, 'unique cards');
$t['hands'][0]=[['A','♠'],['2','♥']]; $t['lead']='♥';
check(legal($t,0)===[['2','♥']], 'must follow suit');
$t['lead']='♦'; check(count(legal($t,0))===2, 'void suit');
echo "Game tests passed\n";
