"""Checks that every scenario in docs/specs/ has a test or a section in tests/manual/.

A plan's branch changes the specs before the code, so with --allow-unfinished-plans a
scenario that a plan still in docs/plans/ lists under "驗證方式" may have neither yet.
Without the option, as in CI, every plan still in docs/plans/ is a problem, so a PR
cannot merge before its implementation archives the plan.

The rules are in "Spec Conventions" of .agents/skills/sdd/SKILL.md.
"""

import argparse
import ast
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

_REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_SPECS_DIRECTORY = Path("docs/specs")
_API_SERVER_DIRECTORY = Path("api-server")
_MANUAL_DIRECTORY = Path("tests/manual")
_PLANS_DIRECTORY = Path("docs/plans")

_MARKDOWN_FILE = re.compile(r"\.md$")
_TEST_FILE = re.compile(r"^test_.*\.py$")

_FENCE = re.compile(r"^\s*(`{3,}|~{3,})")
_REQUIREMENT_HEADING = re.compile(r"^### ([A-Z]+-R\d+)(?: |$)")
_SCENARIO_LINE = re.compile(r"^- (\S+) (.+)$")
_SCENARIO_FIRST_DETAIL = re.compile(r"^\s+- 前提[:：]")
_SCENARIO_ID_LIKE = re.compile(r"^- [A-Z]+-R\d+\.\d")
_SCENARIO_ID = re.compile(r"^([A-Z]+-R\d+)\.[1-9]\d*$")
_MANUAL_HEADING = re.compile(r"^## (\S+) (.+)$")
_PLAN_FILE = re.compile(r"^\d{4}-.*\.md$")
_PLAN_TABLE_ROW = re.compile(r"^\|\s*(\S+)\s+(.*?)\s*\|")
_PLAN_VERIFICATION_HEADING = "## 驗證方式"


@dataclass(frozen=True)
class SourceFile:
    """A file the check reads, with its path relative to the repository root."""

    path: str
    text: str


@dataclass(frozen=True)
class Problem:
    path: str
    line: int
    message: str


@dataclass(frozen=True)
class ScenarioReport:
    problems: list[Problem]
    scenario_count: int
    tested_count: int
    manual_count: int
    planned_count: int = 0


@dataclass(frozen=True)
class _ScenarioMention:
    """A scenario line in a spec, or a section heading in tests/manual/."""

    path: str
    line: int
    id: str
    name: str


@dataclass(frozen=True)
class ScenarioReference:
    path: str
    line: int
    id: str


@dataclass(frozen=True)
class FrontendTestReport:
    references: list[ScenarioReference]
    problems: list[Problem]


