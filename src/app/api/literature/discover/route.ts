// Kept as an explicit tombstone for old clients. This route never calls a search provider.
export async function POST(){return Response.json({error:'Paperi 已改为用户从学校数据库检索并导入题录；本站网页搜索已停用。'},{status:410});}
