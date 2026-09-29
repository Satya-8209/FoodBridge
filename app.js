const names={home:"FoodBridge Overview",fresh:"Fund Fresh Meals",event:"Event / Wedding Food",ratings:"Restaurant Ratings",volunteer:"Volunteer Map",memory:"Hindsight Memory"};
const sessionId=crypto.randomUUID();
let currentPage="home";
function page(id){currentPage=id;document.querySelectorAll(".pg").forEach(x=>x.classList.toggle("active",x.id===id));document.getElementById("title").textContent=names[id];scrollTo(0,0)}
const m=document.getElementById("meals"),p=document.getElementById("price");
function calc(){document.getElementById("total").textContent=(+m.value*+p.value).toLocaleString("en-IN")}
m.oninput=p.oninput=calc;
function recommend(t){let id=t==="fresh"?"freshResult":"eventResult",el=document.getElementById(id);el.innerHTML=t==="fresh"?"🧠 <b>Hope Foundation — 94% match.</b> Previous evening deliveries and NGO reviews indicate a strong fit.":"🎉 <b>Care NGO is ready.</b> A volunteer will be requested first; if none is available, the NGO will be asked to collect directly from the restaurant/event."}
function accept(b){b.textContent="Accepted ✓";b.disabled=true}
function vibrate(){if(navigator.vibrate)navigator.vibrate([200,100,300,100,500]);alert("🔔 Reminder sent. Vibration requested on supported mobile browsers.")}
function openChat(){document.getElementById("chat").classList.remove("hidden");setTimeout(()=>document.getElementById("q").focus(),50);if(!document.getElementById("msgs").dataset.greeted){document.getElementById("msgs").dataset.greeted="1";addBot("👋 Hi! I’m <b>FoodBridge AI</b>. I can help you donate food, fund fresh meals, find restaurants or NGOs, arrange pickups, understand the dashboard, and explain how FoodBridge works.<br><br>What would you like to do today?");}}
function closeChat(){document.getElementById("chat").classList.add("hidden")}
function addBot(text,meta=""){const box=document.getElementById("msgs");box.insertAdjacentHTML("beforeend",`<p class="bot">${text}${meta?`<small class="ai-meta">${meta}</small>`:""}</p>`);box.scrollTop=box.scrollHeight}
function addUser(text){const box=document.getElementById("msgs");box.insertAdjacentHTML("beforeend",`<p class="user">${escapeHtml(text)}</p>`);box.scrollTop=box.scrollHeight}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]))}
function quick(text){document.getElementById("q").value=text;document.getElementById("q").form.requestSubmit()}
async function ask(e){e.preventDefault();let q=document.getElementById("q"),v=q.value.trim();if(!v)return;addUser(v);q.value="";addBot("Thinking with FoodBridge memory… <span class='typing'>● ● ●</span>");const loading=document.getElementById("msgs").lastElementChild;try{const r=await fetch("/.netlify/functions/chat", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:v,sessionId,page:currentPage})});const data=await r.json();loading.remove();addBot(formatAnswer(data.answer),data.memoryUsed?"🧠 Hindsight memory used":"AI assistant");}catch(err){loading.remove();addBot("I’m having trouble reaching the AI service right now. You can still use the FoodBridge dashboards, or try again in a moment.");}}
function formatAnswer(text){return escapeHtml(String(text||"Sorry, I couldn't answer that.")).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>")}
let rn="";
function rate(n){rn=n;document.getElementById("rname").textContent=n;document.getElementById("modal").classList.remove("hidden")}
function closeRate(){document.getElementById("modal").classList.add("hidden")}
async function saveRate(){const review=document.getElementById("review").value.trim();if(!review)return alert("Please write a review first.");try{await fetch("/api/memory/retain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:`NGO review: Restaurant ${rn}. Review: ${review}`})});document.getElementById("saved").textContent="✓ Review sent to the FoodBridge Hindsight memory workflow.";document.getElementById("review").value="";setTimeout(closeRate,900)}catch(e){alert("Could not save the review.")}}
