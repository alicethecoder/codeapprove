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
          <div class="mt-8">
            <h2 class="font-bold text-2xl mb-2">Incoming</h2>
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

          <div class="mt-8">
            <h2 class="font-bold text-2xl mb-2">Outgoing</h2>
            <p v-if="outbox.length === 0" class="text-lg">
              There's nothing here ... time to write some more code!
            </p>
            <InboxItem
              v-else
              v-for="item in outbox"
              :item="item"
              :key="itemKey(item)"
            />
          </div>
        </div>
        <div class="col-span-1 pl-8">
          <h2 class="font-bold text-2xl mb-2 mt-8">
            Repos ({{ installation.repositories.length }})
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

import { config } from "../../plugins/config";
import { InboxItemData, Status, itemSlug } from "../../model/inbox";
import {
  Github,
  PullRequestNode,
  InstallationStatus
} from "../../../../shared/github";

@Component({
  components: {
    InboxItem
  }
})
export default class Inbox extends Vue {
  public installation: InstallationStatus = {
    installed: false
  };

  public inbox: InboxItemData[] = [];
  public outbox: InboxItemData[] = [];

  private authModule = getModule(AuthModule, this.$store);
  private uiModule = getModule(UIModule, this.$store);

  private github: Github = new Github(
    AuthModule.getDelegate(this.authModule),
    config.github.app_id
  );

  async mounted() {
    this.uiModule.beginLoading();

    this.installation = await this.github.getInstallations();
    if (!this.installation.installed) {
      this.uiModule.endLoading();
      return;
    }

    const login = this.authModule.assertUser.username;
    const assigned = await this.github.getAssignedPulls(login);
    const outgoing = await this.github.getOutgoingPulls(login);

    this.inbox = assigned.map(this.nodeToItem);
    this.outbox = outgoing.map(this.nodeToItem);

    this.uiModule.endLoading();
  }

  get loaded() {
    return !this.uiModule.loading;
  }

  get installUrl() {
    return config.github.app_url + "/installations/new";
  }

  public itemKey(item: InboxItemData) {
    return itemSlug(item);
  }

  private nodeToItem(p: PullRequestNode): InboxItemData {
    // TODO: This is not right
    const status = p.closed ? "merged" : "pending";
    return {
      status,
      owner: p.repository.owner.login,
      repo: p.repository.name,
      number: `${p.number}`,
      title: p.title,
      updated: new Date(p.updatedAt).getTime()
    };
  }
}
</script>

<style lang="postcss"></style>
