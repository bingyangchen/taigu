"""Checks that every scenario in docs/specs/ has a test or a section in tests/manual/.

The rules are in "Spec Conventions" of .agents/skills/sdd/SKILL.md.
"""

import ast
import re
import sys
from dataclasses import dataclass
from pathlib import Path

_REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_SPECS_DIRECTORY = Path("docs/specs")
_API_SERVER_DIRECTORY = Path("api-server")
_MANUAL_DIRECTORY = Path("tests/manual")

_MARKDOWN_FILE = re.compile(r"\.md$")
_TEST_FILE = re.compile(r"^test_.*\.py$")

_FENCE = re.compile(r"^\s*(`{3,}|~{3,})")
_REQUIREMENT_HEADING = re.compile(r"^### ([A-Z]+-R\d+)(?: |$)")
_SCENARIO_LINE = re.compile(r"^- (\S+) (.+)$")
_SCENARIO_FIRST_DETAIL = re.compile(r"^\s+- 前提[:：]")
_SCENARIO_ID_LIKE = re.compile(r"^- [A-Z]+-R\d+\.\d")
_SCENARIO_ID = re.compile(r"^([A-Z]+-R\d+)\.[1-9]\d*$")
_MANUAL_HEADING = re.compile(r"^## (\S+) (.+)$")


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


@dataclass(frozen=True)
class _ScenarioMention:
    """A scenario line in a spec, or a section heading in tests/manual/."""

    path: str
    line: int
    id: str
    name: str


@dataclass(frozen=True)
class _Reference:
    path: str
    line: int
    id: str


def check_scenarios(
    *, specs: list[SourceFile], tests: list[SourceFile], manuals: list[SourceFile]
) -> ScenarioReport:
    problems: list[Problem] = []

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

    tested_ids: set[str] = set()
    for test_file in tests:
        for reference in _parse_test_references(test_file, problems):
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

    for scenario in id_to_scenario.values():
        if scenario.id not in tested_ids and scenario.id not in manual_ids:
            problems.append(
                Problem(
                    scenario.path,
                    scenario.line,
                    f"{scenario.id} has no test that names it and no section in {_MANUAL_DIRECTORY}/",
                )
            )

    problems.sort(key=lambda p: (p.path, p.line))
    return ScenarioReport(
        problems=problems,
        scenario_count=len(id_to_scenario),
        tested_count=len(tested_ids),
        manual_count=len(manual_ids),
    )


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
) -> list[_Reference]:
    references: list[_Reference] = []
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
                    _Reference(test_file.path, argument.lineno, argument.value)
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


def main() -> int:
    report = check_scenarios(
        specs=_read_files(_SPECS_DIRECTORY, _MARKDOWN_FILE),
        tests=_read_files(_API_SERVER_DIRECTORY, _TEST_FILE),
        # tests/manual/ holds no file until the first scenario needs a manual check,
        # and Git does not keep an empty directory.
        manuals=_read_files(_MANUAL_DIRECTORY, _MARKDOWN_FILE)
        if (_REPOSITORY_ROOT / _MANUAL_DIRECTORY).is_dir()
        else [],
    )
    for problem in report.problems:
        sys.stderr.write(f"{problem.path}:{problem.line}: {problem.message}\n")
    if report.problems:
        sys.stderr.write(
            f'{len(report.problems)} problem(s). The rules are in "Spec Conventions" of .agents/skills/sdd/SKILL.md.\n'
        )
        return 1
    sys.stdout.write(
        f"Checked {report.scenario_count} scenarios: {report.tested_count} with tests, {report.manual_count} with a section in {_MANUAL_DIRECTORY}/.\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
