'use strict';
const detailEditorialBackfill={
  'a-6b2410cf19c11c79326fea09':'生息演算「新たな礎」は、通常のステージ攻略とは別に、ステージ内で資源を集め、その資源から設備を作って攻略に活用していく常設ゲームモード。戦闘だけでなく、どの資源を確保し、どの設備や強化へ回すかという準備と資源管理も進行の一部になる。\n\n攻略で得たスコアは「統括ポイント」となり、外勤・資源・初期の各系統のノードを解放して、採集や戦闘を進めやすくしていく。建設素材を集めて本部を強化する要素もあり、1ステージごとのクリアだけでなく、モード内の成長を積み上げながら進める構成。\n\n「新たな礎」は2026年10月28日に開始し、理性を消費せず繰り返し挑戦できる。イベントアイテム「作業検収書」を集めることで、マウンテン専用コーデ「ハードコアライダー」などを入手でき、ロドス購買部出張所の報酬は月初に更新される。'
};
const baseDetailRenderer=detail;
detail=function(a){
  const backfill=detailEditorialBackfill[a.id];
  return baseDetailRenderer(backfill&&!a.public_detail?{...a,public_detail:backfill}:a);
};