def check_scenarios(
    *,
    specs: list[SourceFile],
    tests: list[SourceFile],
    manuals: list[SourceFile],
    frontend_report: FrontendTestReport | None = None,
    plans: list[SourceFile] | None = None,
    allow_unfinished_plans: bool = False,
) -> ScenarioReport:
    problems = list(frontend_report.problems) if frontend_report else []

    planned_id_to_plan: dict[str, str] = {}
    planned_mentions: list[_ScenarioMention] = []
    for plan in plans or []:
        if not allow_unfinished_plans:
            problems.append(
                Problem(
                    plan.path,
                    1,
                    "The plan is not done; its implementation archives it before the PR merges",
                )
            )
        for planned in _parse_planned_scenarios(plan, problems):
            planned_id_to_plan.setdefault(planned.id, plan.path)
            planned_mentions.append(planned)

    id_to_scenario: dict[str, _ScenarioMention] = {}
    for spec in specs:
        for scenario in _parse_scenarios(spec, problems):
            existing = id_to_scenario.get(scenario.id)
            if existing is None:
                id_to_scenario[scenario.id] = scenario
            else:
                problems.append(
                    Problem(
                        scenario.path,
                        scenario.line,
                        f"{scenario.id} is already used at {existing.path}:{existing.line}",
                    )
                )

    references = list(frontend_report.references) if frontend_report else []
    for test_file in tests:
        references.extend(_parse_test_references(test_file, problems))
    tested_ids: set[str] = set()
    for reference in references:
        if reference.id in id_to_scenario:
            tested_ids.add(reference.id)
        else:
            problems.append(
                Problem(
                    reference.path,
                    reference.line,
                    f"The test names {reference.id}, which no spec has",
                )
            )

    manual_ids: set[str] = set()
    for manual_file in manuals:
        for section in _parse_manual_sections(manual_file, problems):
            scenario = id_to_scenario.get(section.id)
            if scenario is None:
                problems.append(
                    Problem(section.path, section.line, f"No spec has {section.id}")
                )
                continue
            if section.id in manual_ids:
                problems.append(
                    Problem(
                        section.path,
                        section.line,
                        f"{section.id} already has a section in {_MANUAL_DIRECTORY}/",
                    )
                )
                continue
            manual_ids.add(section.id)
            spec_name = Path(scenario.path).name
            if Path(section.path).name != spec_name:
                problems.append(
                    Problem(
                        section.path,
                        section.line,
                        f"{section.id} is in {spec_name}, so its section belongs in {Path(section.path).parent / spec_name}",
                    )
                )
            if section.name != scenario.name:
                problems.append(
                    Problem(
                        section.path,
                        section.line,
                        f'{scenario.path}:{scenario.line} names {section.id} "{scenario.name}", not "{section.name}"',
                    )
                )

    for planned in planned_mentions:
        scenario = id_to_scenario.get(planned.id)
        if scenario is None:
            problems.append(Problem(planned.path, planned.line, f"No spec has {planned.id}"))
        elif planned.name != scenario.name:
            problems.append(
                Problem(
                    planned.path,
                    planned.line,
                    f'{scenario.path}:{scenario.line} names {planned.id} "{scenario.name}", not "{planned.name}"',
                )
            )

    planned_count = 0
    for scenario in id_to_scenario.values():
        if scenario.id in tested_ids or scenario.id in manual_ids:
            continue
        plan_path = planned_id_to_plan.get(scenario.id)
        if plan_path is not None and allow_unfinished_plans:
            planned_count += 1
            continue
        message = f"{scenario.id} has no test that names it and no section in {_MANUAL_DIRECTORY}/"
        if plan_path is not None:
            message += f"; {plan_path} plans it, and its implementation adds them"
        problems.append(Problem(scenario.path, scenario.line, message))

    problems.sort(key=lambda p: (p.path, p.line))
    return ScenarioReport(
        problems=problems,
        scenario_count=len(id_to_scenario),
        tested_count=len(tested_ids),
        manual_count=len(manual_ids),
        planned_count=planned_count,
    )


def _parse_planned_scenarios(
    plan: SourceFile, problems: list[Problem]
) -> list[_ScenarioMention]:
    """Returns the scenarios that the table under "## 驗證方式" lists in its first
    column, which the plan's implementation will verify."""
    scenarios: list[_ScenarioMention] = []
    in_section = False
    for line_number, text in _parse_lines_outside_code(plan, problems):
        if text.startswith("## "):
            in_section = text.strip() == _PLAN_VERIFICATION_HEADING
            continue
        row = _PLAN_TABLE_ROW.match(text) if in_section else None
        if row is not None and _SCENARIO_ID.match(row.group(1)):
            scenarios.append(
                _ScenarioMention(plan.path, line_number, row.group(1), row.group(2))
            )
    return scenarios


