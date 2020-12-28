<template>
  <div class="relative z-10 dark-shadow border border-dark-0 bg-dark-6">
    <div
      v-if="mode === 'inline' && resolved && !forceExpand"
      class="flex items-center px-2 py-1"
    >
      <span class="italic flex-grow text-wht-dim">Thread resolved</span>
      <font-awesome-icon
        @click="forceExpand = true"
        icon="eye"
        class="hover:text-white-brt text-wht-med cursor-pointer"
      />
    </div>
    <div v-else>
      <!-- Preview -->
      <div v-if="mode === 'standalone' && thread" class="bg-dark-3">
        <div
          class="flex items-center pl-2 pr-1 py-2 font-bold border-b border-blue-500"
        >
          <code>{{ thread.currentArgs.file }}</code>
          <span class="flex-grow"><!-- spacer --></span>
          <div
            v-if="isOutdated(thread)"
            class="text-sm rounded border border-yellow-400 px-1"
          >
            <code class="italic text-yellow-400">outdated</code>
          </div>
          <div
            v-if="resolved"
            class="text-sm rounded border border-gray-500 px-1"
          >
            <code class="italic text-gray-500">resolved</code>
          </div>
        </div>
        <div class="bg-dark-3">
          <prism
            v-if="!isOutdated(thread)"
            class="code-preview hover:underline cursor-pointer"
            @click="goToLine()"
            >{{ thread.currentArgs.line }}
            {{ thread.currentArgs.lineContent }}</prism
          >
          <prism v-else class="code-preview"
            >{{ thread.originalArgs.line }}
            {{ thread.originalArgs.lineContent }}</prism
          >
        </div>
      </div>

      <!-- Thread -->
      <div v-for="(comment, index) in comments" :key="index" class="flex p-2">
        <img class="flex-none avatar mt-1 mr-4" :src="comment.photoURL" />
        <div class="flex-grow">
          <div class="inline-flex flex-row items-baseline">
            <span class="font-bold mr-2">{{ comment.username }}</span>
            <span class="mr-2 text-wht-md text-sm">
              {{ formatTimestamp(comment.timestamp) }}
            </span>
            <span v-if="comment.draft" class="text-wht-md text-sm"
              >(draft)</span
            >
          </div>
          <MarkdownContent :content="comment.text" />
        </div>
      </div>

      <!-- Form -->
      <div>
        <!-- Text entry -->
        <div class="flex p-2">
          <img class="flex-none avatar mr-4" :src="photoURL" />
          <div class="flex-grow relative rounded bg-dark-7">
            <font-awesome-icon
              v-show="hasDraft"
              @click="renderDraft = !renderDraft"
              :icon="renderDraft ? 'keyboard' : 'magic'"
              class="absolute m-1 right-0 text-wht-med hover:text-wht-brt cursor-pointer"
            />
            <textarea
              class="w-full overflow-hidden rounded bg-dark-7 py-1 px-2"
              v-show="!renderDraft"
              v-model="draftComment"
              :rows="typing ? '4' : '1'"
              placeholder="Reply...?"
              ref="replyField"
              @focus="textFocus = true"
              @blur="textFocus = false"
            />
            <MarkdownContent
              class="w-full py-1 px-2"
              v-if="renderDraft"
              :content="draftComment"
            />
          </div>
        </div>

        <!-- Button row -->
        <div
          v-show="textFocus || hasDraft || noComments"
          class="flex flex-row-reverse px-2 pb-2"
        >
          <!-- Bind hotkeys when text entry is active -->
          <div v-hotkey="hotKeyMap" />

          <button
            v-if="!resolved"
            class="ml-2 btn btn-green"
            @click.prevent="addComment(true)"
          >
            Save + Resolve
            <font-awesome-icon icon="check" class="self-end mx-1" />
          </button>
          <button
            v-else
            class="ml-2 btn btn-green"
            @click.prevent="addComment(false)"
          >
            Save + Reopen
            <font-awesome-icon icon="exclamation" class="self-end mx-1" />
          </button>

          <button class="ml-2 btn btn-blue" @click.prevent="addComment()">
            Save
          </button>
          <button class="btn btn-red" @click.prevent="onCancel()">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch, Mixins } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";
import * as firebase from "firebase/app";

