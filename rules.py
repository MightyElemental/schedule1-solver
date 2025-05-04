"""
rules.py

Defines the base products, ingredients, effects, and combination rules.
Users should populate these lists/dicts with the full data set.
"""

from typing import Dict, List, Tuple, Optional
import pandas as pd

# Base products can have default (innate) effects.
plain_products: Dict[str, List[str]] = {
    "OG Kush": ["Calming"],
    "Sour Diesel": ["Refreshing"],
    "Green Crack": ["Energizing"],
    "Granddaddy Purple": ["Sedating"],
    "Methamphetamine": [],
    "Cocaine": [],
}

# List of all ingredients
# ingredient -> (price, new_effect)
ingredients: Dict[str, Tuple[int, str]] = {
    "Cuke": (2, "Energizing"),
    "Banana": (2, "Gingeritis"),
    "Paracetamol": (3, "Sneaky"),
    "Donut": (3, "Calorie-Dense"),
    "Viagor": (4, "Tropic Thunder"),
    "Mouth Wash": (4, "Balding"),
    "Flu Medicine": (5, "Sedating"),
    "Gasoline": (5, "Toxic"),
    "Energy Drink": (6, "Athletic"),
    "Motor Oil": (6, "Slippery"),
    "Mega Bean": (7, "Foggy"),
    "Chili": (7, "Spicy"),
    "Battery": (8, "Bright-Eyed"),
    "Iodine": (8, "Jennerising"),
    "Addy": (9, "Thought-Provoking"),
    "Horse Semen": (9, "Long Faced"),
}

# List of all possible effects (excluding "base")
effects: List[str] = [
    "Anti-Gravity",
    "Athletic",
    "Balding",
    "Bright-Eyed",
    "Calming",
    "Calorie-Dense",
    "Cyclopean",
    "Disorienting",
    "Electrifying",
    "Energizing",
    "Euphoric",
    "Explosive",
    "Focused",
    "Foggy",
    "Gingeritis",
    "Glowing",
    "Jennerising",
    "Laxative",
    "Lethal",
    "Long Faced",
    "Munchies",
    "Paranoia",
    "Refreshing",
    "Schizophrenic",
    "Sedating",
    "Seizure-Inducing",
    "Shrinking",
    "Slippery",
    "Smelly",
    "Sneaky",
    "Spicy",
    "Thought-Provoking",
    "Toxic",
    "Tropic Thunder",
    "Zombifying",
]

# Combination rules: (current_effect, ingredient) -> (new_effect, if_other_missing)
# If no rule applies, the effect carries over unchanged.
rules: Dict[Tuple[str, str], Tuple[str, Optional[str]]] = {}

def load_rules():
    df = pd.read_csv("rules.csv", delimiter=",", header=0)
    for _, row in df.iterrows():
        rules[(
            str(row.Replaces_Existing_Effect).lower(),
            str(row.Ingredient).lower()
        )] = (row.Effect, row.If_Other_Missing)


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