def _parse_scenarios(
    spec: SourceFile, problems: list[Problem]
) -> list[_ScenarioMention]:
    scenarios: list[_ScenarioMention] = []
    requirement_id: str | None = None
    requirement_ids: set[str] = set()
    lines = [
        (line_number, text)
        for line_number, text in _parse_lines_outside_code(spec, problems)
        if text.strip()
    ]
    for index, (line_number, text) in enumerate(lines):
        heading = _REQUIREMENT_HEADING.match(text)
        if heading is not None:
            requirement_id = heading.group(1)
            if requirement_id in requirement_ids:
                problems.append(
                    Problem(spec.path, line_number, f"{requirement_id} is already used")
                )
            requirement_ids.add(requirement_id)
            continue
        if text.startswith(("## ", "### ")):
            requirement_id = None
            continue
        if not text.startswith("- "):
            continue

        # A scenario is a top-level list item whose first nested item is its 前提, or
        # one that starts like a scenario ID, so that a scenario missing its 前提 still
        # gets checked.
        next_text = lines[index + 1][1] if index + 1 < len(lines) else ""
        if not (
            _SCENARIO_FIRST_DETAIL.match(next_text) or _SCENARIO_ID_LIKE.match(text)
        ):
            continue
        scenario_line = _SCENARIO_LINE.match(text)
        id_match = _SCENARIO_ID.match(scenario_line.group(1)) if scenario_line else None
        if scenario_line is None or id_match is None:
            problems.append(
                Problem(
                    spec.path,
                    line_number,
                    "The scenario does not start with a scenario ID; write `- <requirement ID>.<n> <name>`",
                )
            )
        elif id_match.group(1) != requirement_id:
            problems.append(
                Problem(
                    spec.path,
                    line_number,
                    f"{scenario_line.group(1)} sits outside any requirement"
                    if requirement_id is None
                    else f"{scenario_line.group(1)} sits under {requirement_id}",
                )
            )
        else:
            scenarios.append(
                _ScenarioMention(
                    spec.path,
                    line_number,
                    scenario_line.group(1),
                    scenario_line.group(2),
                )
            )
    return scenarios


def _parse_test_references(
    test_file: SourceFile, problems: list[Problem]
) -> list[ScenarioReference]:
    references: list[ScenarioReference] = []
    tree = ast.parse(test_file.text, filename=test_file.path)
    called_marks = {
        id(node.func)
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and _is_scenario_mark(node.func)
    }
    for node in ast.walk(tree):
        if _is_scenario_mark(node) and id(node) not in called_marks:
            problems.append(
                Problem(
                    test_file.path,
                    node.lineno,
                    'pytest.mark.scenario needs the scenario IDs, as in `@pytest.mark.scenario("TRADE-R1.2")`',
                )
            )
        if not (isinstance(node, ast.Call) and _is_scenario_mark(node.func)):
            continue
        if not node.args or node.keywords:
            problems.append(
                Problem(
                    test_file.path,
                    node.lineno,
                    "pytest.mark.scenario takes the scenario IDs as positional arguments and nothing else",
                )
            )
        for argument in node.args:
            if (
                isinstance(argument, ast.Constant)
                and isinstance(argument.value, str)
                and _SCENARIO_ID.match(argument.value)
            ):
                references.append(
                    ScenarioReference(test_file.path, argument.lineno, argument.value)
                )
            else:
                problems.append(
                    Problem(
                        test_file.path,
                        argument.lineno,
                        'Pass each scenario ID to pytest.mark.scenario as its own string literal, such as "TRADE-R1.2", because this check reads the IDs from the source',
                    )
                )
    return references


def _is_scenario_mark(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and node.attr == "scenario"
        and isinstance(node.value, ast.Attribute)
        and node.value.attr == "mark"
    )


def _parse_manual_sections(
    manual_file: SourceFile, problems: list[Problem]
) -> list[_ScenarioMention]:
    sections: list[_ScenarioMention] = []
    for line_number, text in _parse_lines_outside_code(manual_file, problems):
        if not text.startswith("## "):
            continue
        heading = _MANUAL_HEADING.match(text)
        if heading is None or not _SCENARIO_ID.match(heading.group(1)):
            problems.append(
                Problem(
                    manual_file.path,
                    line_number,
                    "The heading is not `## <scenario ID> <scenario name>`",
                )
            )
            continue
        sections.append(
            _ScenarioMention(
                manual_file.path, line_number, heading.group(1), heading.group(2)
            )
        )
    return sections


