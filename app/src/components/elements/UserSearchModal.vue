<template>
  <div
    v-hotkey="keymap"
    id="searchbox"
    class="w-auto dark-shadow bg-dark-2 border border-dark-0 rounded"
  >
    <div class="bg-dark-3 font-bold py-1 px-2">
      Search
    </div>
    <div class="p-2 border-t border-b border-dark-0">
      <input
        ref="searchField"
        type="text"
        v-model="query"
        class="w-full bg-dark-4"
        placeholder="Type a username..."
      />
    </div>
    <div>
      <span class="p-2" v-if="items.length === 0 && query">
        No results...
      </span>
      <ul class="w-full" v-else>
        <li
          v-for="(item, index) in items"
          :key="item.login"
          class="cursor-pointer"
          :class="{ active: index === activeIndex }"
          @mouseover="activeIndex = index"
          @click.prevent="selectItem(index)"
        >
          <div class="py-1 px-1 flex flex-row">
            <img
              :src="item.avatar_url"
              class="rounded-full inline avatar mr-2"
            /><span>{{ item.login }}</span>
            <span class="flex-grow"><!-- spacer --></span>
            <span
              v-if="item.collaborator"
              class="rounded-full px-2 py-1 text-xs bg-dark-7 text-gray-400"
              >{{ item.access_level }}</span
            >
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";

import { Github } from "../../../../shared/github";
import { config } from "../../plugins/config";
import AuthModule from "../../store/modules/auth";

@Component
export default class UserSearchModal extends Vue {
  @Prop() owner!: string;
  @Prop() repo!: string;

  public query: string = "";
  public activeIndex = 0;
  public items: any[] = [];

  private github!: Github;
  private authModule = getModule(AuthModule, this.$store);
  private searchFn: Function = () => {};

  mounted() {
    this.github = new Github(
      AuthModule.getDelegate(this.authModule),
      config.github.app_id
    );

    (this.$refs.searchField as any).focus();

    this.searchFn = this.debounce(async () => {
      if (!this.query || this.query.length === 0) {
        return;
      }

      const res = await this.github.searchUsers(
        this.owner,
        this.repo,
        this.query
      );

      this.items = res.slice(0, 10);
      this.activeIndex = 0;
    }, 300);
  }

  @Watch("query")
  async onQuery() {
    if (this.query === "") {
      this.items = [];
    }

    this.searchFn();
  }

  get keymap() {
    return {
      down: this.onArrowDown,
      up: this.onArrowUp,
      enter: this.onEnter
    };
  }

  private onArrowUp() {
    if (this.activeIndex > 0) {
      this.activeIndex--;
    }
  }

  private onArrowDown() {
    if (this.activeIndex < this.items.length - 1) {
      this.activeIndex++;
    }
  }

  private onEnter() {
    this.selectItem(this.activeIndex);
  }

  public selectItem(index: number) {
    const item = this.items[index];
    this.emitSelection({ login: item.login });
  }

  public emitSelection(event: { login: string }) {
    this.$emit("selected", event);
  }

  private debounce(func: Function, waitFor: number): Function {
    let timeout: any = undefined;

    const debounced = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(), waitFor);
    };

    return debounced;
  }
}
</script>

<style scoped lang="postcss">
#searchbox {
  min-width: 240px;
}

.avatar {
  height: 20px;
  width: 20px;
}

.active {
  @apply font-bold border-t border-b border-dark-0 bg-dark-3;
}
</style>
