const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const frontendRequire = createRequire(path.resolve("package.json"));
const ts = frontendRequire("typescript");
const {
  parseTestReferences,
  collectTestReferences,
} = require("./frontend_scenarios.cjs");

function parse(text) {
  return parseTestReferences({ path: "frontend/src/demo.test.tsx", text }, ts);
}

test("reads literal IDs on actual Jest tests, including multiple IDs", () => {
  const report = parse(`test("[DEMO-R1.1, DEMO-R1.2] saves", () => {});`);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(
    report.references.map((reference) => reference.id),
    ["DEMO-R1.1", "DEMO-R1.2"],
  );
  assert.equal(report.references[0].line, 1);
});

test("recognizes parameterized suites, tests, and tagged tables", () => {
  const report = parse(`
describe.each([[1]])("suite", () => {
  test.each([[1]])("[DEMO-R1.1] saves %s", () => {});
  it.each\`value\n\${1}\`('[DEMO-R1.2] saves $value', function () {});
});`);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(
    report.references.map((reference) => reference.id),
    ["DEMO-R1.1", "DEMO-R1.2"],
  );
});

test("does not count comments, strings, or describe titles", () => {
  const report = parse(`
// test("[DEMO-R1.1] saves", () => {});
const example = 'test("[DEMO-R1.1] saves", () => {})';
describe("[DEMO-R1.1] suite", () => { test("unmarked", () => {}); });`);
  assert.deepEqual(report, { references: [], problems: [] });
});

test("does not count skipped, todo, failing, or skipped-suite tests", () => {
  const report = parse(`
test.skip("[DEMO-R1.1] saves", () => {});
it.todo("[DEMO-R1.1] saves");
test.failing("[DEMO-R1.1] saves", () => {});
describe.skip.each([[1]])("suite", () => { test("[DEMO-R1.1] saves", () => {}); });`);
  assert.deepEqual(report, { references: [], problems: [] });
});

test("rejects focused tests and suites, including unmarked ones", () => {
  const report = parse(
    `describe.only("suite", () => { test.only("unmarked", () => {}); });`,
  );
  assert.equal(report.problems.length, 2);
  assert.ok(
    report.problems.every((problem) => problem.message.includes(".only")),
  );
});

test("rejects focused calls in helpers and parameterized tests", () => {
  const report = parse(`
function registerLater() { test.only("unmarked", () => {}); }
test.only.each([[1]])("unmarked %s", () => {});`);
  assert.equal(report.problems.length, 2);
});

test("rejects malformed IDs and dynamic marked titles", () => {
  const report = parse(`
test("[DEMO-R1] saves", () => {});
test("[DEMO-R1.0] saves", () => {});
test("[DEMO-R1.1, invalid] saves", () => {});
test(\`[DEMO-R1.1] saves \${value}\`, () => {});`);
  assert.equal(report.problems.length, 4);
  assert.deepEqual(report.references, []);
});

test("rejects a marker without a test callback", () => {
  const report = parse(`test("[DEMO-R1.1] saves");`);
  assert.equal(report.problems.length, 1);
  assert.deepEqual(report.references, []);
});

test("recognizes skipped and focused Jest aliases", () => {
  const skipped = parse(`
xit("[DEMO-R1.1] saves", () => {});
xtest("[DEMO-R1.1] saves", () => {});
xdescribe("suite", () => { test("[DEMO-R1.1] saves", () => {}); }); // codespell:ignore xdescribe
`);
  assert.deepEqual(skipped, { references: [], problems: [] });
  const focused = parse(
    `fit("unmarked", () => {}); fdescribe("suite", () => {});`,
  );
  assert.equal(focused.problems.length, 2);
});

test("scans Jest test locations including hidden files, while ignoring other source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "taigu-scenario-parser-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.symlinkSync(
      path.dirname(frontendRequire.resolve("typescript/package.json")),
      path.join(root, "node_modules/typescript"),
    );
    for (const filename of [
      "src/demo.test.js",
      "src/demo.spec.tsx",
      "src/__tests__/demo.ts",
      "src/demo.ts",
      "src/.cache/hidden.test.ts",
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, filename)), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(root, filename),
        'test("[DEMO-R1.1] saves", () => {});',
      );
    }
    const report = collectTestReferences(root);
    assert.deepEqual(report.problems, []);
    assert.deepEqual(
      report.references.map((reference) => reference.path).sort(),
      [
        "frontend/src/.cache/hidden.test.ts",
        "frontend/src/__tests__/demo.ts",
        "frontend/src/demo.spec.tsx",
        "frontend/src/demo.test.js",
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ignores unused functions and hook callbacks", () => {
  const report = parse(`
export function registerLater() { test("[DEMO-R1.1] saves", () => {}); }
const unused = () => { test("[DEMO-R1.1] saves", () => {}); };
beforeAll(() => { test("[DEMO-R1.1] saves", () => {}); });
test("ordinary", () => { test("[DEMO-R1.1] saves", () => {}); });`);
  assert.deepEqual(report, { references: [], problems: [] });
});

test("does not count conditional scenario registrations that may not run", () => {
  const report = parse(`
if (false) test("[DEMO-R1.1] saves", () => {});
false && test("[DEMO-R1.1] saves", () => {});`);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.references, []);
});

test("does not count class fields or catch branches as registrations", () => {
  const report = parse(`
class Unused { field = test("[DEMO-R1.1] saves", () => {}); }
try {} catch (error) { test("[DEMO-R1.1] saves", () => {}); }`);
  assert.deepEqual(report, { references: [], problems: [] });
});

test("rejects scenario registrations in suites with possible early returns", () => {
  const report = parse(`
describe("guarded", () => {
  if (!process.env.FEATURE) return;
  test("[DEMO-R1.1] saves", () => {});
});`);
  assert.equal(report.problems.length, 1);
  assert.deepEqual(report.references, []);
});

test("reports syntax errors with source locations", () => {
  const report = parse("test(;");
  assert.ok(report.problems.length > 0);
  assert.equal(report.problems[0].path, "frontend/src/demo.test.tsx");
  assert.equal(report.problems[0].line, 1);
});
