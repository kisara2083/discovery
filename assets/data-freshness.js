'use strict';
(function(){
  const fetchIncremental=window.discoveryIncrementalFetch;
  if(typeof fetchIncremental!=='function')return;
  window.discoveryIncrementalFetch=function(url){
    const separator=url.includes('?')?'&':'?';
    return fetchIncremental(url+separator+'fresh='+Date.now());
  };
})();
