import type { Page } from "@playwright/test";
import { importedPaper } from "../../src/lib/bibliography";
import { emptyLibrary } from "../../src/lib/literature";
import { emptyWorkflow, sourceFingerprint } from "../../src/lib/workflow";
const at = "2026-10-27T00:00:00Z";
async function setup(page: Page) {
  const titles = [
    "2022 年 8 月",
    "摘要：越来越多的企业关注测试",
    "2 0 2 5 年 4 月",
    "一、引言",
    "短视频测试题名：",
  ];
  const items = titles.map((title, i) => ({
    id: `p${i}`,
    paper: importedPaper({ title, authors: ["待核对"] }),
    categoryIds: [],
    note: `保留笔记${i}`,
    savedAt: at,
    updatedAt: at,
    attachment: {
      id: `pdf${i}`,
      name: `测试PDF${i}.pdf`,
      pages: 3,
      characters: 200,
      updatedAt: at,
    },
  }));
  const p = {
    id: "a",
    name: "PDF合成验收项目",
    observation: "测试问题，不是真实论文",
    discipline: "广告学",
    status: "starting" as const,
    createdAt: at,
    updatedAt: at,
    library: { ...emptyLibrary(), items },
    workflow: emptyWorkflow(),
  };
  p.workflow.analyses = [
    {
      id: "old-reading",
      kind: "reading",
      fingerprint: sourceFingerprint(p),
      sourceIds: ["p0"],
      createdAt: at,
      sections: [
        {
          title: "30 秒读懂",
          body: "历史测试解释，需保留",
          evidenceIds: ["p0"],
          quote: "",
          page: null,
          uncertainty: "仅测试",
        },
      ],
    },
  ];
  await page.goto("/");
  await page.evaluate(
    async ({ p, at }) => {
      localStorage.setItem(
        "paperi.projects.v1",
        JSON.stringify({
          version: 1,
          revision: 0,
          activeId: "a",
          projects: [
            p,
            {
              ...p,
              id: "b",
              name: "其他项目",
              library: undefined,
              workflow: undefined,
            },
          ],
        }),
      );
      const req = indexedDB.open("paperi.files.v1", 1);
      const db = await new Promise<IDBDatabase>((res, rej) => {
        req.onupgradeneeded = () => {
          const s = req.result.createObjectStore("pdfs", { keyPath: "id" });
          s.createIndex("projectId", "projectId");
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = db.transaction("pdfs", "readwrite");
      for (let i = 0; i < 5; i++)
        tx.objectStore("pdfs").put({
          id: `pdf${i}`,
          projectId: "a",
          name: `测试PDF${i}.pdf`,
          blob: new Blob(["%PDF-synthetic-original"], {
            type: "application/pdf",
          }),
          pages: [
            "题目：合成测试的研究关系\n作者：张三、李四\n摘要：本页仅验证产品流程，非真实学术成果。\n邮箱：private@example.invalid",
            "研究方法：合成测试，没有真实样本。",
            "研究结果：合成关系未获支持。结论：不能证明因果。",
          ],
          updatedAt: at,
        });
      await new Promise<void>((res) => (tx.oncomplete = () => res()));
      db.close();
    },
    { p, at },
  );
  await page.goto("/literature");
}
export { setup };
