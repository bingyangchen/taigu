import pytest
from check_scenarios import Problem, SourceFile, check_scenarios

_SPEC_PATH = "docs/specs/demo.md"
_TEST_PATH = "api-server/main/demo/tests/unit/test_views.py"
_MANUAL_PATH = "tests/manual/demo.md"


def _make_spec(requirement_lines: list[str]) -> SourceFile:
    """Makes a spec whose first requirement line is line 4."""
    return SourceFile(
        _SPEC_PATH, "\n".join(["# Demo", "", "## 需求", *requirement_lines])
    )


# Line 6 is DEMO-R1.1 and line 10 is DEMO-R1.2.
_SPEC = _make_spec(
    [
        "### DEMO-R1 新增交易紀錄",
        "",
        "- DEMO-R1.1 新增買進紀錄",
        "  - 前提：使用者已經登入",
        "  - 動作：新增一筆買進 1 張台積電的紀錄",
        "  - 結果：歷史紀錄顯示這筆紀錄",
        "- DEMO-R1.2 在手機上新增",
    ]
)


def _make_test_file(marks: list[str]) -> SourceFile:
    """Makes a test file with one test per mark, so the nth mark is on line 3n - 2."""
    tests = [
        f"@pytest.mark.{mark}\ndef test_{index}() -> None:\n    pass"
        for index, mark in enumerate(marks)
    ]
    return SourceFile(_TEST_PATH, "\n".join(tests))


def _make_manual_file(lines: list[str], path: str = _MANUAL_PATH) -> SourceFile:
    return SourceFile(path, "\n".join(lines))


def _make_locations(problems: list[Problem]) -> list[tuple[str, int]]:
    return [(problem.path, problem.line) for problem in problems]


def test_passes_when_every_scenario_has_a_test_or_a_manual_section() -> None:
    report = check_scenarios(
        specs=[_SPEC],
        tests=[_make_test_file(['scenario("DEMO-R1.1")'])],
        manuals=[_make_manual_file(["## DEMO-R1.2 在手機上新增"])],
    )

    assert report.problems == []
    assert (report.scenario_count, report.tested_count, report.manual_count) == (
        2,
        1,
        1,
    )


def test_reports_a_scenario_with_neither_a_test_nor_a_manual_section() -> None:
    report = check_scenarios(
        specs=[_SPEC], tests=[_make_test_file(['scenario("DEMO-R1.1")'])], manuals=[]
    )

    assert _make_locations(report.problems) == [(_SPEC_PATH, 10)]
    assert "DEMO-R1.2" in report.problems[0].message


def test_reads_every_scenario_id_of_a_mark() -> None:
    report = check_scenarios(
        specs=[_SPEC],
        tests=[_make_test_file(['scenario("DEMO-R1.1", "DEMO-R1.2")'])],
        manuals=[],
    )

    assert report.problems == []
    assert report.tested_count == 2


def test_reports_marks_that_name_an_unknown_scenario_or_misformat_their_ids() -> None:
    report = check_scenarios(
        specs=[_SPEC],
        tests=[
            _make_test_file(
                [
                    'scenario("DEMO-R1.1")',
                    'scenario("DEMO-R1.2")',
                    'scenario("DEMO-R1.9")',
                    'scenario("DEMO-R1")',
                    'scenario("DEMO-R1.1, DEMO-R1.2")',
                    "scenario(SCENARIO_ID)",
                    "scenario()",
                    'scenario("DEMO-R1.1", reason="x")',
                    "scenario",
                ]
            )
        ],
        manuals=[],
    )

    assert _make_locations(report.problems) == [
        (_TEST_PATH, line) for line in (7, 10, 13, 16, 19, 22, 25)
    ]
    assert "DEMO-R1.9" in report.problems[0].message
    assert all(
        "pytest.mark.scenario" in problem.message for problem in report.problems[1:]
    )


def test_reports_scenarios_without_an_id_under_another_requirement_or_with_a_used_id() -> (
    None
):
    spec = _make_spec(
        [
            "### DEMO-R1 新增交易紀錄",
            "",
            "- 不是情境的清單項目",
            "- 沒有 ID 的情境",
            "  - 前提：使用者已經登入",
            "- 前提用半形冒號的情境",
            "    - 前提: 使用者已經登入",
            "- DEMO-R2.1 在別的需求底下",
            "- DEMO-R1.1 第一次新增",
            "- DEMO-R1.1 第二次新增",
        ]
    )

    report = check_scenarios(
        specs=[spec], tests=[_make_test_file(['scenario("DEMO-R1.1")'])], manuals=[]
    )

    assert _make_locations(report.problems) == [
        (_SPEC_PATH, 7),
        (_SPEC_PATH, 9),
        (_SPEC_PATH, 11),
        (_SPEC_PATH, 13),
    ]
    assert "scenario ID" in report.problems[0].message
    assert "scenario ID" in report.problems[1].message
    assert "under DEMO-R1" in report.problems[2].message
    assert "already used" in report.problems[3].message


