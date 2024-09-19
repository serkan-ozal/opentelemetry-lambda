from typing import Collection, Optional


class DependencyConflict:
    required: str = None
    found: Optional[str] = None

    def __init__(self, required, found=None):
        self.required = required
        self.found = found

    def __str__(self):
        return f'DependencyConflict: requested: "{self.required}" but found: "{self.found}"'


def get_dist_dependency_conflicts(dist) -> Optional[DependencyConflict]:
    return None


def get_dependency_conflicts(deps: Collection[str]) -> Optional[DependencyConflict]:
    return None
