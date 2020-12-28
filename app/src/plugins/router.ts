import Vue from "vue";
import VueRouter from "vue-router";
Vue.use(VueRouter);

import { getModule } from "vuex-module-decorators";
import AuthModule from "@/store/modules/auth";
import UIModule from "@/store/modules/ui";

import Home from "@/components/pages/Home.vue";
import SignIn from "@/components/pages/SignIn.vue";
import PullRequest from "@/components/pages/PullRequest.vue";
import Inbox from "@/components/pages/Inbox.vue";
import Pricing from "@/components/pages/Pricing.vue";
import FourOhFour from "@/components/pages/FourOhFour.vue";

import store from "@/store";
import * as cookies from "../plugins/cookies";

const authModule = getModule(AuthModule, store);
const uiModule = getModule(UIModule, store);

authModule.restoreFromLocalStorage();

const router = new VueRouter({
  mode: "history",
  routes: [
    { path: "/", component: Home },
    { path: "/signin", component: SignIn },
    {
      path: "/pr/:owner/:repo/:number",
      component: PullRequest,
      meta: {
        auth: true
      }
    },
    {
      path: "/inbox",
      component: Inbox,
      meta: {
        auth: true
      }
    },
    {
      path: "/pricing",
      component: Pricing
    },
    {
      path: "/404",
      component: FourOhFour
    }
  ],
  scrollBehavior(to, from, savedPosition) {
    // Always scroll to top
    // See: https://router.vuejs.org/guide/advanced/scroll-behavior.html
    return { x: 0, y: 0 };
  }
});

router.beforeEach((to, from, next) => {
  uiModule.endLoading();
  uiModule.clearMessages();

  if (to.meta && to.meta.auth && !authModule.signedIn) {
    console.log("Not signed in, blocking route: ", to.fullPath);
    Vue.$cookies.set(cookies.SIGNIN_PATH, to.path);
    next({ path: "/signin" });
    return;
  }

  next();
});

export default router;
