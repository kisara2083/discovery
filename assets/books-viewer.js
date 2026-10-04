'use strict';
const bookID=new URLSearchParams(location.search).get('id');const preview=document.getElementById('preview');
const failed=()=>{preview.textContent='プレビューを表示できません。記事の公式ページをご利用ください。';};
if(!/^[A-Za-z0-9_-]{6,40}$/.test(bookID||'')){failed();}else{const loader=document.createElement('script');loader.src='https://www.google.com/books/jsapi.js';loader.addEventListener('error',failed);loader.addEventListener('load',()=>{try{google.books.load();google.books.setOnLoadCallback(()=>{try{preview.textContent='';preview.style.height='480px';const viewer=new google.books.DefaultViewer(preview);viewer.load(bookID,failed);}catch(e){failed();}});}catch(e){failed();}});document.head.append(loader);}
