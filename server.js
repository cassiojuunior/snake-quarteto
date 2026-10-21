const http=require('http'),WebSocket=require('ws'),crypto=require('crypto');
const fs=require('fs'),path=require('path'),PORT=process.env.PORT||3000;
const W=2400,H=1600,rooms=new Map(),colors=['#64f5c5','#ffcc70','#ff77b7','#92a9ff'];
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname; if(p==='/')p='/index.html'; if(p!=='/index.html'){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)});
const wss=new WebSocket.Server({server});
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
function feed(r,x=rnd(35,W-35),y=rnd(35,H-35),value=1){r.food.push({x,y,value,h:Math.floor(rnd(0,360))})}
function send(w,o){if(w.readyState===1)w.send(JSON.stringify(o))}
function cast(r,o){for(const p of r.players.values())send(p.ws,o)}
function spawn(p,r){let pos;for(let i=0;i<40;i++){pos={x:rnd(120,W-120),y:rnd(120,H-120)};if([...r.players.values()].every(q=>q===p||!q.alive||dist(pos,q)>50000))break}Object.assign(p,{...pos,angle:rnd(-3,3),target:0,len:125,score:0,boost:false,alive:true,trail:[],shield:Date.now()+2400});p.target=p.angle}
function die(r,p,by){if(!p.alive)return;p.alive=false;for(let i=0;i<p.trail.length;i+=4)feed(r,p.trail[i].x,p.trail[i].y,2);if(by)by.score+=25;send(p.ws,{type:'dead',killer:by?.name||'a parede',score:Math.floor(p.score)});cast(r,{type:'notice',message:p.name+' foi eliminado!'})}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='join'&&!ws.room){let code=String(m.room||'').toUpperCase();if(!/^[A-Z0-9]{4,10}$/.test(code))return send(ws,{type:'error',message:'Código inválido'});let r=rooms.get(code);if(!r){r={players:new Map(),food:[]};for(let i=0;i<155;i++)feed(r);rooms.set(code,r)}if(r.players.size>=4)return send(ws,{type:'error',message:'Sala cheia (4 jogadores)'});let slot=[0,1,2,3].find(x=>![...r.players.values()].some(p=>p.slot===x));let p={id:crypto.randomUUID(),name:String(m.name||'Cobrinha').slice(0,18).replace(/[<>]/g,''),ws,slot,color:colors[slot]};r.players.set(p.id,p);ws.room=code;ws.player=p.id;spawn(p,r);send(ws,{type:'welcome',id:p.id,room:code});cast(r,{type:'notice',message:p.name+' entrou!'});return}
let r=rooms.get(ws.room),p=r?.players.get(ws.player);if(!p)return;
if(m.type==='input'){if(Number.isFinite(m.angle))p.target=m.angle;p.boost=!!m.boost}
if(m.type==='respawn'&&!p.alive)spawn(p,r)
});
ws.on('close',()=>{let r=rooms.get(ws.room);if(!r)return;r.players.delete(ws.player);if(!r.players.size)rooms.delete(ws.room)});ws.on('error',()=>{})});
setInterval(()=>{for(let r of rooms.values()){let ps=[...r.players.values()],now=Date.now();for(let p of ps){if(!p.alive)continue;let a=Math.atan2(Math.sin(p.target-p.angle),Math.cos(p.target-p.angle));p.angle+=Math.max(-.16,Math.min(.16,a));let boosting=p.boost&&p.len>65,step=boosting?7:3.7;p.x+=Math.cos(p.angle)*step;p.y+=Math.sin(p.angle)*step;p.trail.unshift({x:p.x,y:p.y});p.trail.length=Math.min(p.trail.length,Math.max(12,Math.floor(p.len/4)));if(boosting){p.len-=.24;p.score=Math.max(0,p.score-.025)}if(p.x<14||p.y<14||p.x>W-14||p.y>H-14){die(r,p);continue}for(let i=r.food.length-1;i>=0;i--)if(dist(p,r.food[i])<440){p.len+=r.food[i].value*4;p.score+=r.food[i].value*10;r.food.splice(i,1)}}
for(let p of ps){if(!p.alive||now<p.shield)continue;for(let q of ps){if(!q.alive)continue;for(let i=p===q?16:5;i<q.trail.length;i+=3){if(dist(p,q.trail[i])<380){die(r,p,p===q?null:q);break}}if(!p.alive)break}}
while(r.food.length<155)feed(r);if(r.food.length>450)r.food.splice(0,r.food.length-450);
cast(r,{type:'state',players:ps.map(p=>({id:p.id,name:p.name,color:p.color,x:p.x,y:p.y,angle:p.angle,trail:p.trail,score:Math.floor(p.score),alive:p.alive,shield:now<p.shield})),food:r.food})}},50);
server.listen(PORT,'0.0.0.0',()=>console.log('Snake Quarteto listening on '+PORT));