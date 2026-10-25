import { test, expect } from "@playwright/test";
import {
  parseBibliography,
  importedPaper,
  duplicateOf,
} from "../src/lib/bibliography";
import { emptyLibrary, isLibrary, isPaper } from "../src/lib/literature";
import { parseSnapshot } from "../src/lib/projects";
import {
  emptyWorkflow,
  isWorkflow,
  sourceFingerprint,
  frameworkFingerprint,
} from "../src/lib/workflow";
import {
  combineNetwork,
  networkLayout,
  isCitationGraph,
} from "../src/lib/citation-network";
import type { Project } from "../src/lib/projects";
const at = "2026-10-25T00:00:00Z";
const ris =
  "TY  - JOUR\nTI  - 测试品牌联名研究\nAU  - 张三\nAU  - 李四\nPY  - 2024\nJO  - 测试期刊\nER  -";
const project: Project = {
  id: "a",
  name: "测试项目",
  observation: "品牌联名",
  discipline: "广告学",
  status: "starting",
  createdAt: at,
  updatedAt: at,
};
test("RIS中文多作者/无DOI、BibTeX嵌套、EndNote学位与参考文献部分失败", () => {
  const r = parseBibliography(
    ris + "\n" + ris.replace("测试品牌联名研究", "测试第二篇"),
  );
  expect(r.rows).toHaveLength(2);
  expect(r.rows[0].paper.authors).toEqual(["张三", "李四"]);
  expect(r.rows[0].paper.identity).toBe("imported");
  expect(r.rows[0].paper.doi).toBeNull();
  expect(isPaper(r.rows[0].paper)).toBe(true);
  const b = parseBibliography(
    "@article{x,title={测试{品牌}联名}, author={张三 and 李四},year={2024},journal={测试期刊},doi={10.5555/fixture}}",
  );
  expect(b.rows[0].paper.title).toBe("测试品牌联名");
  expect(b.rows[0].paper.doi).toBe("10.5555/fixture");
  const en = parseBibliography(
    "%0 Thesis\n%T 测试论文\n%A 张三\n%D 2023\n%I 测试大学",
  );
  expect(en.rows[0].paper.kind).toBe("dissertation");
  expect(en.rows[0].paper.venue).toBe("测试大学");
  const refs = parseBibliography(
    "张三；李四. 测试中文论文[J]. 测试期刊, 2024.\n这是一条不能解析的网页介绍",
  );
  expect(refs.rows).toHaveLength(1);
  expect(refs.failures).toHaveLength(1);
  expect(() => parseBibliography("@article{x,title={broken")).toThrow();
});
test("重复识别与保留、译名不自动合并、缺失字段不编造", () => {
  const p = parseBibliography(ris).rows[0].paper;
  const lib = {
    ...emptyLibrary(),
    items: [
      {
        id: "1",
        paper: p,
        categoryIds: [],
        note: "原笔记",
        savedAt: at,
        updatedAt: at,
      },
    ],
  };
  expect(duplicateOf({ ...p, key: "import:new" }, lib)?.id).toBe("1");
  expect(
    duplicateOf({ ...p, title: "Different English title" }, lib),
  ).toBeUndefined();
  const missing = importedPaper({ title: "仅题名" });
  expect(isPaper(missing)).toBe(true);
  expect(missing.year).toBeNull();
  expect(missing.authors).toEqual([]);
  const withDOI = { ...p, doi: "10.5555/test" };
  expect(
    isLibrary({
      ...lib,
      items: [
        { ...lib.items[0], paper: withDOI },
        {
          ...lib.items[0],
          id: "2",
          paper: { ...withDOI, key: "import:other" },
        },
      ],
    }),
  ).toBe(true);
});
test("旧快照原样读取、新字段验证、分析依赖变更且不改用户编辑", () => {
  const raw = JSON.stringify({
    version: 1,
    revision: 2,
    activeId: "a",
    projects: [project],
  });
  expect(parseSnapshot(raw).projects[0]).toEqual(project);
  expect(isWorkflow(emptyWorkflow())).toBe(true);
  expect(sourceFingerprint(project)).toBe(
    sourceFingerprint({ ...project, workflow: emptyWorkflow() }),
  );
  expect(
    isWorkflow({ ...emptyWorkflow(), libraryURL: "javascript:alert(1)" }),
  ).toBe(false);
  const p = { ...project, workflow: emptyWorkflow() };
  expect(sourceFingerprint(p)).not.toBe(
    sourceFingerprint({ ...p, observation: "另一个问题" }),
  );
  expect(frameworkFingerprint(p)).not.toBe(
    frameworkFingerprint({
      ...p,
      workflow: {
        ...p.workflow,
        review: [
          {
            id: "n",
            title: "用户编辑",
            body: "保留",
            evidenceIds: [],
            uncertainty: "待核实",
            x: 0,
            y: 0,
          },
        ],
      },
    }),
  );
  expect(() =>
    parseSnapshot(raw.replace('"version":1', '"version":9')),
  ).toThrow();
});
test("多中心合并保留无匹配节点、不创造边、同DOI二级晋升不复制", () => {
  const a = importedPaper({ title: "测试A", doi: "10.5555/a" }),
    b = importedPaper({ title: "测试B" });
  const center = {
    ...a,
    key: "doi:10.5555/a",
    source: "crossref" as const,
    identity: "verified" as const,
    recordUrl: "https://api.crossref.org/works/10.5555%2Fa",
  };
  const secondary = {
    ...center,
    key: "doi:10.5555/c",
    doi: "10.5555/c",
    title: "测试C",
    recordUrl: "https://api.crossref.org/works/10.5555%2Fc",
  };
  const g = {
    center: center.key,
    papers: [center, secondary],
    edges: [
      { from: center.key, to: secondary.key, recordUrl: center.recordUrl },
    ],
    notices: [],
    retrievedAt: at,
  };
  expect(isCitationGraph(g)).toBe(true);
  expect(
    isCitationGraph({
      ...g,
      edges: [{ ...g.edges[0], recordUrl: "https://evil.invalid" }],
    }),
  ).toBe(false);
  const n = combineNetwork([a, b], [g]);
  expect(n.papers).toHaveLength(3);
  expect(n.edges).toHaveLength(1);
  expect(n.edges[0].from).toBe(a.key);
  expect(combineNetwork([a, b, secondary], [g]).papers).toHaveLength(3);
  expect(combineNetwork([a, b], []).edges).toEqual([]);
  const layout = networkLayout(
    n.papers.map((p) => p.key),
    n.edges,
  );
  expect(layout).toHaveLength(3);
  expect(
    layout.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  ).toBe(true);
});