def _parse_lines_outside_code(
    markdown_file: SourceFile, problems: list[Problem]
) -> list[tuple[int, str]]:
    """Returns each line outside fenced code blocks, with its 1-based line number, and
    reports a code block that never closes."""
    lines: list[tuple[int, str]] = []
    opening_fence: str | None = None
    opening_line_number = 0
    for index, line in enumerate(markdown_file.text.split("\n")):
        fence = _FENCE.match(line)
        if opening_fence is None:
            if fence is None:
                lines.append((index + 1, line))
            else:
                opening_fence = fence.group(1)
                opening_line_number = index + 1
        elif _is_closing_fence(line.strip(), opening_fence):
            opening_fence = None
    if opening_fence is not None:
        problems.append(
            Problem(
                markdown_file.path,
                opening_line_number,
                "The code block that starts here never closes, so the check skips every line after it",
            )
        )
    return lines


def _is_closing_fence(stripped_line: str, opening_fence: str) -> bool:
    return len(stripped_line) >= len(opening_fence) and stripped_line == (
        opening_fence[0] * len(stripped_line)
    )


def _read_files(directory: Path, name_pattern: re.Pattern[str]) -> list[SourceFile]:
    """Skips files and directories whose names start with a dot, such as virtual
    environments."""
    absolute_directory = _REPOSITORY_ROOT / directory
    if not absolute_directory.is_dir():
        raise FileNotFoundError(f"{absolute_directory} is not a directory")
    return [
        SourceFile(
            str(path.relative_to(_REPOSITORY_ROOT)), path.read_text(encoding="utf-8")
        )
        for path in sorted(absolute_directory.rglob("*"))
        if path.is_file()
        and name_pattern.search(path.name)
        and not any(
            part.startswith(".") for part in path.relative_to(absolute_directory).parts
        )
    ]


def _read_plans() -> list[SourceFile]:
    """Reads the plans directly in docs/plans/; archived plans are done."""
    return [
        SourceFile(
            str(path.relative_to(_REPOSITORY_ROOT)), path.read_text(encoding="utf-8")
        )
        for path in sorted((_REPOSITORY_ROOT / _PLANS_DIRECTORY).iterdir())
        if path.is_file() and _PLAN_FILE.search(path.name)
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frontend-report", type=Path, required=True)
    parser.add_argument(
        "--allow-unfinished-plans",
        action="store_true",
        help="Accept the scenarios of plans still in docs/plans/ without tests, for pushing a plan's branch before its implementation",
    )
    args = parser.parse_args()
    frontend_data = json.loads(args.frontend_report.read_text(encoding="utf-8"))
    report = check_scenarios(
        specs=_read_files(_SPECS_DIRECTORY, _MARKDOWN_FILE),
        tests=_read_files(_API_SERVER_DIRECTORY, _TEST_FILE),
        frontend_report=FrontendTestReport(
            references=[
                ScenarioReference(**item) for item in frontend_data["references"]
            ],
            problems=[Problem(**item) for item in frontend_data["problems"]],
        ),
        # tests/manual/ holds no file until the first scenario needs a manual check,
        # and Git does not keep an empty directory.
        manuals=_read_files(_MANUAL_DIRECTORY, _MARKDOWN_FILE)
        if (_REPOSITORY_ROOT / _MANUAL_DIRECTORY).is_dir()
        else [],
        plans=_read_plans(),
        allow_unfinished_plans=args.allow_unfinished_plans,
    )
    for problem in report.problems:
        sys.stderr.write(f"{problem.path}:{problem.line}: {problem.message}\n")
    if report.problems:
        sys.stderr.write(
            f'{len(report.problems)} problem(s). The rules are in "Spec Conventions" of .agents/skills/sdd/SKILL.md.\n'
        )
        return 1
    planned = (
        f", {report.planned_count} waiting for a plan's implementation"
        if report.planned_count
        else ""
    )
    sys.stdout.write(
        f"Checked {report.scenario_count} scenarios: {report.tested_count} with tests, {report.manual_count} with a section in {_MANUAL_DIRECTORY}/{planned}.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
