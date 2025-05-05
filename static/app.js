// app.js
const { createApp } = Vue;

createApp({
  data() {
    return {
      lists: { bases: [], ingredients: [], effects: [] },
      form: { base: null, include: [], exclude: [] },
      newInclude: "",
      newExclude: "",
      result: null,
      showTrace: false,
      aspect: { w: window.innerWidth, h: window.innerHeight },
    };
  },
  computed: {
    isHorizontal() {
      return this.aspect.w > this.aspect.h;
    },
    // sort dropdowns by descending multiplier
    availableInclude() {
      return this.lists.effects
        .filter(e => !this.form.include.includes(e.name)
                  && !this.form.exclude.includes(e.name))
        .sort((a, b) => b.multiplier - a.multiplier);
    },
    availableExclude() {
      return this.lists.effects
        .filter(e => !this.form.exclude.includes(e.name)
                  && !this.form.include.includes(e.name))
        .sort((a, b) => b.multiplier - a.multiplier);
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
      const sellPrice = Math.round(basePrice * (1 + multSum));
      return {
        basePrice, ingredients, ingredientsTotal,
        totalCost, finalEffects, sellPrice
      };
    }
  },
  methods: {
    onResize() {
      this.aspect.w = window.innerWidth;
      this.aspect.h = window.innerHeight;
    },
    getIconURL(name) {
      const ing = this.lists.ingredients.find(x => x.name === name);
      return ing ? ing.icon_url : "/static/placeholder.png";
    },
    previousEffects(idx) {
      if (idx === 0) {
        return this.lists.bases.find(b => b.name === this.form.base).effects;
      } else {
        return this.result.trace[idx - 1];
      }
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
      let res;
      try {
        res = await fetch("/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base: this.form.base,
            include: this.form.include,
            exclude: this.form.exclude
          })
        });
      } catch (err) {
        this.result = { success: false, message: err.message };
        return;
      }
      if (!res.ok) {
        const err = await res.text();
        this.result = { success: false, message: err || res.statusText };
        return;
      }
      this.result = await res.json();
    },
    scrollNext() {
      const sc = this.$refs.scroller;
      if (!sc) return;
      const delta = this.isHorizontal
        ? sc.clientWidth * 0.8
        : sc.clientHeight * 0.8;
      if (this.isHorizontal) {
        sc.scrollBy({ left: delta, behavior: "smooth" });
      } else {
        sc.scrollBy({ top: delta, behavior: "smooth" });
      }
    },
    scrollPrev() {
      const sc = this.$refs.scroller;
      if (!sc) return;
      const delta = this.isHorizontal
        ? sc.clientWidth * 0.8
        : sc.clientHeight * 0.8;
      if (this.isHorizontal) {
        sc.scrollBy({ left: -delta, behavior: "smooth" });
      } else {
        sc.scrollBy({ top: -delta, behavior: "smooth" });
      }
    },
  },
  mounted() {
    this.fetchLists();
    window.addEventListener("resize", this.onResize);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.onResize);
  }
}).mount("#app");