import { EventEnhancer } from "../../components/mixins/EventEnhancer";
import MarkdownContent from "@/components/elements/MarkdownContent.vue";
import { Thread, Comment } from "../../../../shared/types";
import AuthModule from "../../store/modules/auth";
import ReviewModule from "../../store/modules/review";
import { auth } from "../../plugins/firebase";
import * as events from "../../plugins/events";
import * as dom from "../../plugins/dom";
import { CommentThreadAPI } from "../api";
import { KeyMap, COMMENT_THREAD_KEY_MAP } from "../../plugins/hotkeys";

type Mode = "inline" | "standalone";

@Component({
  components: {
    MarkdownContent
  }
})
export default class CommentThread extends Mixins(EventEnhancer)
  implements CommentThreadAPI {
  @Prop({ default: "inline" }) mode!: Mode;
  @Prop() line!: number;
  @Prop() sha!: string;
  @Prop() threadId!: string | null;

  authModule = getModule(AuthModule, this.$store);
  reviewModule = getModule(ReviewModule, this.$store);

  thread: Thread | null = null;
  comments: Comment[] = [];

  forceExpand = false;
  textFocus = false;
  renderDraft = false;
  draftComment: string = "";

  mounted() {
    events.on(events.NEW_COMMENT_EVENT, this.onNewComment);
    this.loadComments();

    if (this.mode === "inline" && this.noComments) {
      const field = this.$refs.replyField as HTMLElement | undefined;
      if (field) {
        field.focus();
      }
    }
  }

  destroyed() {
    events.off(events.NEW_COMMENT_EVENT, this.onNewComment);
  }

  get hotKeyMap(): KeyMap {
    return COMMENT_THREAD_KEY_MAP(this);
  }

  public isOutdated(thread: Thread) {
    return thread.currentArgs.line < 0;
  }

  private loadComments() {
    if (this.threadId) {
      this.thread = this.reviewModule.threadById(this.threadId);
      this.comments = this.reviewModule.commentsByThread(this.threadId);
    }
  }

  private onNewComment(event: events.NewCommentEvent) {
    if (event.threadId === this.threadId) {
      this.loadComments();
    }
  }

  get photoURL() {
    return this.authModule.assertUser.photoURL;
  }

  get typing() {
    return this.textFocus || this.hasDraft;
  }

  get hasDraft() {
    return this.draftComment.length > 0;
  }

  get resolved(): boolean {
    return this.thread != null && this.thread.resolved;
  }

  get noComments(): boolean {
    return this.comments.length === 0;
  }

  public async addComment(resolve?: boolean) {
    console.log(`CommendThread#addComment(${resolve})`);

    const sha = this.thread ? this.thread.currentArgs.sha : this.sha;
    const partialEvt: Partial<events.AddCommentEvent> = {
      content: this.draftComment,
      line: this.line,
      resolve: resolve,
      sha: sha
    };

    // In standalone mode DiffLine and ChangeEntry are skipped,
    // but we know all of this already.
    if (this.thread) {
      partialEvt.file = this.thread.currentArgs.file;
      partialEvt.side = this.thread.currentArgs.side;
      partialEvt.lineContent = this.thread.currentArgs.lineContent;
    }

    // Start the event chain which goes through DiffLine, ChangeEntry, and PullRequest
    this.bubbleUp(partialEvt);

    // TODO(stop): Need some kind of "pending" state until the thing hits the server

    // Reset local state
    this.draftComment = "";
    this.renderDraft = false;
    this.unfocus();
    if (resolve === true) {
      this.forceExpand = false;
    }
  }

  public onCancel() {
    this.draftComment = "";
    if (!this.noComments) {
      this.unfocus();
    } else {
      this.$emit("cancel");
    }
  }

  public goToLine() {
    this.$emit("goto");
  }

  public formatTimestamp(timestamp: number): string {
    const today = new Date();
    const date = new Date(timestamp);
    const locale = navigator.language || "en-US";

    // Ex: "Sep 20"
    const dateFormat = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "2-digit"
    });

    // Ex: "9:01 AM"
    const timeFormat = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "numeric"
    });

    const onSameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    // If it's today, then we show a time instead
    if (onSameDay) {
      return timeFormat.format(date).toLowerCase();
    } else {
      return dateFormat.format(date);
    }
  }

  private unfocus() {
    this.textFocus = false;
    const field = this.$refs.replyField as HTMLElement | undefined;
    if (field) {
      field.blur();
    }
  }
}
</script>

<style scoped lang="postcss">
.avatar {
  @apply rounded;
  height: 32px;
  width: 32px;
}

.code-preview {
  @apply rounded-none;
  @apply py-1 px-2;
  background: unset;
  margin: 0;
}
</style>
