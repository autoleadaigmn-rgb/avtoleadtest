const shop=new URLSearchParams(location.search).get('shop')==='cedar-ridge'?'cedar-ridge':'bayline';
document.getElementById('shop-label').textContent=shop==='bayline'?'Bayline Auto Care · fictional Houston shop':'Cedar Ridge Garage · fictional Phoenix shop';
document.getElementById('install-code').textContent=`<script async src="${location.origin}/loader.js" data-shop="${shop}"><\/script>`;
const loader=document.createElement('script');loader.async=true;loader.src='/loader.js';loader.dataset.shop=shop;document.body.append(loader);
