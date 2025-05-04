"""
rules.py

Defines the base products, ingredients, effects, and combination rules.
Users should populate these lists/dicts with the full data set.
"""

from typing import Dict, List, Tuple, Optional
import pandas as pd
from numpy import nan

# Base products can have default (innate) effects.
# products -> (value, innate_effects)
plain_products: Dict[str, Tuple[int, List[str]]] = {}

# List of all ingredients
# ingredient -> (price, new_effect)
ingredients: Dict[str, Tuple[int, str]] = {}

# List of all possible effects (excluding "base")
# effect -> (multiplier, hex_color)
effects: Dict[str, Tuple[float, str]] = {}

# Combination rules: (current_effect, ingredient) -> (new_effect, if_other_missing)
# If no rule applies, the effect carries over unchanged.
rules: Dict[Tuple[str, str], Tuple[str, Optional[str]]] = {}

def load_definitions():
    load_products()
    load_rules()
    load_effects()
    load_ingredients()

def load_products():
    df = pd.read_csv("csv/products.csv", delimiter=",", header=0)
    df = df.replace({nan: None})
    for _, row in df.iterrows():
        innate_effects = str(row.Effects).split(";") if row.Effects else []
        plain_products[row.Name] = (
            int(row.Value),
            innate_effects,
        )

def load_rules():
    df = pd.read_csv("csv/rules.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        rules[(
            str(row.Replaces_Existing_Effect).lower(),
            str(row.Ingredient).lower()
        )] = (row.Effect, row.If_Other_Missing)

def load_effects():
    df = pd.read_csv("csv/effects.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        effects[str(row.Name)] = (
            float(row.Multiplier),
            str(row.Color),
        )

def load_ingredients():
    df = pd.read_csv("csv/ingredients.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        ingredients[str(row.Name)] = (
            int(row.Price),
            str(row.Effect),
        )


def mutate(current: List[str], ingredient: str) -> List[str]:
    """
    Apply an ingredient to a list of current effects, returning the new effects.

    Args:
        current: List[str] - current effects on the product.
        ingredient: str - ingredient to apply.

    Returns:
        List[str] - resulting effects after applying the ingredient.
    """

    # There is an 8-effect limit
    if len(current) >= 8:
        return current

    if ingredient not in ingredients:
        raise ValueError(f"No such ingredient found: {ingredient}")

    # Check each current effect for a mutation
    mutated: List[str] = []
    for curr_eff in current:
        if curr_eff not in effects:
            raise ValueError(f"No such effect found: {curr_eff}")

        key: Tuple = (curr_eff.lower(), ingredient.lower())
        new_effect, if_other_missing = rules.get(key, (curr_eff, None))

        if if_other_missing not in current:
            mutated.append(new_effect)


    # Add the ingredient effect
    mutated.append(ingredients[ingredient][1])
    return list(set(mutated))
