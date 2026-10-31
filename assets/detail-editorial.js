'use strict';
const detailEditorialBackfill={
  'a-6b2410cf19c11c79326fea09':'生息演算は、通常のステージ攻略とは別に、マップを探索して資源や食料を集め、集めた素材で設備や支援道具を作りながら攻略を進めるゲームモード。採集・狩猟・戦闘を進めつつ、拠点や防衛環境を整えていくため、通常ステージよりも資源管理と準備の比重が大きい。\n\n「新たな礎」は2026年10月28日に始まった常設コンテンツで、理性を消費せず繰り返し挑戦できる。ステージ内で得た素材は設備の作成や攻略に使い、進行で得るポイントによって各種強化を解放していく。\n\n今回の報酬軸はイベントアイテム「作業検収書」。集めることでマウンテン専用コーデ「ハードコアライダー」などを入手でき、ロドス購買部出張所の報酬は月初に更新される。'
};
const baseDetailRenderer=detail;
detail=function(a){
  const backfill=detailEditorialBackfill[a.id];
  return baseDetailRenderer(backfill&&!a.public_detail?{...a,public_detail:backfill}:a);
};
