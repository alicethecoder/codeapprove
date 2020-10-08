<template>
  <div v-if="loaded" v-hotkey="hotKeyMap" class="relative py-4 px-4">
    <!-- Includes descriptions for children -->
    <HotkeyModal :map="hotKeyDescriptions" />

    <!-- Title of PR, branches, etc -->
    <div class="mb-4 flex flex-row items-center">
      <div>
        <h3 class="font-bold text-xl">
          {{ meta.owner }}/{{ meta.repo }} (<a
            class="text-purple-300 hover:underline"
            :href="
              `https://github.com/${meta.owner}/${meta.repo}/pull/${meta.number}`
            "
            target="_blank"
            >#{{ meta.number }}</a
          >)
        </h3>
        <p>
          merge <code>{{ prData.pr.head.label }}</code> into
          <code>{{ prData.pr.base.label }}</code>
        </p>
      </div>

      <span class="flex-grow"><!-- spacer --></span>

      <button
        v-if="!drafts.length && !userHasApproved"
        class="btn btn-green"
        @click="setMyApproval(true)"
      >
        Quick Approve
        <font-awesome-icon icon="check" class="ml-1" />
      </button>

      <button
        v-if="userHasApproved"
        class="btn btn-red"
        @click="setMyApproval(false)"
      >
        Undo Approval
        <font-awesome-icon icon="times" class="ml-1" />
      </button>
    </div>

    <!-- Send drafts bar -->
    <div
      v-if="drafts.length"
      class="flex flex-row items-center rounded border border-dark-0 bg-dark-3 dark-shadow my-4 py-3"
    >
      <span class="ml-4 font-bold text-yellow-400"
        ><font-awesome-icon icon="paper-plane" class="mr-1" /> You have
        {{ drafts.length }} draft comments</span
      >
      <span class="flex-grow"><!-- spacer --></span>
      <!-- TODO: Discard is unimplemented -->
      <button class="btn btn-red ml-2">Discard</button>
      <button class="btn btn-blue ml-2" @click.prevent="sendDrafts(false)">
        Send
      </button>
      <button class="btn btn-green ml-2 mr-2" @click.prevent="sendDrafts(true)">
        Send + Approve
      </button>
    </div>

    <!-- Description, reviewers, etc -->
    <div class="grid grid-cols-12 gap-4 items-start">
      <!-- Description -->
      <div
        class="col-span-8 dark-shadow rounded border border-dark-0 overflow-hidden"
      >
        <div
          class="flex items-center px-4 py-1 bg-dark-3 font-bold border-b border-dark-0"
        >
          <font-awesome-icon icon="user-edit" class="mr-2" />
          <span>Description</span>
        </div>
        <div class="description-content bg-dark-2">
          <MarkdownContent class="px-4 pt-2 pb-4" :content="prData.pr.body" />
        </div>
      </div>

      <!-- Review info -->
      <div
        class="col-span-4 dark-shadow inline-block border-dark-0 overflow-hidden rounded border"
      >
        <div
          :class="isApproved ? 'text-green-400' : 'text-yellow-400'"
          class="flex items-center px-4 py-1 bg-dark-3 font-bold border-dark-0 border-b"
        >
          <font-awesome-icon
            :icon="isApproved ? 'check' : 'pause-circle'"
            class="mr-2"
          />
          <span>Status: {{ statusText }}</span>
        </div>
        <div class="bg-dark-2 p-4">
          <table class="table-auto">
            <tr>
              <td class="font-bold align-top">
                <div class="inline-flex items-center mr-2">
                  <font-awesome-icon icon="user-check" class="mr-1" /> reviewers
                </div>
              </td>
              <td>
                <div>
                  <p v-for="reviewer in reviewers" :key="reviewer">
                    {{ reviewer }}
                    <UserReviewIcon
                      class="ml-1"
                      :approved="didApprove(reviewer)"
                      :canRemove="canRemoveReviewer(reviewer)"
                      @remove-clicked="removeReviewer(reviewer)"
                    />
                  </p>
                  <a
                    class="text-blue-600 hover:underline cursor-pointer pr-1"
                    @click.stop="usersearching = true"
                    >(add)</a
                  >
                </div>
                <UserSearchModal
                  class="absolute"
                  v-if="usersearching"
                  v-click-outside="() => (usersearching = false)"
                  :owner="meta.owner"
                  :repo="meta.repo"
                  @selected="onReviewerSelected"
                />
              </td>
            </tr>
            <tr>
              <td class="font-bold align-top">
                <div class="inline-flex items-center mr-2">
                  <font-awesome-icon icon="comment" class="mr-1" /> comments
                </div>
              </td>
              <td>
                {{ numThreads }} threads ({{ numUnresolvedThreads }} unresolved)
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>

    <!-- Changes -->
    <div class="mt-12">
      <div class="flex flex-row items-center">
        <span class="font-bold text-lg">Changes</span>
        <span class="flex-grow"><!-- spacer --></span>

        <!-- Select base commit -->
        <LabeledSelect
          v-if="!isFromFork()"
          class="mr-2"
          label="Base"
          :keys="[prData.pr.base.ref, ...prData.commits.map(c => c.sha)]"
          :values="[
            prData.pr.base.ref,
            ...prData.commits.map(c => displayCommit(c))
          ]"
          @selected="onBaseSelected($event.key)"
        />

        <!-- Select head commit -->
        <LabeledSelect
          v-if="!isFromFork()"
          class="mr-2"
          label="Head"
          :keys="prData.commits.map(c => c.sha).reverse()"
          :values="prData.commits.map(c => displayCommit(c)).reverse()"
          @selected="onHeadSelected($event.key)"
        />

        <button @click="collapseAll" class="btn btn-small btn-blue">
          Collapse All <font-awesome-icon icon="minus" class="ml-1" />
        </button>
      </div>

      <ChangeEntry
        v-for="(change, i) in prChanges"
        ref="changes"
        @click.native="setActiveChangeEntry(i)"
        :key="changeEntryKey(change)"
        :meta="change.metadata"
        :chunks="change.data"
      />
    </div>

    <!-- Comments -->
    <div class="mt-12">
      <div class="flex flex-row items-center mb-2">
        <span class="font-bold text-lg mr-2">Comments</span>
        <LabeledSelect
          :label="'Filter'"
          :keys="['unresolved', 'resolved', 'all']"
          :values="['unresolved', 'resolved', 'all']"
          @selected="threadFilter = $event.key"
        />
      </div>

      <div v-if="threads.length === 0">
        No comments...
      </div>

      <CommentThread
        v-for="thread in threads"
        :key="thread.id"
        class="w-1/2 mb-2"
        :mode="'standalone'"
        :line="thread.currentArgs.line"
        :sha="thread.currentArgs.sha"
        :threadId="thread.id"
        @goto="goToThread(thread)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Mixins } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";
