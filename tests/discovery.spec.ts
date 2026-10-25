import {test,expect} from '@playwright/test';
test('旧网页搜索端点明确停用，任何输入都不会触发付费搜索',async({request})=>{const r=await request.post('/api/literature/discover',{data:{query:'品牌营销'}});expect(r.status()).toBe(410);expect(await r.text()).toContain('已停用');});
