import {test,expect} from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3107'});
test('三轮真实本地HTTP串联：第二三轮缺可选内容仍保存；第四轮错阶段保留聊天并刷新恢复（非真实DeepSeek）',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByLabel('项目名称').fill('多轮协议回归');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.goto('/lab');
 const bodies: {stage:string;messages:{role:string;content:string}[];seed:unknown}[]=[];
 page.on('request',r=>{if(r.url().endsWith('/api/lab')&&r.method()==='POST')bodies.push(r.postDataJSON());});
 for(let turn=1;turn<=3;turn++){await page.getByLabel('给 AI 的消息').fill(`LAB_TURN_${turn}`);await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.locator('.chat-assistant')).toHaveCount(turn);}
 expect(bodies.map(b=>b.stage)).toEqual(['phenomenon','phenomenon','phenomenon']);expect(bodies.map(b=>b.messages.length)).toEqual([1,3,5]);expect(bodies[2].messages[1].role).toBe('assistant');expect(bodies[2].seed).toBeNull();
 await page.getByLabel('给 AI 的消息').fill('LAB_BAD_STAGE');await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('guide.stage');await expect(page.locator('.chat-assistant')).toHaveCount(3);await expect(page.locator('.chat-user')).toHaveCount(4);expect(bodies).toHaveLength(4);
 await page.reload();await expect(page.locator('.chat-assistant')).toHaveCount(3);await expect(page.locator('.chat-user')).toHaveCount(4);expect(bodies).toHaveLength(4);
 const p=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('paperi.projects.v1')!);return s.projects.find((p:{id:string})=>p.id===s.activeId);});expect(p.exploration.seed).toBeNull();expect(p.exploration.navigation.stage).toBe('phenomenon');expect(p.exploration.messages).toHaveLength(7);
});
test('实际HTTP仍拒绝缺阶段及伪造来源（本地模拟）',async({request})=>{
 for(const text of ['LAB_NO_STAGE','LAB_BAD_REFERENCE']){const r=await request.post('/api/lab',{headers:{Origin:'http://127.0.0.1:3107'},data:{messages:[{role:'user',content:text}],stage:'phenomenon',seed:null,observation:''}});expect(r.status()).toBe(502);expect(await r.text()).toContain(text==='LAB_NO_STAGE'?'guide.stage':'未提供的文献');}
});
