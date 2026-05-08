"""
rules.py

Defines the base products, ingredients, effects, and combination rules.
Users should populate these lists/dicts with the full data set.
"""

from typing import Dict, List, Tuple, TypedDict
import pandas as pd
from numpy import nan


class GrowProduct(TypedDict):
    """Cultivation values for a growable base product."""

    seed_price: int
    tent_yield: int
    pot_yield: int
    pgr_yield_bonus: int
    soil_price: int
    pgr_price: int
    speed_grow_price: int
    fertilizer_price: int


# Base products can have default (innate) effects.
# products -> (value, innate_effects)
plain_products: Dict[str, Tuple[int, List[str]]] = {}

# List of all ingredients
# ingredient -> (price, new_effect)
ingredients: Dict[str, Tuple[int, str, str]] = {}

# List of all possible effects (excluding "base")
# effect -> (multiplier, hex_color)
effects: Dict[str, Tuple[float, str]] = {}

# Combination rules: (current_effect, ingredient) -> new_effect
# If no rule applies, the effect carries over unchanged.
rules: Dict[Tuple[str, str], str] = {}

# Cultivation metadata for growable products.
grow_products: Dict[str, GrowProduct] = {}


def load_definitions() -> None:
    """Load product, rule, effect, and ingredient definitions from CSV files."""
    load_products()
    load_rules()
    load_effects()
    load_ingredients()
    load_grow_products()


def load_products() -> None:
    """Load base products and their innate effects from ``csv/products.csv``."""
    df = pd.read_csv("csv/products.csv", delimiter=",", header=0)
    df = df.replace({nan: None})
    for _, row in df.iterrows():
        innate_effects = str(row.Effects).split(";") if row.Effects else []
        plain_products[row.Name] = (
            int(row.Value),
            innate_effects,
        )


def load_rules() -> None:
    """Load effect replacement rules from ``csv/rules.csv``."""
    df = pd.read_csv("csv/rules.csv", delimiter=",", header=0)
    df = df.replace({nan: None})
    for _, row in df.iterrows():
        rules[(
            str(row.Replaces_Existing_Effect).lower(),
            str(row.Ingredient).lower()
        )] = str(row.Effect)


def load_effects() -> None:
    """Load effect multipliers and display colors from ``csv/effects.csv``."""
    df = pd.read_csv("csv/effects.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        effects[str(row.Name)] = (
            float(row.Multiplier),
            str(row.Color),
        )


def load_ingredients() -> None:
    """Load ingredient costs, base effects, and icons from ``csv/ingredients.csv``."""
    df = pd.read_csv("csv/ingredients.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        ingredients[str(row.Name)] = (
            int(row.Price),
            str(row.Effect),
            str(row.IconURL),
        )


def load_grow_products() -> None:
    """Load cultivation costs and yields from ``csv/grow_products.csv``."""
    df = pd.read_csv("csv/grow_products.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        grow_products[str(row.Name)] = {
            "seed_price": int(row.SeedPrice),
            "tent_yield": int(row.TentYield),
            "pot_yield": int(row.PotYield),
            "pgr_yield_bonus": int(row.PGRYieldBonus),
            "soil_price": int(row.SoilPrice),
            "pgr_price": int(row.PGRPrice),
            "speed_grow_price": int(row.SpeedGrowPrice),
            "fertilizer_price": int(row.FertilizerPrice),
        }


def mutate(current: List[str], ingredient: str) -> List[str]:
    """
    Apply an ingredient to a list of current effects, returning the new effects.

    Args:
        current: List[str] - current effects on the product.
        ingredient: str - ingredient to apply.

    Returns:
        List[str] - resulting effects after applying the ingredient.
    """

    if ingredient not in ingredients:
        raise ValueError(f"No such ingredient found: {ingredient}")

    # Check each current effect for a mutation
    mutated: List[str] = []
    for curr_eff in current:
        if curr_eff not in effects:
            raise ValueError(f"No such effect found: {curr_eff}")

        key: Tuple[str, str] = (curr_eff.lower(), ingredient.lower())
        new_effect = rules.get(key, curr_eff)

        if new_effect in mutated:
            continue

        mutated.append(new_effect)


    # Add the ingredient effect
    # There is an 8-effect limit
    if len(current) < 8:
        new_effect = ingredients[ingredient][1]
        if new_effect not in mutated:
            mutated.append(new_effect)
    return mutated
