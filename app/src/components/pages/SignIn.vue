<template>
  <div class="flex flex-col items-center">
    <div
      class="max-w-sm text-center inline-flex flex-col items-center m-8 rounded overflow-auto border dark-shadow bg-dark-2 border-dark-0"
    >
      <div
        class="w-full font-bold text-lg text-white bg-dark-3 border-b border-dark-0 p-2 m-0"
      >
        Sign In
      </div>
      <div class="p-4">
        <div v-if="hasCustomToken">
          <p>
            Connecting CodeApprove to GitHub...
          </p>
        </div>
        <div v-else>
          <p>
            CodeApprove needs access to your GitHub account in order to set up
            code review.
          </p>

          <!-- TODO: This is a nuts style -->
          <a :href="githubUrl" target="_self"
            ><button
              class="inline-flex items-center bg-dark-0 hover:bg-black border-wht-dim border hover:border-transparent dark-shadow hover:shadow-none rounded-lg mt-8 mb-4 px-4 py-2 text-white"
            >
              <font-awesome-icon :icon="['fab', 'github']" size="lg" />
              <span class="ml-2 font-bold">Sign In with GitHub</span>
            </button></a
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

import * as firebase from "firebase/app";
import { config } from "../../plugins/config";
import { auth, functions } from "../../plugins/firebase";

import { getModule } from "vuex-module-decorators";

import { User, createUser } from "../../model/auth";
import AuthModule from "../../store/modules/auth";
import UiModule from "../../store/modules/ui";
import UIModule from "../../store/modules/ui";

@Component({
  components: {}
})
export default class SignIn extends Vue {
  private authModule = getModule(AuthModule, this.$store);
  private uiModule = getModule(UIModule, this.$store);

  async mounted() {
    if (this.hasCustomToken) {
      this.signInCustom(this.$route.query.custom_token as string);
    }
  }

  private async signInCustom(customToken: string) {
    this.uiModule.beginLoading();
    try {
      const result = await auth().signInWithCustomToken(customToken);
      const tokenRes = await functions().httpsCallable("getGithubToken")();

      const access_token = tokenRes.data.access_token;
      const access_token_expires = tokenRes.data.access_token_expires;

      if (result.user) {
        const user: User = createUser(
          result.user,
          access_token,
          access_token_expires
        );
        this.authModule.setUser(user);
        this.$router.push("/inbox");
      } else {
        this.authModule.setUser(null);
      }
    } catch (e) {
      console.warn(`Sign in failure: ${e}`);
      this.uiModule.addDisappearingError("Sign in failed.");
      this.authModule.setUser(null);
    }
    this.uiModule.endLoading();
  }

  get hasCustomToken() {
    return !!this.$route.query.custom_token;
  }

  get githubUrl() {
    return `https://github.com/login/oauth/authorize?client_id=${config.github.client_id}&redirect_uri=${config.github.redirect}`;
  }
}
</script>

<style lang="scss">
// None ...
</style>
