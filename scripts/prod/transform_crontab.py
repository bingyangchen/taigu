import os
import re
import subprocess
from pathlib import Path

BASE_DIR_PATH = Path(__file__).resolve().parent.parent.parent
CRONTAB_DIR_PATH = os.path.join(BASE_DIR_PATH, "main/crontab")
CRONTAB_FILE_PATH = os.path.join(CRONTAB_DIR_PATH, "crontab")

# This regex checks that the crontab expression is valid
CRONTAB_REGEX = re.compile(r"^(\S+ \S+ \S+ \S+ \S+) (.+)$")

# This regex checks that the python command has no -m option
PYTHON_COMMAND_REGEX = re.compile(r"^.*\bpython\b(?!.*\s+-m\s+).*")


def split_crontab(expression: str) -> tuple[str, str]:
    match_result = CRONTAB_REGEX.match(expression)
    if match_result is not None:
        return (
            match_result.group(1).strip(),
            match_result.group(2).strip(),
        )
    else:
        raise SyntaxError


def check_python_command_has_no_module_option(python_command: str) -> None:
    if PYTHON_COMMAND_REGEX.match(python_command) is None:
        raise SyntaxError(
            "You cannot use the -m option with the python command in the crontab. Please use the /path/to/file format."
        )


def transform_python_command(python_command: str) -> str:
    return f"{get_full_path_of_python_executable()} {CRONTAB_DIR_PATH}/{python_command.lstrip('python ')}"


def get_full_path_of_python_executable() -> str:
    return (
        subprocess.run(["which", "python"], capture_output=True).stdout.decode().strip()
    )


if __name__ == "__main__":
    result = []
    with open(CRONTAB_FILE_PATH) as file:
        for line in file:
            line = line.strip()
            if line.startswith("#") or not line:
                result.append(line)
            else:
                schedule, python_command = split_crontab(line)
                check_python_command_has_no_module_option(python_command)
                result.append(f"{schedule} {transform_python_command(python_command)}")
    with open(CRONTAB_FILE_PATH, "w") as file:
        for newline in result:
            file.write(newline)
            file.write("\n")
