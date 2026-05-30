import re


class SafetyGuard:
    """
    Lightweight safety filter for agent tool execution.
    Blocks dangerous shell/file operations.
    """

    DANGEROUS_PATTERNS = [
        r"rm\s+-rf",
        r":\(\)\s*\{\s*:\|:\s*&\s*\};:",
        r"mkfs",
        r"dd\s+if=",
        r"shutdown",
        r"reboot",
        r"chmod\s+777\s+/",
    ]

    ALLOWED_TOOLS = {
        "write_file",
        "read_file",
        "list_files",
        "execute_command"
    }

    def validate_tool(self, tool_name: str, args: str) -> bool:
        if tool_name not in self.ALLOWED_TOOLS:
            return False

        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, args):
                return False

        return True
