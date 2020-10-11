<template>
  <div
    id="bar"
    class="flex items-center dark-shadow text-purple-300 font-bold py-4 px-8 bg-dark-2"
  >
    <font-awesome-icon icon="code-branch" size="lg" class="mr-4" />
    <router-link to="/"><h1 class="text-xl">CodeApprove</h1></router-link>

    <span class="flex-grow"><!-- spacer --></span>

    <router-link v-if="!signedIn" to="/signin" exact-active-class="hidden"
      ><span class="text-md">Sign In</span>
    </router-link>

    <div v-if="signedIn" @click="showDropdown = true">
      <div class="flex items-center">
        <img class="avatar" :src="photoURL" />
        <font-awesome-icon icon="caret-down" class="ml-2 text-wht-brt" />
      </div>

      <ul
        v-if="showDropdown"
        v-click-outside="() => (showDropdown = false)"
        class="dropdown absolute mt-2 rounded dark-shadow border border-dark-0 bg-dark-3 whitespace-no-wrap text-md text-white-brt"
      >
        <li class="block px-4 py-2 text-wht-brt">{{ username }}</li>
        <li class="block px-4 py-2 dropdown-item" @click="toInbox()">
          <font-awesome-icon icon="tasks" class="pr-1" /> Inbox
        </li>
        <li class="block px-4 py-2 dropdown-item" @click="signOut()">
          <font-awesome-icon icon="door-open" class="pr-1" /> Sign Out
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

import { getModule } from "vuex-module-decorators";
import AuthModule from "../../store/modules/auth";

@Component
export default class HeaderBar extends Vue {
  showDropdown = false;

  private authModule = getModule(AuthModule, this.$store);

  get signedIn() {
    return this.authModule.signedIn;
  }

  get username() {
    if (!this.authModule.user) {
      return "unknown";
    }

    return this.authModule.assertUser.username;
  }

  get photoURL() {
    if (!this.authModule.user) {
      return "";
    }

    return this.authModule.assertUser.photoURL;
  }

  public async signOut() {
    this.showDropdown = false;
    await this.authModule.startSignOut();
    this.$router.push("/signin");
  }

  public async toInbox() {
    this.showDropdown = false;
    this.$router.push("/inbox");
  }
}
</script>

<style lang="postcss">
.hidden {
  display: none;
}

.avatar {
  height: 36px;
  width: 36px;
  @apply rounded-full;
}

.dropdown {
  transform: translate(-50%);
}

.dropdown-item {
  @apply cursor-pointer text-wht-brt border-t border-dark-0;
}

.dropdown-item:hover {
  @apply font-bold text-purple-300 bg-dark-5 border-t border-dark-0;
}
</style>
