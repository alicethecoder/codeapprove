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

import store from "@/store";

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
    }
  ]
});

router.beforeEach((to, from, next) => {
  uiModule.endLoading();
  uiModule.clearMessages();

  if (to.meta && to.meta.auth && !authModule.signedIn) {
    console.log("Not signed in, blocking route: ", to.fullPath);
    next({ path: "/signin" });
    return;
  }

  next();
});

export default router;
