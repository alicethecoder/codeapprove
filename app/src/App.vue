<template>
  <div id="app">
    <!-- Page Header -->
    <div class="w-full z-20 sticky top-0 shadow dark-shadow">
      <HeaderBar />
      <ProgressBar />
    </div>

    <!-- Page body from router -->
    <div id="body" class="grid grid-cols-12">
      <router-view :key="$route.fullPath" :class="bodyClasses" />
    </div>

    <!-- Footer -->
    <div class="w-full">
      <FooterBar />
    </div>

    <!-- Errors -->
    <MessageStack />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";

import HeaderBar from "@/components/elements/HeaderBar.vue";
import FooterBar from "@/components/elements/FooterBar.vue";
import ProgressBar from "@/components/elements/ProgressBar.vue";
import MessageStack from "@/components/elements/MessageStack.vue";

import { analytics, auth, remoteConfig } from "./plugins/firebase";
import { config } from "./plugins/config";
import * as events from "./plugins/events";

import AuthModule from "./store/modules/auth";
import UIModule from "./store/modules/ui";

@Component({
  components: {
    HeaderBar,
    FooterBar,
    ProgressBar,
    MessageStack
  }
})
export default class App extends Vue {
  authModule = getModule(AuthModule, this.$store);
  uiModule = getModule(UIModule, this.$store);

  authUnsub?: firebase.Unsubscribe = undefined;

  created() {
    // Initialize Firebase Analytics (built-in events)
    analytics();

    // TODO: This should be in the auth module itself
    this.authUnsub = auth().onAuthStateChanged(user => {
      if (!user) {
        this.authModule.setUser(null);
      }
    });

    events.on(
      events.PAGE_VISIBILITY_EVENT,
      (evt: events.PageVisibilityEvent) => {
        if (evt.visible) {
          const rc = remoteConfig();
          rc.fetchAndActivate().then(() => {
            const minVersion = rc.getNumber("min_version");
            if (config.version < minVersion) {
              this.uiModule.addMessage({
                type: "error",
                text:
                  "There is a newer version of CodeApprove available, please refresh"
              });
            }
          });
        }
      }
    );
  }

  destroyed() {
    this.authUnsub && this.authUnsub();
  }

  get bodyClasses() {
    if (this.$route.fullPath === "/") {
      return ["col-span-12"];
    } else {
      return ["col-start-2", "col-span-10"];
    }
  }
}
</script>

<style lang="postcss">
@import url("https://fonts.googleapis.com/css2?family=Lato&display=swap");

body {
  @apply text-wht-brt bg-dark-1;
}

#app {
  font-family: "Lato", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#body {
  min-height: 100vh;
}

.btn:focus {
  outline: none;
}

textarea:focus,
input:focus {
  border: 1px solid rgba(66, 153, 225, 0.6);
  outline: none;
}

// TODO: This should be a postcss extension
.dark-shadow {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

.btn {
  @apply px-2 py-1;
  @apply rounded border;
  @apply bg-dark-1;
}

.btn-small {
  /** TODO: This should be applied to all icon buttons! */
  @apply flex flex-row items-center;
  @apply text-sm;
  @apply px-2;
  padding-top: 1px;
  padding-bottom: 1px;
}

.btn-cta {
  @apply font-bold;
  @apply flex flex-row items-center;
  @apply rounded border-2;
  @apply text-2xl;
  @apply px-2 py-1;
}

@screen lg {
  .btn-cta {
    @apply text-3xl;
    @apply px-4 py-2;
  }
}

@screen xl {
  .btn-cta {
    @apply rounded-lg border-4;
    @apply text-4xl;
    @apply px-6 py-3;
  }
}

.btn:hover {
  @apply bg-dark-5;
}

.btn-blue {
  @apply border-blue-500 text-blue-500;
}

.btn-blue:hover {
  @apply border-blue-400 text-blue-400;
}

.btn-red {
  @apply border-red-400 text-red-400;
}

.btn-red:hover {
  @apply border-red-300 text-red-300;
}

.btn-green {
  @apply border-green-500 text-green-500;
}

.btn-green:hover {
  @apply border-green-400 text-green-400;
}

.btn-purple {
  @apply border-purple-300 text-purple-300;
}

.btn-purple:hover {
  @apply border-purple-200 text-purple-200;
}
</style>
