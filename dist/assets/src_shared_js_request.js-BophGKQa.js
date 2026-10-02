function s(t,r=8e3,i="请求超时，请检查网络"){let e;const o=new Promise((n,m)=>{e=setTimeout(()=>{m(new Error(i))},r)});return Promise.race([t,o]).finally(()=>clearTimeout(e))}export{s as w};
