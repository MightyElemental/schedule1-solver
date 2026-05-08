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
      showSaveRecipe: false,
      saveRecipeName: "",
      result: null,
      showTrace: false,
      traceRecipe: null,
      favorites: [],
      expandedFavoriteIds: [],
      editingFavoriteId: null,
      editingFavoriteName: "",
      shareCode: "",
      shareRecipeName: "",
      shareMessage: "",
      importShareCode: "",
      importMessage: "",
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
    defaultRecipeName() {
      if (!this.result?.success) return this.form.base || "Recipe";
      return this.uniqueRecipeName(
        this.recipeNameCandidates(this.form.base, this.result.final_effects, this.result.ingredients),
      );
    },
    currentRecipeExists() {
      if (!this.result?.success) return false;
      return this.favorites.some(recipe => this.sameRecipe(
        recipe,
        this.form.base,
        this.result.ingredients,
      ));
    },
    saveRecipeButtonText() {
      return this.currentRecipeExists ? "Already Exists" : "Save Recipe";
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
            include: Array.isArray(recipe.include) ? recipe.include : [],
            exclude: Array.isArray(recipe.exclude) ? recipe.exclude : [],
          }));
      } catch (_) { /* ignore parse errors */ }
    },
    saveFavorites() {
      try {
        localStorage.setItem("schedule1Favorites", JSON.stringify(this.favorites));
      } catch (_) { /* ignore */ }
    },
    createFavoriteId() {
      if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    },
    openSaveRecipe() {
      if (!this.result?.success || this.currentRecipeExists) return;
      this.saveRecipeName = this.defaultRecipeName;
      this.showSaveRecipe = true;
      this.$nextTick(() => {
        this.$refs.saveRecipeNameInput?.focus();
        this.$refs.saveRecipeNameInput?.select();
      });
    },
    closeSaveRecipe() {
      this.showSaveRecipe = false;
      this.saveRecipeName = "";
    },
    saveCurrentRecipe() {
      if (!this.result?.success || this.currentRecipeExists) return;

      const name = this.saveRecipeName.trim() || this.defaultRecipeName;
      this.favorites.push({
        id: this.createFavoriteId(),
        name,
        base: this.form.base,
        ingredients: [...this.result.ingredients],
        include: [...this.form.include],
        exclude: [...this.form.exclude],
      });
      this.saveFavorites();
      this.closeSaveRecipe();
      this.animateRecipeTab();
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
      this.expandedFavoriteIds = this.expandedFavoriteIds.filter(recipeId => recipeId !== id);
      if (this.editingFavoriteId === id) {
        this.cancelFavoriteRename();
      }
      this.saveFavorites();
    },
    startFavoriteRename(recipe) {
      this.editingFavoriteId = recipe.id;
      this.editingFavoriteName = recipe.name;
      this.$nextTick(() => {
        const input = Array.isArray(this.$refs.favoriteRenameInput)
          ? this.$refs.favoriteRenameInput[0]
          : this.$refs.favoriteRenameInput;
        input?.focus();
        input?.select();
      });
    },
    cancelFavoriteRename() {
      this.editingFavoriteId = null;
      this.editingFavoriteName = "";
    },
    saveFavoriteRename(recipe) {
      const name = this.editingFavoriteName.trim();
      if (name) {
        recipe.name = name;
        this.saveFavorites();
      }
      this.cancelFavoriteRename();
    },
    recipeNameCandidates(base, effects, ingredients, preferredName = "") {
      const candidates = [];
      if (preferredName.trim()) {
        candidates.push(preferredName.trim());
      }
      if (effects.length === 0) {
        candidates.push(`${base} Recipe`);
      }
      if (effects.length > 0) {
        for (let count = Math.min(2, effects.length); count <= effects.length; count += 1) {
          candidates.push(`${base} - ${effects.slice(0, count).join(", ")}`);
        }
      }
      if (ingredients.length) {
        candidates.push(`${base} - ${ingredients.join(", ")}`);
      }
      candidates.push(`${base} Recipe`);
      return [...new Set(candidates)];
    },
    recipeNameExists(name) {
      return this.favorites.some(recipe => recipe.name.toLowerCase() === name.toLowerCase());
    },
    uniqueRecipeName(candidates) {
      const fallback = candidates[candidates.length - 1] || "Recipe";
      const availableName = candidates.find(name => !this.recipeNameExists(name));
      if (availableName) return availableName;

      let suffix = 2;
      let name = `${fallback} (${suffix})`;
      while (this.recipeNameExists(name)) {
        suffix += 1;
        name = `${fallback} (${suffix})`;
      }
      return name;
    },
    createBitWriter() {
      return {
        bytes: [],
        bitOffset: 0,
        write(value, bitCount) {
          for (let bit = bitCount - 1; bit >= 0; bit -= 1) {
            if (this.bitOffset % 8 === 0) {
              this.bytes.push(0);
            }
            const byteIndex = this.bytes.length - 1;
            const bitIndex = 7 - (this.bitOffset % 8);
            this.bytes[byteIndex] |= ((value >> bit) & 1) << bitIndex;
            this.bitOffset += 1;
          }
        },
      };
    },
    createBitReader(bytes) {
      return {
        bytes,
        bitOffset: 0,
        read(bitCount) {
          let value = 0;
          for (let bit = 0; bit < bitCount; bit += 1) {
            const byteIndex = Math.floor(this.bitOffset / 8);
            if (byteIndex >= this.bytes.length) {
              throw new Error("Share code is incomplete.");
            }
            const bitIndex = 7 - (this.bitOffset % 8);
            value = (value << 1) | ((this.bytes[byteIndex] >> bitIndex) & 1);
            this.bitOffset += 1;
          }
          return value;
        },
      };
    },
    encodeBase64Url(bytes) {
      const binary = String.fromCharCode(...bytes);
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    decodeBase64Url(value) {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=");
      return [...atob(padded)].map(char => char.charCodeAt(0));
    },
    recipeToShareCode(recipe) {
      const baseIndex = this.lists.bases.findIndex(base => base.name === recipe.base);
      const ingredientIndexes = recipe.ingredients.map(ingredient => (
        this.lists.ingredients.findIndex(item => item.name === ingredient)
      ));
      const nameBytes = [...new TextEncoder().encode(recipe.name)];

      if (baseIndex < 0 || baseIndex > 31 || ingredientIndexes.some(index => index < 0 || index > 31)) {
        throw new Error("Recipe contains unknown data.");
      }
      if (ingredientIndexes.length > 31) {
        throw new Error("Recipe has too many ingredients to share.");
      }
      if (nameBytes.length > 255) {
        throw new Error("Recipe name is too long to share.");
      }

      const writer = this.createBitWriter();
      writer.write(1, 4);
      writer.write(baseIndex, 5);
      writer.write(ingredientIndexes.length, 5);
      ingredientIndexes.forEach(index => writer.write(index, 5));
      writer.write(nameBytes.length, 8);
      nameBytes.forEach(byte => writer.write(byte, 8));
      return `S1R.${this.encodeBase64Url(writer.bytes)}`;
    },
    shareCodeToRecipe(code) {
      const trimmed = code.trim();
      const encoded = trimmed.startsWith("S1R.") ? trimmed.slice(4) : trimmed;
      const reader = this.createBitReader(this.decodeBase64Url(encoded));
      const version = reader.read(4);
      if (version !== 1) {
        throw new Error("Unsupported share code version.");
      }

      const base = this.lists.bases[reader.read(5)];
      const ingredientCount = reader.read(5);
      const ingredients = [];
      for (let index = 0; index < ingredientCount; index += 1) {
        const ingredient = this.lists.ingredients[reader.read(5)];
        if (!ingredient) {
          throw new Error("Share code references an unknown ingredient.");
        }
        ingredients.push(ingredient.name);
      }

      if (!base) {
        throw new Error("Share code references an unknown base.");
      }

      const nameLength = reader.read(8);
      const nameBytes = [];
      for (let index = 0; index < nameLength; index += 1) {
        nameBytes.push(reader.read(8));
      }
      const name = new TextDecoder().decode(new Uint8Array(nameBytes)).trim();
      const effects = this.buildRecipeDetails(base.name, ingredients, name)?.finalEffects || [];
      return {
        id: this.createFavoriteId(),
        name: this.uniqueRecipeName(this.recipeNameCandidates(base.name, effects, ingredients, name)),
        base: base.name,
        ingredients,
        include: [],
        exclude: [],
      };
    },
    showShareCode(recipe) {
      try {
        this.shareCode = this.recipeToShareCode(recipe);
        this.shareRecipeName = recipe.name;
        this.shareMessage = "";
      } catch (err) {
        this.shareCode = "";
        this.shareRecipeName = "";
        this.shareMessage = err.message;
      }
    },
    async copyShareCode() {
      if (!this.shareCode) return;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(this.shareCode);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = this.shareCode;
          textArea.setAttribute("readonly", "");
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
        this.shareMessage = "Copied";
      } catch (_) {
        this.shareMessage = "Select and copy manually";
      }
    },
    closeRecipesSidebar() {
      this.showRecipesSidebar = false;
      this.importMessage = "";
      this.shareMessage = "";
    },
    importSharedRecipe() {
      this.importMessage = "";
      try {
        const recipe = this.shareCodeToRecipe(this.importShareCode);
        if (this.favorites.some(existing => this.sameRecipe(existing, recipe.base, recipe.ingredients))) {
          this.importMessage = "Already exists";
          return;
        }
        const importedName = recipe.name;
        this.favorites.push(recipe);
        this.saveFavorites();
        this.importShareCode = "";
        this.importMessage = `Imported as ${importedName}`;
        this.animateRecipeTab();
      } catch (err) {
        this.importMessage = err.message;
      }
    },
    sameRecipe(recipe, base, ingredients) {
      if (recipe.base !== base || recipe.ingredients.length !== ingredients.length) {
        return false;
      }
      return recipe.ingredients.every((ingredient, index) => ingredient === ingredients[index]);
    },
    toggleFavoriteDetails(id) {
      if (this.expandedFavoriteIds.includes(id)) {
        this.expandedFavoriteIds = this.expandedFavoriteIds.filter(recipeId => recipeId !== id);
      } else {
        this.expandedFavoriteIds.push(id);
      }
    },
    isFavoriteExpanded(id) {
      return this.expandedFavoriteIds.includes(id);
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
    recipeFinancials(recipe) {
      const details = this.buildRecipeDetails(recipe.base, recipe.ingredients, recipe.name);
      if (!details) {
        return { totalCost: 0, sellPrice: 0, profit: 0, profitPct: 0 };
      }
      const finalStep = details.stepCosts[details.stepCosts.length - 1];
      return {
        totalCost: finalStep.cost,
        sellPrice: finalStep.sale,
        profit: finalStep.profit,
        profitPct: finalStep.profitPct,
      };
    },
    favoriteEffects(recipe) {
      const details = this.buildRecipeDetails(recipe.base, recipe.ingredients, recipe.name);
      return details ? details.finalEffects : [];
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
      this.form.include = Array.isArray(recipe.include) ? [...recipe.include] : [];
      this.form.exclude = Array.isArray(recipe.exclude) ? [...recipe.exclude] : [];
      this.newInclude = "";
      this.newExclude = "";
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
      this.closeSaveRecipe();
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