import { PullsGetResponseData } from "@octokit/types";

import parseDiff from "parse-diff";

import { EventEnhancer } from "../mixins/EventEnhancer";
import ChangeEntry from "@/components/elements/ChangeEntry.vue";
import CommentThread from "@/components/elements/CommentThread.vue";
import MarkdownContent from "@/components/elements/MarkdownContent.vue";
import UserSearchModal from "@/components/elements/UserSearchModal.vue";
import HotkeyModal from "@/components/elements/HotkeyModal.vue";
import LabeledSelect from "@/components/elements/LabeledSelect.vue";
import UserReviewIcon from "@/components/elements/UserReviewIcon.vue";

import { freezeArray } from "../../../../shared/freeze";
import { Github, PullRequestData } from "../../../../shared/github";
import ReviewModule from "../../store/modules/review";
import UIModule from "../../store/modules/ui";
import {
  getFileMetadata,
  renderPairs,
  zipChangePairs,
  ChunkData,
  FileMetadata,
  RenderedChangePair,
  PullRequestChange
} from "../../plugins/diff";
import {
  Thread,
  Comment,
  ReviewMetadata,
  CommentUser
} from "../../model/review";
import AuthModule from "../../store/modules/auth";
import {
  KeyMap,
  KeyDescMap,
  combineHotkeys,
  PULL_REQUEST_KEY_DESC,
  PULL_REQUEST_KEY_MAP,
  CHANGE_ENTRY_KEY_DESC,
  COMMENT_THREAD_KEY_DESC
} from "../../plugins/hotkeys";

import { ChangeEntryAPI, PullRequestAPI } from "../api";
import { AddCommentEvent } from "../../plugins/events";
import { makeTopVisible, makeBottomVisible } from "../../plugins/dom";
import * as cookies from "../../plugins/cookies";
import { config } from "../../plugins/config";

