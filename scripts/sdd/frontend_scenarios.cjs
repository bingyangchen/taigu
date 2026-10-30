const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");

const SCENARIO_ID = /^[A-Z]+-R\d+\.[1-9]\d*$/;
const SCENARIO_PREFIX = /^\[[A-Z]+-R/;
const TEST_FILE = /\.(?:test|spec)\.[jt]sx?$/;
const SOURCE_FILE = /\.[jt]sx?$/;

function getRegistration(expression, ts) {
  if (
    ts.isCallExpression(expression) ||
    ts.isTaggedTemplateExpression(expression)
  ) {
    const factory = expression.expression || expression.tag;
    if (
      !ts.isPropertyAccessExpression(factory) ||
      factory.name.text !== "each"
    ) {
      return null;
    }
    expression = factory.expression;
  }
  const modifiers = [];
  while (ts.isPropertyAccessExpression(expression)) {
    modifiers.push(expression.name.text);
    expression = expression.expression;
  }
  if (modifiers.includes("each")) return null;
  if (!ts.isIdentifier(expression)) return null;
  const aliases = {
    fit: ["it", "only"],
    fdescribe: ["describe", "only"],
    xit: ["it", "skip"],
    xtest: ["test", "skip"],
    xdescribe: ["describe", "skip"], // codespell:ignore xdescribe
  };
  const alias = Object.hasOwn(aliases, expression.text)
    ? aliases[expression.text]
    : null;
  if (alias) return { name: alias[0], modifiers: [...modifiers, alias[1]] };
  return ["test", "it", "describe"].includes(expression.text)
    ? { name: expression.text, modifiers }
    : null;
}

function parseTestReferences(source, ts) {
  const tree = ts.createSourceFile(
    source.path,
    source.text,
    ts.ScriptTarget.Latest,
    true,
  );
  const references = [];
  const problems = [];
  function problem(node, message) {
    problems.push({
      path: source.path,
      line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
      message,
    });
  }
  for (const diagnostic of tree.parseDiagnostics) {
    problems.push({
      path: source.path,
      line: tree.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    });
  }
  function checkFocusedTests(node) {
    if (
      ts.isCallExpression(node) &&
      getRegistration(node.expression, ts)?.modifiers.includes("only")
    ) {
      problem(
        node,
        "Focused Jest tests or suites (.only) can omit scenario coverage",
      );
    }
    ts.forEachChild(node, checkFocusedTests);
  }
  checkFocusedTests(tree);
  function containsReturn(node) {
    if (ts.isFunctionLike(node)) return false;
    return (
      ts.isReturnStatement(node) ||
      Boolean(ts.forEachChild(node, containsReturn))
    );
  }
  function visit(node, skipped = false, conditional = false) {
    if (ts.isSourceFile(node) || ts.isBlock(node)) {
      const canReturn = containsReturn(node);
      for (const statement of node.statements) {
        visit(statement, skipped, conditional || canReturn);
      }
      return;
    }
    if (ts.isExpressionStatement(node)) {
      visit(node.expression, skipped, conditional);
      return;
    }
    if (ts.isCallExpression(node)) {
      const registration = getRegistration(node.expression, ts);
      if (registration) {
        const { name, modifiers } = registration;
        skipped ||= modifiers.some((modifier) =>
          ["skip", "todo", "failing"].includes(modifier),
        );
        const title = node.arguments[0];
        const literal =
          title &&
          (ts.isStringLiteral(title) ||
            ts.isNoSubstitutionTemplateLiteral(title));
        const titleText = literal ? title.text : title?.getText(tree) || "";
        if (
          !skipped &&
          name !== "describe" &&
          (SCENARIO_PREFIX.test(titleText) || /^`\[[A-Z]+-R\d/.test(titleText))
        ) {
          if (conditional) {
            problem(
              node,
              "Register scenario tests unconditionally at module scope or inside describe callbacks",
            );
          } else if (!literal) {
            problem(
              title,
              "Use a literal Jest title such as '[DEMO-R1.1] verifies the result'",
            );
          } else {
            const marker = /^\[([^\]]+)\]\s+\S/.exec(title.text);
            const ids = marker
              ? marker[1].split(",").map((id) => id.trim())
              : [];
            if (!ids.length || ids.some((id) => !SCENARIO_ID.test(id))) {
              problem(
                title,
                "Start the Jest title with '[DEMO-R1.1]' or '[DEMO-R1.1, DEMO-R1.2]', followed by its name",
              );
            } else if (
              !node.arguments[1] ||
              !(
                ts.isArrowFunction(node.arguments[1]) ||
                ts.isFunctionExpression(node.arguments[1])
              )
            ) {
              problem(node, "A scenario test needs an inline test callback");
            } else {
              for (const id of ids) {
                references.push({
                  path: source.path,
                  line:
                    tree.getLineAndCharacterOfPosition(title.getStart(tree))
                      .line + 1,
                  id,
                });
              }
            }
          }
        }
        if (name === "describe") {
          const callback = node.arguments[1];
          if (
            callback &&
            (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
          ) {
            visit(callback.body, skipped, conditional);
          }
        }
        return;
      }
    }
  }
  visit(tree);
  return { references, problems };
}

function collectTestReferences(frontendRoot) {
  const ts = createRequire(path.join(frontendRoot, "package.json"))(
    "typescript",
  );
  const report = { references: [], problems: [] };
  function visitDirectory(directory, inTests = false) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visitDirectory(filename, inTests || entry.name === "__tests__");
      } else if (
        entry.isFile() &&
        (TEST_FILE.test(entry.name) ||
          (inTests && SOURCE_FILE.test(entry.name)))
      ) {
        const result = parseTestReferences(
          {
            path: `frontend/${path.relative(frontendRoot, filename).split(path.sep).join("/")}`,
            text: fs.readFileSync(filename, "utf8"),
          },
          ts,
        );
        report.references.push(...result.references);
        report.problems.push(...result.problems);
      }
    }
  }
  visitDirectory(path.join(frontendRoot, "src"));
  return report;
}

module.exports = { parseTestReferences, collectTestReferences };

if (require.main === module) {
  const frontendRoot = path.resolve(process.argv[2] || "frontend");
  process.stdout.write(
    JSON.stringify(collectTestReferences(frontendRoot)) + "\n",
  );
}