def test_reads_a_scenario_whose_details_follow_a_blank_line() -> None:
    spec = _make_spec(
        [
            "### DEMO-R1 新增交易紀錄",
            "",
            "- DEMO-R1.1 新增買進紀錄",
            "",
            "  - 前提：使用者已經登入",
            "- 沒有 ID 的情境",
            "",
            "  - 前提：使用者已經登入",
        ]
    )

    report = check_scenarios(
        specs=[spec], tests=[_make_test_file(['scenario("DEMO-R1.1")'])], manuals=[]
    )

    assert _make_locations(report.problems) == [(_SPEC_PATH, 9)]
    assert "scenario ID" in report.problems[0].message


def test_reads_requirement_headings_without_a_name_and_reports_a_used_requirement_id() -> (
    None
):
    spec = _make_spec(
        [
            "### DEMO-R1",
            "- DEMO-R1.1 新增買進紀錄",
            "  - 前提：使用者已經登入",
            "### DEMO-R1 新增交易紀錄",
        ]
    )

    report = check_scenarios(
        specs=[spec], tests=[_make_test_file(['scenario("DEMO-R1.1")'])], manuals=[]
    )

    assert _make_locations(report.problems) == [(_SPEC_PATH, 7)]
    assert "already used" in report.problems[0].message


@pytest.mark.parametrize(
    "fence_lines",
    [
        pytest.param(["```markdown", "```"], id="backticks"),
        pytest.param(["~~~", "~~~"], id="tildes"),
        pytest.param(["  ````", "  ```", "  ````"], id="indented and nested"),
    ],
)
def test_ignores_scenario_lines_in_code_blocks(fence_lines: list[str]) -> None:
    *opening_lines, closing_line = fence_lines
    spec = _make_spec(
        [
            "### DEMO-R1 新增交易紀錄",
            "",
            *opening_lines,
            "- DEMO-R1.1 範例",
            "  - 前提：使用者已經登入",
            closing_line,
        ]
    )

    report = check_scenarios(specs=[spec], tests=[], manuals=[])

    assert report.problems == []
    assert report.scenario_count == 0


def test_reports_a_code_block_that_never_closes() -> None:
    spec = _make_spec(
        [
            "### DEMO-R1 新增交易紀錄",
            "",
            "```markdown",
            "- DEMO-R1.1 範例",
            "  - 前提：使用者已經登入",
        ]
    )

    report = check_scenarios(specs=[spec], tests=[], manuals=[])

    assert _make_locations(report.problems) == [(_SPEC_PATH, 6)]
    assert "never closes" in report.problems[0].message


@pytest.mark.parametrize(
    ("manuals", "expected_messages"),
    [
        pytest.param(
            [_make_manual_file(["## DEMO-R1.2 在 iPad 上新增", "## 準備"])],
            [(_MANUAL_PATH, 1, "在手機上新增"), (_MANUAL_PATH, 2, "heading")],
            id="another name and a bad heading",
        ),
        pytest.param(
            [
                _make_manual_file(["## DEMO-R1.2 在手機上新增"]),
                _make_manual_file(
                    ["## DEMO-R1.2 在手機上新增"], "tests/manual/demo2.md"
                ),
            ],
            [("tests/manual/demo2.md", 1, "already has a section")],
            id="a second section",
        ),
        pytest.param(
            [_make_manual_file(["## DEMO-R1.2 在手機上新增"], "tests/manual/other.md")],
            [("tests/manual/other.md", 1, "tests/manual/demo.md")],
            id="the file of another spec",
        ),
    ],
)
def test_reports_misplaced_or_misnamed_manual_sections(
    manuals: list[SourceFile], expected_messages: list[tuple[str, int, str]]
) -> None:
    report = check_scenarios(
        specs=[_SPEC],
        tests=[_make_test_file(['scenario("DEMO-R1.1")'])],
        manuals=manuals,
    )

    assert _make_locations(report.problems) == [
        (path, line) for path, line, _ in expected_messages
    ]
    for problem, (_, _, text) in zip(report.problems, expected_messages, strict=True):
        assert text in problem.message
