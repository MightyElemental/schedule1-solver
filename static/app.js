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
    };
  },
  computed: {
    // Effects not chosen in either list
    availableInclude() {
      return this.lists.effects.filter(
        e =>
          !this.form.include.includes(e) &&
          !this.form.exclude.includes(e)
      );
    },
    availableExclude() {
      return this.lists.effects.filter(
        e =>
          !this.form.exclude.includes(e) &&
          !this.form.include.includes(e)
      );
    },
    includeDisabled() {
      return (
        this.form.include.length >= 8 ||
        this.availableInclude.length === 0
      );
    },
    excludeDisabled() {
      return this.availableExclude.length === 0;
    },
  },
  methods: {
    async fetchLists() {
      const res = await fetch("/lists");
      this.lists = await res.json();
      if (this.lists.bases.length) {
        this.form.base = this.lists.bases[0];
      }
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
    removeInclude(eff) {
      this.form.include = this.form.include.filter(e => e !== eff);
    },
    removeExclude(eff) {
      this.form.exclude = this.form.exclude.filter(e => e !== eff);
    },
    clearInclude() {
      this.form.include = [];
      this.newInclude = "";
    },
    clearExclude() {
      this.form.exclude = [];
      this.newExclude = "";
    },
    clearAll() {
      this.clearInclude();
      this.clearExclude();
    },
    async solve() {
      this.result = null;
      const payload = {
        base: this.form.base,
        include: this.form.include,
        exclude: this.form.exclude,
      };
      const res = await fetch("/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      this.result = await res.json();
    },
  },
  mounted() {
    this.fetchLists();
  },
}).mount("#app");
