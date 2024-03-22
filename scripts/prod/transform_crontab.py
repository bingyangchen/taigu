import os
import re
import subprocess
from pathlib import Path
from typing import Literal

BASE_DIR_PATH = Path(__file__).resolve().parent.parent.parent
CRONTAB_FILE_PATH = os.path.join(BASE_DIR_PATH, "crontab")

# This regex checks that the crontab expression is valid
CRONTAB_REGEX = re.compile(r"^(\S+ \S+ \S+ \S+ \S+) (.+)$")


def split_crontab(expression: str) -> tuple[str, str]:
    match_result = CRONTAB_REGEX.match(expression)
    if match_result is not None:
        return (
            match_result.group(1).strip(),
            match_result.group(2).strip(),
        )
    else:
        raise SyntaxError


def transform_command(command: str) -> str:
    if is_python_command(command):
        return f"{get_full_path_of_executable('python')} {BASE_DIR_PATH}/{command.lstrip('python ')}"
    elif is_shell_command(command):
        return f"{get_full_path_of_executable('bash')} {BASE_DIR_PATH}/{command.lstrip('bash ').lstrip('sh ')}"
    else:
        return command


def is_python_command(command: str) -> bool:
    return command.startswith("python ")


def is_shell_command(command: str) -> bool:
    return command.startswith("bash ") or command.startswith("sh ")


def get_full_path_of_executable(program: Literal["python", "bash"]) -> str:
    return (
        subprocess.run(["which", program], capture_output=True).stdout.decode().strip()
    )


if __name__ == "__main__":
    result = []
    with open(CRONTAB_FILE_PATH) as file:
        for line in file:
            line = line.strip()
            if line.startswith("#") or not line:
                result.append(line)
            else:
                schedule, command = split_crontab(line)
                result.append(f"{schedule} {transform_command(command)}")
    with open(CRONTAB_FILE_PATH, "w") as file:
        for newline in result:
            file.write(newline)
            file.write("\n")
