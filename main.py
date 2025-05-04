"""
main.py

FastAPI application exposing:
 - GET /lists       -> available bases, ingredients, effects
 - POST /solve      -> solve for a recipe
 - GET /            -> serve the SPA
"""

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

import rules
from solver import SolveRequest, solve_recipe, SolveResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    rules.load_rules()
    # Once this yields, FastAPI starts handling requests
    yield


app = FastAPI(title="Alchemy Recipe Solver", lifespan=lifespan)

# Serve static files from the 'static' directory
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/lists")
def get_lists():
    """Return available bases, ingredients, effects for the UI."""
    return {
        "bases": list(rules.plain_products.keys()),
        "ingredients": rules.ingredients,
        "effects": rules.effects,
    }


@app.post("/solve", response_model=SolveResponse)
def api_solve(req: SolveRequest):
    """Solve endpoint."""
    try:
        return solve_recipe(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def read_index():
    """Serve the single-page application."""
    return FileResponse("static/index.html")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
