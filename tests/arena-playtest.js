(() => {
    'use strict';
    const $=id=>document.getElementById(id);
    async function load(){
        const button=$('load');button.disabled=true;
        try{
            const response=await fetch('../arena/index.html');if(!response.ok)throw Error(response.status);
            const wave=Number($('fixture-wave').value),upgrade=$('fixture-upgrade').checked&&wave<12;
            let html=await response.text();
            html=html.replace('<head>',`<head><base href="${new URL('../arena/',location.href).href}">`)
                .replace('<body>',`<body data-test-wave="${wave}" data-test-upgrade="${upgrade}">`)
                .replace('<script src="./game.js?v=1" defer>', '<script src="../tests/arena-fixture.js" defer></script><script src="./game.js?v=1" defer>');
            const size=$('fixture-size').value,frame=$('fixture');frame.style.width=size==='desktop'?'100%':size==='portrait'?'390px':'844px';frame.style.height=size==='desktop'?'950px':size==='portrait'?'844px':'390px';
            frame.srcdoc=html;$('report').textContent=`第 ${wave} 波${upgrade?' / 待選升級':''} · ${size} · 點擊機台「繼續戰役」開始`;
        }catch(e){$('report').textContent=`載入失敗：${e.message}`;}finally{button.disabled=false;}
    }
    $('load').addEventListener('click',load);load();
})();
