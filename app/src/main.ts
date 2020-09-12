// Register the router hooks for components (the docs say to do this first)
import { Component } from "vue-property-decorator";
Component.registerHooks(["beforeRouteEnter", "beforeRouteLeave"]);

// Vue!
import Vue from "vue";

// Base styles
import "./assets/styles/index.css";

// Store
import store from "@/store";

// Router
import router from "@/plugins/router";

// Font awesome icons
import { initIconLibrary } from "@/plugins/icons";
initIconLibrary();

// Click outside plugin
// https://github.com/ndelvalle/v-click-outside
const vClickOutside = require("v-click-outside");
Vue.use(vClickOutside);

// Hotkey plugin
// https://github.com/Dafrok/v-hotkey
const VueHotKey = require("v-hotkey");
Vue.use(VueHotKey.default);

// Prism component
const Prism = require("vue-prism-component");
Vue.component("prism", Prism);

// Prism JS and themes
import "prismjs";
import "prism-themes/themes/prism-atom-dark.css";

Vue.config.productionTip = false;

// Track page visibility
import * as pagevis from "./plugins/pagevis";

// Cookies
// https://github.com/cmp-cc/vue-cookie
import VueCookies from "vue-cookies";
Vue.use(VueCookies);

// Enable performance tracing in dev
if (process.env.NODE_ENV !== "production") {
  Vue.config.devtools = true;
  Vue.config.performance = true;
}

// Import app and initialize
import App from "./App.vue";
new Vue({
  created: () => {
    pagevis.trackVisibility();
  },
  render: h => h(App),
  router,
  store
}).$mount("#app");
