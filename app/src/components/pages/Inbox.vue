<template>
  <div v-if="loaded">
    <div
      v-if="!installation.installed"
      class="flex flex-col items-center text-center my-8"
    >
      <h1 class="text-4xl mb-4">Almost done!</h1>
      <h2 class="text-xl">
        Looks like you haven't installed CodeApprove on of your
        <br />repositories yet click
        <a :href="installUrl" class="text-purple-400 hover:underline">here</a>
        to get started.
      </h2>
      <img class="mt-12" width="400" src="@/assets/undraw_empty_xct9.svg" />
    </div>
    <div v-else>
      <div class="grid grid-cols-3 gap-3">
        <div class="col-span-2">
          <!-- Inbox -->
          <div class="mt-8">
            <h2 class="font-bold text-xl mb-2">Incoming</h2>
            <p v-if="inbox.length === 0" class="text-lg">
              No code to review ... snack time!
            </p>
            <InboxItem
              v-else
              v-for="item in inbox"
              :item="item"
              :key="itemKey(item)"
            />
          </div>

          <!-- Outbox -->
          <div class="mt-8">
            <h2 class="font-bold text-xl mb-2">Outgoing</h2>
            <p v-if="outbox.length === 0" class="text-lg">
              You have no open PRs ... time to write some more code!
            </p>
            <InboxItem
              v-else
              v-for="item in outbox"
              :item="item"
              :key="itemKey(item)"
            />
          </div>

          <!-- Finished -->
          <div class="mt-8">
            <h2 class="font-bold text-xl mb-2">Completed</h2>
            <p v-if="finished.length === 0" class="text-lg">
              There's nothing here ... time to get shipping!
            </p>
            <InboxItem
              v-else
              v-for="item in finished"
              :item="item"
              :key="itemKey(item)"
            />
          </div>
        </div>
        <div class="col-span-1 pl-8">
          <h2 class="font-bold text-xl mb-2 mt-8">
            Connected Repos ({{ installation.repositories.length }})
            <a :href="installation.installation.url" target="_blank"
              ><font-awesome-icon icon="cog" class="text-lg ml-2"
            /></a>
          </h2>
          <div
            class="bg-dark-3 px-4 py-2 border-dark-0 shadow dark-shadow rounded"
          >
            <ul>
              <li
                v-for="repo in installation.repositories"
                :key="repo.full_name"
                class="pb-1"
              >
                <font-awesome-icon :icon="['fab', 'github']" class="mr-2" />
                <span class="text-lg">{{ repo.full_name }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";

import InboxItem from "@/components/elements/InboxItem.vue";

import AuthModule from "../../store/modules/auth";
import UIModule from "../../store/modules/ui";
import InboxModule from "../../store/modules/inbox";

import { config } from "../../plugins/config";
import { itemSlug } from "../../model/inbox";
import { firestore } from "../../plugins/firebase";
import {
  Github,
  PullRequestNode,
  InstallationStatus
} from "../../../../shared/github";
import { Review } from "../../../../shared/types";

@Component({
  components: {
    InboxItem
  }
})
export default class Inbox extends Vue {
  private authModule = getModule(AuthModule, this.$store);
  private uiModule = getModule(UIModule, this.$store);
  private inboxModule = getModule(InboxModule, this.$store);

  private github: Github = new Github(
    AuthModule.getDelegate(this.authModule),
    config.github.app_id
  );

  async mounted() {
    this.uiModule.beginLoading();

    const login = this.authModule.assertUser.username;
    await this.inboxModule.initialize({
      github: this.github,
      login
    });

    this.uiModule.endLoading();
  }

  get installation() {
    return this.inboxModule.installation;
  }

  get inbox() {
    return this.inboxModule.inbox;
  }

  get outbox() {
    return this.inboxModule.outbox;
  }

  get finished() {
    return this.inboxModule.finished;
  }

  get loaded() {
    return !this.uiModule.loading;
  }

  get installUrl() {
    return config.github.app_url + "/installations/new";
  }

  public itemKey(review: Review) {
    return itemSlug(review);
  }
}
</script>

<style lang="postcss"></style>
