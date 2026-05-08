// app.js
const { createApp } = Vue;

createApp({
  data() {
    return {
      lists: { bases: [], ingredients: [], effects: [], rules: [] },
      form: { base: null, include: [], exclude: [], maxIngredients: 20, },
      newInclude: "",
      newExclude: "",
      effectSort: "multiplier",
      showSettings: false,
      showRecipesSidebar: false,
      recipeTabPulse: false,
      result: null,
      showTrace: false,
      traceRecipe: null,
      favorites: [],
      loading: false,
      expandedSteps: [],
      aspect: { w: window.innerWidth, h: window.innerHeight },
    };
  },
  computed: {
    isHorizontal() {
      return this.aspect.w > this.aspect.h;
    },
    solveBtnText() {
      return this.loading ? "Solving…" : "Solve";
    },
    availableInclude() {
      const effects = this.lists.effects.filter(e => !this.form.include.includes(e.name)
        && !this.form.exclude.includes(e.name));
      return this.sortEffects(effects);
    },
    availableExclude() {
      const effects = this.lists.effects.filter(e => !this.form.exclude.includes(e.name)
        && !this.form.include.includes(e.name));
      return this.sortEffects(effects);
    },
    includeDisabled() {
      return this.form.include.length >= 8
          || this.availableInclude.length === 0;
    },
    excludeDisabled() {
      return this.availableExclude.length === 0;
    },
    baseInnates() {
      const b = this.lists.bases.find(x => x.name === this.form.base);
      if (!b) return [];
      return b.effects.map(name => {
        const e = this.lists.effects.find(z => z.name === name) || {};
        return { name, multiplier: e.multiplier||0, color: e.color||"#fff" };
      });
    },
    pricing() {
      if (!this.result?.success) return {};
      const baseObj = this.lists.bases.find(b => b.name === this.form.base);
      const basePrice = baseObj.value;
      const ingredients = this.result.ingredients.map(name => {
        const obj = this.lists.ingredients.find(i => i.name === name);
        return { name, price: obj.price };
      });
      const ingredientsTotal = ingredients.reduce((s, i) => s + i.price, 0);
      const totalCost = basePrice + ingredientsTotal;
      const finalEffects = this.result.final_effects.map(name => {
        const ef = this.lists.effects.find(e => e.name === name);
        return { name, multiplier: ef.multiplier, color: ef.color };
      });
      const multSum = finalEffects.reduce((s, e) => s + e.multiplier, 0);
      const sellPrice = this.roundPrice(basePrice * (1 + multSum));
      return {
        basePrice, ingredients, ingredientsTotal,
        totalCost, finalEffects, sellPrice
      };
    },
    stepCosts() {
      if (!this.result?.success) return [];
      const costs = [];
      const baseObj = this.lists.bases.find(b => b.name === this.form.base);
      const basePrice = baseObj.value;
      // innate multipliers sum
      const innateSum = baseObj.effects
        .reduce((s,e) => s + this.getMultiplier(e), 0);
      const baseSale = this.roundPrice(basePrice * (1 + innateSum));
      const baseProfit = baseSale - basePrice;
      const baseProfitPct = Math.round((baseProfit / basePrice)*100);
      costs.push({
        cost: basePrice,
        sale: baseSale,
        profit: baseProfit,
        profitPct: baseProfitPct
      });
      // now for each ingredient step i
      let runningCost = basePrice;
      this.result.ingredients.forEach((ing, i) => {
        const price = this.lists.ingredients
          .find(x => x.name === ing).price;
        runningCost += price;
        const effects = this.result.trace[i];
        const multSum = effects
          .reduce((s,e) => s + this.getMultiplier(e), 0);
        const sale = this.roundPrice(basePrice * (1 + multSum));
        const profit = sale - runningCost;
        const profitPct = runningCost > 0
          ? Math.round((profit/runningCost)*100)
          : 0;
        costs.push({ cost: runningCost, sale, profit, profitPct });
      });
      return costs;
    }
  },
  methods: {
    onResize() {
      this.aspect.w = window.innerWidth;
      this.aspect.h = window.innerHeight;
    },
    roundPrice(value) {
      const floor = Math.floor(value);
      const fraction = value - floor;
      if (Math.abs(fraction - 0.5) < 1e-9) {
        return floor % 2 === 0 ? floor : floor + 1;
      }
      return Math.round(value);
    },
    sortEffects(effects) {
      const sorted = [...effects];
      if (this.effectSort === "alpha") {
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      }
      return sorted.sort((a, b) => b.multiplier - a.multiplier
        || a.name.localeCompare(b.name));
    },
    getIconURL(name) {
      const ing = this.lists.ingredients.find(x => x.name === name);
      return ing ? ing.icon_url : "/static/placeholder.png";
    },
    getBase(name) {
      return this.lists.bases.find(x => x.name === name);
    },
    getIngredient(name) {
      return this.lists.ingredients.find(x => x.name === name);
    },
    getRule(currentEffect, ingredient) {
      return this.lists.rules.find(rule => rule.current_effect === currentEffect.toLowerCase()
        && rule.ingredient === ingredient.toLowerCase());
    },
    previousEffects(idx) {
      if (idx === 0) {
        return this.lists.bases.find(b => b.name === this.form.base).effects;
      } else {
        return this.result.trace[idx - 1];
      }
    },
    previousTraceEffects(idx) {
      if (!this.traceRecipe) return [];
      if (idx === 0) return this.traceRecipe.baseEffects;
      return this.traceRecipe.trace[idx - 1];
    },
    onWheel(evt) {
      const sc = this.$refs.scroller;
      if (!sc) return;
      if (this.isHorizontal) {
        sc.scrollBy({ left: evt.deltaY, behavior: "auto" });
      } else {
        sc.scrollBy({ top: evt.deltaY, behavior: "auto" });
      }
    },
    async fetchLists() {
      const res = await fetch("/lists");
      this.lists = await res.json();
      if (this.lists.bases.length) {
        this.form.base = this.lists.bases[0].name;
      }
    },
    loadFavorites() {
      try {
        const saved = JSON.parse(localStorage.getItem("schedule1Favorites") || "[]");
        if (!Array.isArray(saved)) return;
        this.favorites = saved
          .filter(recipe => recipe && recipe.base && Array.isArray(recipe.ingredients))
          .map((recipe, index) => ({
            id: recipe.id || `${recipe.base}-${index}-${recipe.ingredients.join("-")}`,
            name: recipe.name || `${recipe.base} Recipe`,
            base: recipe.base,
            ingredients: recipe.ingredients,
          }));
      } catch (_) { /* ignore parse errors */ }
    },
    saveFavorites() {
      try {
        localStorage.setItem("schedule1Favorites", JSON.stringify(this.favorites));
      } catch (_) { /* ignore */ }
    },
    animateRecipeTab() {
      this.recipeTabPulse = false;
      requestAnimationFrame(() => {
        this.recipeTabPulse = true;
        window.setTimeout(() => {
          this.recipeTabPulse = false;
        }, 700);
      });
    },
    removeFavorite(id) {
      this.favorites = this.favorites.filter(recipe => recipe.id !== id);
      this.saveFavorites();
    },
    mutateEffects(current, ingredientName) {
      const ingredient = this.getIngredient(ingredientName);
      if (!ingredient) return [...current];

      const mutated = [];
      current.forEach(effectName => {
        const rule = this.getRule(effectName, ingredientName);
        const newEffect = rule ? rule.effect : effectName;
        if (!mutated.includes(newEffect)) {
          mutated.push(newEffect);
        }
      });

      if (current.length < 8 && !mutated.includes(ingredient.effect)) {
        mutated.push(ingredient.effect);
      }
      return mutated;
    },
    buildRecipeDetails(baseName, ingredientNames, name) {
      const base = this.getBase(baseName);
      if (!base) return null;

      let effects = [...base.effects];
      const trace = [];
      ingredientNames.forEach(ingredientName => {
        effects = this.mutateEffects(effects, ingredientName);
        trace.push([...effects]);
      });

      const stepCosts = this.buildStepCosts(base.value, base.effects, ingredientNames, trace);
      return {
        name: name || baseName,
        base: baseName,
        baseEffects: [...base.effects],
        ingredients: [...ingredientNames],
        finalEffects: [...effects],
        trace,
        stepCosts,
      };
    },
    buildStepCosts(basePrice, baseEffects, ingredientNames, trace) {
      const costs = [];
      const innateSum = baseEffects.reduce((sum, effect) => sum + this.getMultiplier(effect), 0);
      const baseSale = this.roundPrice(basePrice * (1 + innateSum));
      costs.push({
        cost: basePrice,
        sale: baseSale,
        profit: baseSale - basePrice,
        profitPct: Math.round(((baseSale - basePrice) / basePrice) * 100),
      });

      let runningCost = basePrice;
      ingredientNames.forEach((ingredientName, index) => {
        const ingredient = this.getIngredient(ingredientName);
        runningCost += ingredient ? ingredient.price : 0;
        const multSum = trace[index].reduce((sum, effect) => sum + this.getMultiplier(effect), 0);
        const sale = this.roundPrice(basePrice * (1 + multSum));
        const profit = sale - runningCost;
        const profitPct = runningCost > 0 ? Math.round((profit / runningCost) * 100) : 0;
        costs.push({ cost: runningCost, sale, profit, profitPct });
      });
      return costs;
    },
    showCurrentTrace() {
      if (!this.result?.success) return;
      this.traceRecipe = this.buildRecipeDetails(this.form.base, this.result.ingredients, this.form.base);
      this.expandedSteps = [];
      this.showTrace = true;
    },
    showFavoriteTrace(recipe) {
      const details = this.buildRecipeDetails(recipe.base, recipe.ingredients, recipe.name);
      if (!details) return;
      this.traceRecipe = details;
      this.expandedSteps = [];
      this.showTrace = true;
    },
    closeTrace() {
      this.showTrace = false;
      this.traceRecipe = null;
    },
    loadFavorite(recipe) {
      const details = this.buildRecipeDetails(recipe.base, recipe.ingredients, recipe.name);
      if (!details) return;
      this.form.base = recipe.base;
      this.result = {
        success: true,
        ingredients: [...recipe.ingredients],
        final_effects: details.finalEffects,
        trace: details.trace,
      };
      this.showRecipesSidebar = false;
    },
    getColor(name) {
      const e = this.lists.effects.find(x => x.name === name);
      return e ? e.color : "#fff";
    },
    getMultiplier(name) {
      const e = this.lists.effects.find(x => x.name === name);
      return e ? e.multiplier : 0;
    },
    addInclude() {
      if (this.newInclude) {
        this.form.include.push(this.newInclude);
        this.newInclude = "";
      }
    },
    addExclude() {
      if (this.newExclude) {
        this.form.exclude.push(this.newExclude);
        this.newExclude = "";
      }
    },
    removeInclude(e) {
      this.form.include = this.form.include.filter(x => x !== e);
    },
    removeExclude(e) {
      this.form.exclude = this.form.exclude.filter(x => x !== e);
    },
    clearInclude() {
      this.form.include = []; this.newInclude = "";
    },
    clearExclude() {
      this.form.exclude = []; this.newExclude = "";
    },
    clearAll() {
      this.clearInclude(); this.clearExclude();
    },
    async solve() {
      this.showTrace = false;
      this.result = null;
      this.loading = true;
      try {
        const res = await fetch("/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base: this.form.base,
            include: this.form.include,
            exclude: this.form.exclude,
            max_ingredients: this.form.maxIngredients,
          })
        });
        this.loading = false;
        if (!res.ok) {
          const err = await res.text();
          this.result = { success: false, message: err || res.statusText };
          return;
        }
        this.result = await res.json();
      } catch (err) {
        this.loading = false;
        this.result = { success: false, message: err.message };
      }
    },
    toggleStep(idx) {
      const i = this.expandedSteps.indexOf(idx);
      if (i > -1) {
        this.expandedSteps.splice(i, 1);
      } else {
        this.expandedSteps.push(idx);
      }
    },
    isExpanded(idx) {
      return this.expandedSteps.includes(idx);
    },
    scrollNext() {
      const sc = this.$refs.scroller;
      if (!sc) return;
      const children = sc.children;
      if (!children.length) return;
      const card = children[0];
      const style = window.getComputedStyle(sc);
      const gap = parseFloat(style.gap)
               || parseFloat(style.columnGap)
               || parseFloat(style.rowGap)
               || 0;
      const step = this.isHorizontal
        ? card.offsetWidth + gap
        : card.offsetHeight + gap;
      if (this.isHorizontal) {
        sc.scrollBy({ left: step, behavior: "smooth" });
      } else {
        sc.scrollBy({ top: step, behavior: "smooth" });
      }
    },
    scrollPrev() {
      const sc = this.$refs.scroller;
      if (!sc) return;
      const children = sc.children;
      if (!children.length) return;
      const card = children[0];
      const style = window.getComputedStyle(sc);
      const gap = parseFloat(style.gap)
               || parseFloat(style.columnGap)
               || parseFloat(style.rowGap)
               || 0;
      const step = this.isHorizontal
        ? -(card.offsetWidth + gap)
        : -(card.offsetHeight + gap);
      if (this.isHorizontal) {
        sc.scrollBy({ left: step, behavior: "smooth" });
      } else {
        sc.scrollBy({ top: step, behavior: "smooth" });
      }
    },
    saveState() {
      const state = {
        form: this.form,
        effectSort: this.effectSort,
        expandedSteps: this.expandedSteps
      };
      try {
        localStorage.setItem("schedule1State", JSON.stringify(state));
      } catch (_) { /* ignore */ }
    },
  
    loadState() {
      try {
        const saved = localStorage.getItem("schedule1State");
        if (!saved) return;
        const { form, effectSort, expandedSteps } = JSON.parse(saved);
        if (form) {
          // only overwrite keys we care about
          this.form.base           = form.base           ?? this.form.base;
          this.form.include        = form.include        ?? this.form.include;
          this.form.exclude        = form.exclude        ?? this.form.exclude;
          this.form.maxIngredients = form.maxIngredients ?? this.form.maxIngredients;
        }
        if (Array.isArray(expandedSteps)) {
          this.expandedSteps = expandedSteps;
        }
        if (["multiplier", "alpha"].includes(effectSort)) {
          this.effectSort = effectSort;
        }
      } catch (_) { /* ignore parse errors */ }
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        this.saveState();
      }
    },
    result: {
      deep: true,
      handler() {
        this.saveState();
      }
    },
    expandedSteps: {
      deep: true,
      handler() {
        this.saveState();
      }
    },
    effectSort() {
      this.saveState();
    }
  },  
  mounted() {
    // load last UI state (before lists so base may get overridden)
    this.loadState();
    this.loadFavorites();
    // then get fresh data
    this.fetchLists();
    window.addEventListener("resize", this.onResize);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.onResize);
  }
}).mount("#app");