@Component({
  components: {
    ChangeEntry,
    CommentThread,
    MarkdownContent,
    UserSearchModal,
    HotkeyModal,
    LabeledSelect,
    UserReviewIcon
  }
})
export default class PullRequest extends Mixins(EventEnhancer)
  implements PullRequestAPI {
  private authModule = getModule(AuthModule, this.$store);
  private reviewModule = getModule(ReviewModule, this.$store);
  private uiModule = getModule(UIModule, this.$store);

  private github!: Github;

  // TODO: Put these in a "UI" object
  public usersearching = false;
  public loading = true;

  // TODO: These should be one state object
  public prData: PullRequestData | null = null;
  public prChanges: PullRequestChange[] | null = null;
  public meta!: ReviewMetadata;

  public activeFileIndex = -1;
  public threadFilter = "unresolved";

  async mounted() {
    this.github = new Github(
      AuthModule.getDelegate(this.authModule),
      config.github.app_id
    );
    this.uiModule.beginLoading();

    // TODO: Need to watch for route changes
    // https://router.vuejs.org/guide/essentials/dynamic-matching.html#reacting-to-params-changes
    const params = this.$route.params;

    const { owner, repo } = params;
    const number = Number.parseInt(params.number);

    this.prData = await this.github.getPullRequest(owner, repo, number);

    // TODO: Do we need to hold onto prData at all?
    this.meta = {
      owner,
      repo,
      number,
      base: {
        label: this.prData.pr.base.label,
        sha: this.prData.pr.base.sha
      },
      head: {
        label: this.prData.pr.head.label,
        sha: this.prData.pr.head.sha
      }
    };

    // TODO: Call this again on base change?
    await this.reviewModule.initializeReview(this.meta);
    this.prChanges = this.renderPullRequest(this.prData);

    this.uiModule.endLoading();

    const hasShown = this.$cookies.get(cookies.HOTKEY_MODAL_SHOWN) === "true";
    if (!hasShown) {
      this.uiModule.addMessage({
        type: "alert",
        text: "Pro tip: press 'Alt + /' to see keyboard shortcuts"
      });
    }
  }

  public setMyApproval(approved: boolean) {
    this.reviewModule.pushReviewer({
      login: this.authModule.assertUser.username,
      approved
    });
  }

  public handleEvent(e: Partial<AddCommentEvent>) {
    console.log("PullRequest#handleEvent");

    const finalEvent = e as AddCommentEvent;
    const user: CommentUser = {
      username: this.authModule.assertUser.username,
      photoURL: this.authModule.assertUser.photoURL
    };

    this.reviewModule.handleAddCommentEvent({ e: finalEvent, user });
  }

  public async sendDrafts(approve: boolean) {
    const me = this.authModule.assertUser.username;
    const isReviewer = this.reviewModule.review.reviewers[me] !== undefined;

    if (isReviewer && approve) {
      // Moving from pending to approved
      this.setMyApproval(true);
    } else if (!isReviewer) {
      // Moving from not-reviewed to pending
      this.setMyApproval(false);
    }

    await this.reviewModule.sendDraftComments();
  }

  public onReviewerSelected(event: { login: string }) {
    this.usersearching = false;
    this.reviewModule.pushReviewer({ login: event.login, approved: false });
  }

  public collapseAll() {
    const changes = this.$refs.changes as ChangeEntryAPI[];
    for (const c of changes) {
      c.deactivate();
      c.collapse();
    }
    this.activeFileIndex = -1;
  }

  // TODO: The head/base state should probably be in the Vuex module
  public async onBaseSelected(base: string) {
    this.reloadDiff(base, this.reviewModule.reviewState.head);
  }

  public async onHeadSelected(head: string) {
    this.reloadDiff(this.reviewModule.reviewState.base, head);
  }

  public isFromFork() {
    return this.prData!.pr.head.user.login !== this.prData!.pr.base.user.login;
  }

  // TODO: This whole thing doesn't work for forks!
  public async reloadDiff(base: string, head: string) {
    this.uiModule.beginLoading();
    this.collapseAll();

    const diffs = await this.github.getDiff(
      this.meta.owner,
      this.meta.repo,
      base,
      head
    );

    this.prData!.diffs = freezeArray(diffs);
    this.prChanges = this.renderPullRequest(this.prData!);

    this.reviewModule.setBaseAndHead({
      base,
      head
    });

    this.uiModule.endLoading();
  }

  public displayCommit(commit: {
    sha: string;
    commit: { message: string };
  }): string {
    let shortMsg = commit.commit.message;
    if (shortMsg.length >= 25) {
      shortMsg = shortMsg.substring(0, 22) + "...";
    }

    return `${commit.sha.substring(0, 6)} ${shortMsg}`;
  }

  public changeEntryKey(change: PullRequestChange) {
    const { base, head } = this.reviewModule.reviewState;
    return `${change.metadata.from}@${base}-${change.metadata.to}@${head}`;
  }

  public setActiveChangeEntry(index: number) {
    const curr = this.getCurrentChangeEntry();
    if (curr) {
      curr.deactivate();
    }

    this.activeFileIndex = index;
    const next = this.getCurrentChangeEntry();
    if (next) {
      next.activate();
    } else {
      console.warn(`setActiveChangeEntry: could not activate ${index}`);
    }
  }

  public scrollToActive() {
    makeTopVisible(this.getCurrentChangeEntry()!.$el, 200);
  }

  public onNextFile() {
    this.setActiveChangeEntry(
      Math.min(this.activeFileIndex + 1, this.prData!.diffs.length - 1)
    );
    this.scrollToActive();
  }

  public onPrevFile() {
    this.setActiveChangeEntry(Math.max(this.activeFileIndex - 1, 0));
    this.scrollToActive();
  }

  public onToggleFile() {
    const ce = this.getCurrentChangeEntry()!;
    ce.toggle();
    ce.activate();
  }

  public goToThread(thread: Thread) {
    console.log(
      "goToThread",
      thread.currentArgs.sha,
      thread.currentArgs.file,
      thread.currentArgs.line
    );

    const changes = this.prChanges!;
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];

      const match =
        (thread.currentArgs.sha === this.reviewModule.reviewState.base &&
          change.file.from === thread.currentArgs.file) ||
        (thread.currentArgs.sha === this.reviewModule.reviewState.head &&
          change.file.to === thread.currentArgs.file);

      // TODO: Jump to specific file
      if (match) {
        console.log(`goToThread: jumping to index ${i}`);
        this.setActiveChangeEntry(i);
        this.getCurrentChangeEntry()!.expand();
        this.scrollToActive();
        return;
      }
    }
  }

  private getCurrentChangeEntry(): ChangeEntryAPI | undefined {
    if (this.activeFileIndex < 0) {
      return;
    }

    return (this.$refs.changes as ChangeEntryAPI[])[this.activeFileIndex];
  }

  get threads(): Thread[] {
    let threads = this.reviewModule.review.threads.filter(t => !t.draft);

    if (this.threadFilter !== "all") {
      const resolvedFilter = this.threadFilter === "resolved";
      threads = threads.filter(t => t.resolved === resolvedFilter);
    }

    return threads;
  }

  get hotKeyDescriptions(): KeyDescMap {
    return combineHotkeys(
      PULL_REQUEST_KEY_DESC,
      CHANGE_ENTRY_KEY_DESC,
      COMMENT_THREAD_KEY_DESC
    );
  }

  get hotKeyMap(): KeyMap {
    return PULL_REQUEST_KEY_MAP(this);
  }

  get userHasApproved() {
    return (
      this.reviewModule.review.reviewers[
        this.authModule.assertUser.username
      ] === true
    );
  }

  get isApproved() {
    return this.hasSomeApproval && !this.hasUnresolved;
  }

  get hasSomeApproval() {
    return Object.values(this.reviewModule.review.reviewers).some(x => x);
  }

  get hasUnresolved() {
    return this.numUnresolvedThreads > 0;
  }

  get statusText() {
    if (this.reviewers.length === 0) {
      return "Needs Review";
    }

    if (this.hasSomeApproval) {
      if (this.hasUnresolved) {
        return "Needs Resolution";
      } else {
        return "Approved";
      }
    } else {
      return "Needs Approval";
    }
  }

  get reviewers(): string[] {
    return Object.keys(this.reviewModule.review.reviewers);
  }

  public didApprove(login: string): boolean {
    return this.reviewModule.review.reviewers[login] || false;
  }

  public canRemoveReviewer(login: string): boolean {
    const myLogin = this.authModule.assertUser.username;

    // Users can remove themselves
    if (login === myLogin) {
      return true;
    }

    // The PR author can remove reviewers
    if (myLogin === this.prData!.pr.user.login) {
      return true;
    }

    return false;
  }

  public removeReviewer(login: string) {
    this.reviewModule.removeReviewer({ login });
  }

  get loaded() {
    return this.prData != null;
  }

  get drafts() {
    return this.reviewModule.drafts;
  }

  get numThreads() {
    return this.reviewModule.review.threads.length;
  }

  get numUnresolvedThreads() {
    const unresolved: Thread[] = this.reviewModule.review.threads.filter(
      x => !x.draft && !x.resolved
    );
    return unresolved.length;
  }

  private renderPullRequest(prData: PullRequestData): PullRequestChange[] {
    const changes: PullRequestChange[] = prData.diffs.map(file => {
      const metadata: FileMetadata = getFileMetadata(file);
      const data: ChunkData[] = file.chunks.map(chunk => {
        return {
          chunk,
          pairs: freezeArray(renderPairs(zipChangePairs(chunk)))
        };
      });

      return {
        file,
        metadata,
        data
      };
    });

    return changes;
  }

  beforeMount() {
    window.addEventListener("beforeunload", this.preventNav);
  }

  beforeDestroy() {
    window.removeEventListener("beforeunload", this.preventNav);
  }

  beforeRouteLeave(to: any, from: any, next: any) {
    if (this.drafts.length) {
      if (!window.confirm("You have unsent drafts. Leave without saving?")) {
        return;
      }
    }
    next();
  }

  private preventNav(e: BeforeUnloadEvent) {
    if (!this.drafts.length) {
      return;
    }

    e.preventDefault();
    e.returnValue = "";
  }
}
</script>

<style lang="postcss">
select {
  appearance: none;
}

.description-content {
  max-height: 400px;
  overflow-y: auto;
}
</style>
