# solver.py  (A* version)
from heapq import heappush, heappop
from typing import Dict, List, Optional, Set, Tuple

from pydantic import BaseModel

import rules

StateKey = Tuple[str, ...]   # sorted tuple of effects

class SolveRequest(BaseModel):
    base: str
    include: List[str]
    exclude: List[str]
    max_expansions: Optional[int] = 1_000_000

class SolveResponse(BaseModel):
    success: bool
    ingredients: Optional[List[str]] = None
    final_effects: Optional[List[str]] = None
    message: Optional[str] = None

def heuristic(current: Set[str], want_inc: Set[str]) -> int:
    """Admissible heuristic = number of desired effects still missing."""
    return len(want_inc - current)

def solve_recipe(req: SolveRequest) -> SolveResponse:
    base = req.base
    want_inc = set(req.include)
    want_exc = set(req.exclude)

    if base not in rules.plain_products:
        return SolveResponse(success=False,
                             message=f"Unknown base '{base}'")

    start = set(rules.plain_products[base][1])

    # If we already satisfied everything (and no forbidden in final), done.
    if want_inc.issubset(start) and not (start & want_exc):
        return SolveResponse(success=True,
                             ingredients=[],
                             final_effects=list(start))

    # A* frontier: list of tuples (f_score, g_score, effects_set, path)
    # path is a tuple of ingredient names
    frontier: List[Tuple[int, int, Set[str], Tuple[str, ...]]] = []
    g0 = 0
    h0 = heuristic(start, want_inc)
    heappush(frontier, (g0 + h0, g0, start, ()))
    
    # visited: maps effect‐set -> best g_score found so far
    visited: Dict[StateKey, int] = {tuple(sorted(start)): 0}

    expansions = 0
    max_exp = req.max_expansions or 1_000_000

    while frontier:
        f, g, cur_eff, path = heappop(frontier)

        # Simple cap on expansions
        expansions += 1
        if expansions > max_exp:
            break

        # If this state no longer matches the best‐known g, skip
        key = tuple(sorted(cur_eff))
        if visited.get(key, 9999) < g:
            continue

        # Try each ingredient
        for ingr in rules.ingredients:
            new_eff_list = rules.mutate(list(cur_eff), ingr)
            new_eff = set(new_eff_list)
            new_g = g + 1
            new_key = tuple(sorted(new_eff))

            # If we've seen this effect‐set more cheaply, skip
            if visited.get(new_key, 9999) <= new_g:
                continue

            # Check goal
            if want_inc.issubset(new_eff) and not (new_eff & want_exc):
                return SolveResponse(
                    success=True,
                    ingredients=list(path) + [ingr],
                    final_effects=list(new_eff),
                )

            # record and push
            visited[new_key] = new_g
            h = heuristic(new_eff, want_inc)
            heappush(frontier, (new_g + h, new_g, new_eff, path + (ingr,)))

    return SolveResponse(
        success=False,
        message="No solution found (search cut off or impossible)."
    )
